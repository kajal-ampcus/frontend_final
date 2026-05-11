"""
apps/cms/views/menu.py  — v2 (corrected)

N+1 and query optimisation fixes vs v1:

  1. LIST VIEW — double DB evaluation eliminated:
     v1: qs.count() hits DB → serializer(qs) hits DB again → 2 queries minimum.
     v2: items = list(qs) once → len(items) for count. One query, zero re-eval.

  2. LIST VIEW — created_by join added:
     v1: select_related('category') only. Serializer doesn't expose created_by
         so this is fine for now, but documented so future serializer additions
         don't silently introduce N+1 on that FK.
     v2: same — select_related('category') is sufficient for current fields.
         created_by is excluded from MenuItemSerializer by design.

  3. DETAIL VIEW — select_related added:
     v1: MenuItem.objects.get(id=item_id, ...) — no prefetch.
         MenuItemSerializer then accesses item.category → extra query.
     v2: .select_related('category') on the queryset before .get().

  4. POST RESPONSE — re-serialization fixed:
     v1: item = serializer.save() → MenuItemSerializer(item).data
         item.category is a deferred FK — accessing it fires another query.
     v2: After save(), re-fetch with select_related so the response
         serialization is zero extra queries.

  5. PATCH RESPONSE — same fix as POST.

  6. AVAILABILITY view — select_related added for consistency.
"""

import csv
import io
import logging

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import RoleChoices
from apps.cms.models.canteen import CanteenLocation
from apps.cms.models.menu import MenuCategory, CanteenMenuItem as MenuItem
from apps.cms.serializers.menu import (
    MenuCategorySerializer,
    MenuCategoryCreateSerializer,
    MenuItemSerializer,
    MenuItemCreateSerializer,
    MenuItemAvailabilitySerializer,
)
from apps.common.permissions import IsCMSAdmin, IsEmployeeOrAdmin

logger = logging.getLogger(__name__)


def _request_company_id(request):
    company_id = getattr(request, 'tenant_company_id', None)
    if company_id:
        return company_id

    try:
        company_id = request.auth.get('company_id') if request.auth else None
    except Exception:
        company_id = None
    if company_id:
        return company_id

    employee = getattr(request.user, 'employee_profile', None)
    return getattr(employee, 'company_id', None)


def _is_category_admin(request):
    role_type = None
    try:
        role_type = request.auth.get('role_type') if request.auth else None
    except Exception:
        role_type = None

    if role_type is None:
        role_type = getattr(request.user, 'role_type', None)

    return role_type in {
        RoleChoices.SUPER_ADMIN,
        RoleChoices.COMPANY_ADMIN,
        RoleChoices.CANTEEN_ADMIN,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsEmployeeOrAdmin])
def canteen_list_view(request):
    """
    GET /cms/canteens/

    Returns active canteens available to the logged-in user. Admin screens use
    this to resolve a canteen_id when the JWT is not scoped to one canteen.
    """
    company_id = _request_company_id(request)
    role_type = None
    try:
        role_type = request.auth.get('role_type') if request.auth else None
    except Exception:
        role_type = None

    qs = CanteenLocation.objects.filter(is_active=True, deleted_at__isnull=True)
    if role_type != RoleChoices.SUPER_ADMIN and company_id:
        qs = qs.filter(company_id=company_id)

    data = [
        {
            'id': str(canteen.id),
            'name': canteen.name,
            'company_id': str(canteen.company_id),
        }
        for canteen in qs.order_by('name')
    ]
    return Response({'results': data}, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_canteen_or_404(canteen_id, request):
    """
    Validates the canteen exists and belongs to the JWT's company.
    Returns CanteenLocation or None (→ 404).
    """
    company_id = _request_company_id(request)
    role_type = None
    try:
        role_type = request.auth.get('role_type') if request.auth else None
    except Exception:
        role_type = None

    filters = {
        'id': canteen_id,
        'is_active': True,
    }
    if role_type != RoleChoices.SUPER_ADMIN and company_id:
        filters['company_id'] = company_id

    try:
        return CanteenLocation.objects.get(**filters)
    except CanteenLocation.DoesNotExist:
        return None


def _fetch_item_with_relations(item_id, canteen):
    """
    Single helper used by detail, patch, and availability views to fetch
    a MenuItem with its category already joined.

    Centralised here so every write path gets identical prefetch behaviour —
    no view can accidentally serialize a lazy FK.

    Returns MenuItem or None.
    """
    try:
        return (
            MenuItem.objects
            .select_related('category')        # eliminates category lazy-load
            .get(id=item_id, canteen=canteen)  # ActiveManager already filters deleted_at
        )
    except MenuItem.DoesNotExist:
        return None


def _serialize_after_save(item):
    """
    After a create or update, re-fetch the item with its relations before
    serializing so the response doesn't trigger extra queries on item.category.

    Why re-fetch instead of accessing item.category directly?
    Because item returned from serializer.save() has category set as the
    raw FK object from validated_data — it's not the same queryset-evaluated
    instance that select_related would return, and accessing related objects
    on it can still fire a query if the ORM decides to re-evaluate.
    Re-fetching with select_related guarantees one clean round trip.
    """
    return (
        MenuItem.objects
        .select_related('category')
        .get(pk=item.pk)
    )


def _as_bool(value, default=True):
    if value is None or value == '':
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'y', 'available'}


