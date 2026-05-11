"""
apps/cms/views/slot.py

Corrections applied vs original:
  FIX D  — today() and upcoming() now filter by canteen_id (from authenticated user
             or explicit query param). Without this, all slots across all canteens
             are returned — broken after canteen FK was added to MealSlot.
  FIX 5  — Queryset annotated with occupancy_count to avoid N+1. The annotation
             is picked up automatically by MealSlotListSerializer.
  NEW    — is_active filter added to filterset_fields so admin can filter
             active/inactive slots.
  NEW    — canteen_id filter added to filterset_fields for multi-tenant filtering.

Note on canteen resolution:
  get_canteen_id() below shows the recommended pattern — pull canteen_id from the
  authenticated user's profile. Adjust to match your auth model (e.g. request.user.canteen_id,
  or a URL kwarg if you use nested routers like /canteens/{canteen_id}/slots/).
"""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounts.models import RoleChoices
from apps.cms.models import CanteenLocation, MealSlot, SlotMenuItem
from apps.cms.models.order import OrderStatus
from apps.cms.serializers.slot import (
    MealSlotListSerializer,
    MealSlotDetailSerializer,
    MealSlotWriteSerializer,
    SlotMenuItemSerializer,
    SlotMenuItemToggleSerializer,
)

# Import the order statuses that count toward occupancy.
# Adjust the import path to match your project structure.
# from apps.cms.models.order import OrderStatus
# OCCUPANCY_STATUSES = [OrderStatus.PLACED, OrderStatus.PREPARING, OrderStatus.READY]
OCCUPANCY_STATUSES = ["PLACED", "PREPARING", "READY"]   # fallback — replace with enum


def _annotate_occupancy(queryset):
    """
    Annotate each MealSlot with occupancy_count.
    Requires Order.slot to be a proper FK with related_name='slot_orders'.
    Until that FK is in place, occupancy_count will always be 0.
    """
    return queryset.annotate(
        occupancy_count=Count(
            'slot_orders',
            filter=Q(slot_orders__status__in=[
                OrderStatus.PLACED,
                OrderStatus.PREPARING,
                OrderStatus.READY,
            ]),
        )
    )


def _token_value(request, key, default=None):
    try:
        return request.auth.get(key, default) if request.auth else default
    except Exception:
        return default


class MealSlotViewSet(viewsets.ModelViewSet):
    """
    ┌─────────────────────────────────────────────────────────────┐
    │  ENDPOINT                              │  UI ACTION          │
    ├─────────────────────────────────────────────────────────────┤
    │  GET    /api/slots/                    │  Slot card grid     │
    │  POST   /api/slots/                    │  Add New Slot modal │
    │  GET    /api/slots/{id}/               │  Slot detail        │
    │  PUT    /api/slots/{id}/               │  Edit Slot modal    │
    │  PATCH  /api/slots/{id}/               │  Partial edit       │
    │  DELETE /api/slots/{id}/               │  Trash icon         │
    │  GET    /api/slots/today/              │  Today's slots      │
    │  GET    /api/slots/upcoming/           │  Upcoming slots     │
    │  GET    /api/slots/{id}/items/         │  Availability modal │
    │  PATCH  /api/slots/{id}/items/{item}/  │  Toggle switch      │
    └─────────────────────────────────────────────────────────────┘
    """

    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    permission_classes = [IsAuthenticated]
    filterset_fields = [
        "date",
        "meal_type",
        "label",
        "canteen_id",   # NEW: required for multi-tenant filtering
        "is_active",    # NEW: admin can filter active/inactive slots
    ]
    search_fields   = ["name"]
    ordering_fields = ["date", "start_time", "name"]
    ordering        = ["date", "start_time"]

    def get_queryset(self):
        company_id = _token_value(self.request, 'company_id')
        role_type = _token_value(self.request, 'role_type')
        qs = (
            MealSlot.objects
            .select_related('canteen')
            .prefetch_related('slot_items')
            .all()
        )
        if role_type != RoleChoices.SUPER_ADMIN and company_id:
            qs = qs.filter(canteen__company_id=company_id)
        return _annotate_occupancy(qs)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return MealSlotWriteSerializer
        if self.action == "retrieve":
            return MealSlotDetailSerializer
        return MealSlotListSerializer

    # ── helper: resolve canteen from request ──────────────────────
    def _get_canteen_id(self):
        """
        Return the canteen_id to scope queries for the current user.
        Adjust to match your auth model — examples:
          - request.user.canteen_id         (profile FK)
          - self.kwargs.get('canteen_pk')   (nested router)
          - request.query_params.get('canteen_id')  (explicit param)
        """
        explicit = self.request.query_params.get('canteen_id')
        if explicit:
            return explicit
        return getattr(self.request.user, 'canteen_id', None)

    def _get_write_canteen(self):
        canteen_id = self.request.data.get('canteen_id') or self.request.query_params.get('canteen_id')
        company_id = _token_value(self.request, 'company_id')
        role_type = _token_value(self.request, 'role_type')

        qs = CanteenLocation.objects.filter(is_active=True, deleted_at__isnull=True)
        if role_type != RoleChoices.SUPER_ADMIN and company_id:
            qs = qs.filter(company_id=company_id)
        if canteen_id:
            return get_object_or_404(qs, id=canteen_id)
        return qs.order_by('name').first()

    def perform_create(self, serializer):
        serializer.save(canteen=self._get_write_canteen())

    # ── GET /api/slots/today/ ──────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="today")
    def today(self, request):
        # FIX D: scope to canteen — without this, all canteens' slots are returned
        canteen_id = self._get_canteen_id()
        qs = self.get_queryset().filter(date=timezone.localdate())
        if canteen_id:
            qs = qs.filter(canteen_id=canteen_id)
        return Response(MealSlotListSerializer(qs, many=True).data)

    # ── GET /api/slots/upcoming/ ───────────────────────────────────
    @action(detail=False, methods=["get"], url_path="upcoming")
    def upcoming(self, request):
        # FIX D: scope to canteen
        canteen_id = self._get_canteen_id()
        qs = self.get_queryset().filter(date__gte=timezone.localdate())
        if canteen_id:
            qs = qs.filter(canteen_id=canteen_id)
        return Response(MealSlotListSerializer(qs, many=True).data)

    # ── GET /api/slots/{id}/items/ ─────────────────────────────────
    @action(detail=True, methods=["get"], url_path="items")
    def items(self, request, pk=None):
        """
        Returns assigned items with their is_enabled toggle.
        Frontend merges with menu-app data using menu_item_id.
        Matches the "Slot Item Availability" modal (eye icon).
        """
        slot = self.get_object()
        slot_items = slot.slot_items.all()
        return Response(SlotMenuItemSerializer(slot_items, many=True).data)

    # ── PATCH /api/slots/{id}/items/{item_id}/ ─────────────────────
    @action(detail=True, methods=["patch"], url_path=r"items/(?P<item_id>[0-9a-f-]+)")
    def toggle_item(self, request, pk=None, item_id=None):
        """
        Toggle is_enabled for one menu item inside this slot.
        Body: { "is_enabled": true | false }
        Matches the orange toggle switch in the Availability modal.

        NOTE: item_id regex updated from \\d+ to [0-9a-f-]+ to accept UUIDs.
        """
        slot = self.get_object()
        slot_item = get_object_or_404(SlotMenuItem, slot=slot, menu_item_id=item_id)
        serializer = SlotMenuItemToggleSerializer(slot_item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SlotMenuItemSerializer(slot_item).data)