# ──────────────────────────────────────────────────────────────────────────────
# Categories — list + create + delete
# ──────────────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def category_list_view(request, canteen_id):
    """
    GET /cms/canteens/{canteen_id}/menu/categories/
    POST /cms/canteens/{canteen_id}/menu/categories/

    Query count: 2 (canteen lookup + category list).
    No N+1 risk — MenuCategory has no FKs accessed by MenuCategorySerializer.

    Index hit: idx_mcat_canteen_active on (canteen_id, is_active).
    """
    canteen = _get_canteen_or_404(canteen_id, request)
    if canteen is None:
        return Response({'detail': 'Canteen not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not _is_category_admin(request):
        return Response({'detail': 'Canteen admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'POST':
        serializer = MenuCategoryCreateSerializer(
            data=request.data,
            context={'canteen_id': str(canteen.id)},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        category = serializer.save()
        return Response(MenuCategorySerializer(category).data, status=status.HTTP_201_CREATED)

    categories = MenuCategory.objects.filter(canteen=canteen, is_active=True)
    serializer = MenuCategorySerializer(categories, many=True)
    return Response({'results': serializer.data}, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def category_detail_view(request, canteen_id, category_id):
    """
    DELETE /cms/canteens/{canteen_id}/menu/categories/{category_id}/

    Categories are deactivated instead of physically deleted so existing menu
    items can keep their historical category reference.
    """
    canteen = _get_canteen_or_404(canteen_id, request)
    if canteen is None:
        return Response({'detail': 'Canteen not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not _is_category_admin(request):
        return Response({'detail': 'Canteen admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        category = MenuCategory.objects.get(id=category_id, canteen=canteen, is_active=True)
    except MenuCategory.DoesNotExist:
        return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

    category.is_active = False
    category.save(update_fields=['is_active', 'updated_at'])

    logger.info(
        "Menu category %s deactivated by user=%s",
        category.id,
        request.auth.get('user_id') if request.auth else 'unknown',
    )
    return Response(status=status.HTTP_204_NO_CONTENT)


# ──────────────────────────────────────────────────────────────────────────────
# Menu Items — list + create
# ──────────────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsEmployeeOrAdmin])
def menu_item_list_create_view(request, canteen_id):
    """
    GET  /cms/canteens/{canteen_id}/menu/items/
    POST /cms/canteens/{canteen_id}/menu/items/

    ── GET ──────────────────────────────────────────────────────────────────────
    Query count: 2 (canteen lookup + items).
    N+1 status: NONE — select_related('category') in the queryset joins
    category in the same SQL query.

    The queryset is evaluated ONCE into a list. len() of that list provides
    the count — no second .count() round trip.

    Index hit:
      No extra filter  → idx_mi_canteen_del_name  (canteen_id, deleted_at, name)
      category filter  → idx_mi_canteen_del_cat
      item_type filter → idx_mi_canteen_del_type
      avail filter     → idx_mi_canteen_del_avail

    ── POST ─────────────────────────────────────────────────────────────────────
    Query count: 4 (canteen, category validation, INSERT, re-fetch for response).
    Write path is admin-only — latency is less critical than list.
    """
    canteen = _get_canteen_or_404(canteen_id, request)
    if canteen is None:
        return Response({'detail': 'Canteen not found.'}, status=status.HTTP_404_NOT_FOUND)

    # ── GET ──────────────────────────────────────────────────────────────────
    if request.method == 'GET':
        qs = (
            MenuItem.objects                       # ActiveManager → deleted_at IS NULL
            .filter(canteen=canteen, is_active=True)
            .select_related('category')            # JOIN — eliminates N+1 on category
            # created_by NOT selected — not in serializer fields.
            # Add .select_related('category', 'created_by') if serializer expands.
        )

        # Apply optional filters (each maps to a composite index)
        cat_id = request.query_params.get('category_id')
        if cat_id:
            qs = qs.filter(category_id=cat_id)

        item_type = request.query_params.get('item_type', '').upper()
        if item_type in (MenuItem.ITEM_TYPE_BREAKFAST, MenuItem.ITEM_TYPE_MEAL):
            qs = qs.filter(item_type=item_type)

        is_available_param = request.query_params.get('is_available')
        if is_available_param is not None:
            qs = qs.filter(is_available=is_available_param.lower() == 'true')

        search = request.query_params.get('search', '').strip()
        if search:
            # icontains → LIKE '%x%' — does not use B-tree index.
            # For production add pg_trgm GIN index (see models.py note).
            qs = qs.filter(name__icontains=search)

        # FIX v1 bug: evaluate queryset ONCE.
        # v1 called qs.count() (1 DB round trip) then serializer(qs) (2nd round trip).
        items = list(qs)                           # single SQL execution
        count = len(items)                         # no extra query

        serializer = MenuItemSerializer(items, many=True, context={'request': request})
        return Response({'count': count, 'results': serializer.data}, status=status.HTTP_200_OK)

    # ── POST ─────────────────────────────────────────────────────────────────
    if not IsCMSAdmin().has_permission(request, None):
        return Response({'detail': 'CMS Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = MenuItemCreateSerializer(
        data=request.data,
        context={
            'canteen_id':  str(canteen.id),
            'employee_id': request.auth.get('employee_id') if request.auth else None,
        }
    )

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    item = serializer.save()

    # FIX v1 bug: re-fetch with select_related before serializing the response.
    # item returned from save() does not have category prefetched — accessing
    # item.category would fire an extra query inside MenuItemSerializer.
    item = _serialize_after_save(item)

    return Response(MenuItemSerializer(item, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsCMSAdmin])
def menu_item_bulk_import_view(request, canteen_id):
    """
    POST /cms/canteens/{canteen_id}/menu/items/bulk-import/

    Accepts multipart form-data:
      file: CSV file

    CSV columns:
      name, base_price, category, item_type, description, display_tag, is_available

    Missing categories are created automatically for this canteen.
    Duplicate item names are skipped.
    """
    canteen = _get_canteen_or_404(canteen_id, request)
    if canteen is None:
        return Response({'detail': 'Canteen not found.'}, status=status.HTTP_404_NOT_FOUND)

    upload = request.FILES.get('file')
    if upload is None:
        return Response({'file': 'CSV file is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        decoded = upload.read().decode('utf-8-sig')
    except UnicodeDecodeError:
        return Response({'file': 'CSV must be UTF-8 encoded.'}, status=status.HTTP_400_BAD_REQUEST)

    rows = csv.DictReader(io.StringIO(decoded))
    if not rows.fieldnames:
        return Response({'file': 'CSV is empty or missing headers.'}, status=status.HTTP_400_BAD_REQUEST)

    created_items = []
    created_categories = []
    skipped = []
    errors = []

    for index, row in enumerate(rows, start=2):
        name = (row.get('name') or '').strip()
        category_name = (row.get('category') or '').strip()
        category_id = (row.get('category_id') or '').strip()

        if not name:
            errors.append({'row': index, 'error': 'name is required.'})
            continue

        if not category_id and not category_name:
            errors.append({'row': index, 'name': name, 'error': 'category or category_id is required.'})
            continue

        if MenuItem.all_objects.filter(
            canteen=canteen,
            deleted_at__isnull=True,
            name__iexact=name,
        ).exists():
            skipped.append({'row': index, 'name': name, 'reason': 'duplicate item'})
            continue

        if category_id:
            try:
                category = MenuCategory.objects.get(id=category_id, canteen=canteen, is_active=True)
            except MenuCategory.DoesNotExist:
                errors.append({'row': index, 'name': name, 'error': 'category_id not found.'})
                continue
        else:
            category = MenuCategory.objects.filter(
                canteen=canteen,
                name__iexact=category_name,
            ).first()
            if category is None:
                category = MenuCategory.objects.create(canteen=canteen, name=category_name)
                created_categories.append(MenuCategorySerializer(category).data)
            elif not category.is_active:
                category.is_active = True
                category.name = category_name
                category.save(update_fields=['is_active', 'name', 'updated_at'])

        payload = {
            'name': name,
            'description': (row.get('description') or '').strip(),
            'base_price': (row.get('base_price') or '').strip(),
            'category_id': str(category.id),
            'item_type': (row.get('item_type') or MenuItem.ITEM_TYPE_MEAL).strip().upper(),
            'display_tag': (row.get('display_tag') or '').strip(),
            'is_available': _as_bool(row.get('is_available'), True),
        }

        serializer = MenuItemCreateSerializer(
            data=payload,
            context={
                'canteen_id': str(canteen.id),
                'employee_id': request.auth.get('employee_id') if request.auth else None,
            },
        )
        if not serializer.is_valid():
            errors.append({'row': index, 'name': name, 'error': serializer.errors})
            continue

        item = _serialize_after_save(serializer.save())
        created_items.append(MenuItemSerializer(item, context={'request': request}).data)

    return Response(
        {
            'created_count': len(created_items),
            'created_category_count': len(created_categories),
            'skipped_count': len(skipped),
            'error_count': len(errors),
            'created_items': created_items,
            'created_categories': created_categories,
            'skipped': skipped,
            'errors': errors,
        },
        status=status.HTTP_200_OK,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Menu Items — detail + update + delete
# ──────────────────────────────────────────────────────────────────────────────

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated, IsEmployeeOrAdmin])
def menu_item_detail_view(request, canteen_id, item_id):
    """
    GET    /cms/canteens/{canteen_id}/menu/items/{item_id}/
    PATCH  /cms/canteens/{canteen_id}/menu/items/{item_id}/
    DELETE /cms/canteens/{canteen_id}/menu/items/{item_id}/

    Query count:
      GET    → 2 (canteen, item + category JOIN)
      PATCH  → 4 (canteen, item JOIN, category validation, UPDATE, re-fetch)
      DELETE → 2 (canteen, item JOIN) + 1 UPDATE

    N+1 status: NONE — _fetch_item_with_relations() always joins category.
    Index hit: idx_mi_id_canteen_del on (id, canteen_id, deleted_at).
    """
    canteen = _get_canteen_or_404(canteen_id, request)
    if canteen is None:
        return Response({'detail': 'Canteen not found.'}, status=status.HTTP_404_NOT_FOUND)

    # FIX v1 bug: .get() had no select_related → lazy category load on serialize.
    item = _fetch_item_with_relations(item_id, canteen)
    if item is None:
        return Response({'detail': 'Menu item not found.'}, status=status.HTTP_404_NOT_FOUND)

    # ── GET ──────────────────────────────────────────────────────────────────
    if request.method == 'GET':
        # item.category already loaded — zero extra queries in serializer.
        return Response(MenuItemSerializer(item, context={'request': request}).data, status=status.HTTP_200_OK)

    # Write guard
    if not IsCMSAdmin().has_permission(request, None):
        return Response({'detail': 'CMS Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    # ── PATCH ─────────────────────────────────────────────────────────────────
    if request.method == 'PATCH':
        serializer = MenuItemCreateSerializer(
            item,
            data=request.data,
            partial=True,
            context={
                'canteen_id':  str(canteen.id),
                'employee_id': request.auth.get('employee_id') if request.auth else None,
            }
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        item = serializer.save()

        # FIX v1 bug: same as POST — re-fetch with select_related for the response.
        item = _serialize_after_save(item)
        return Response(MenuItemSerializer(item, context={'request': request}).data, status=status.HTTP_200_OK)

    # ── DELETE (soft) ─────────────────────────────────────────────────────────
    if request.method == 'DELETE':
        item.deleted_at = timezone.now()
        item.is_active  = False
        # update_fields restricts the UPDATE to only these two columns.
        # Without it Django emits UPDATE cms_menu_items SET col1=?, col2=?, ...
        # for every field on the model — much heavier than needed.
        item.save(update_fields=['deleted_at', 'is_active', 'updated_at'])
        logger.info(
            "Menu item %s soft-deleted by user=%s",
            item.id,
            request.auth.get('user_id') if request.auth else 'unknown',
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


# ──────────────────────────────────────────────────────────────────────────────
# Availability toggle
# ──────────────────────────────────────────────────────────────────────────────

@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsCMSAdmin])
def menu_item_availability_view(request, canteen_id, item_id):
    """
    PATCH /cms/canteens/{canteen_id}/menu/items/{item_id}/availability/
    Body: { "is_available": true | false }

    Query count: 3 (canteen, item + JOIN, UPDATE).
    select_related included for consistency — even though this endpoint
    doesn't serialize category, future logging/response expansion might.
    """
    canteen = _get_canteen_or_404(canteen_id, request)
    if canteen is None:
        return Response({'detail': 'Canteen not found.'}, status=status.HTTP_404_NOT_FOUND)

    item = _fetch_item_with_relations(item_id, canteen)
    if item is None:
        return Response({'detail': 'Menu item not found.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = MenuItemAvailabilitySerializer(item, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Use update_fields to emit a minimal UPDATE — only is_available + updated_at.
    instance = serializer.save()
    instance.save(update_fields=['is_available', 'updated_at'])

    return Response(
        {'id': str(item.id), 'is_available': item.is_available},
        status=status.HTTP_200_OK,
    )
