"""
apps/cms/views/announcement_view.py

Fixes applied vs original:
  BUG 1  — NotFound imported lazily inside _get_object on every 404 call → moved
             to top-level import.
  BUG 1b — except Exception too broad in _get_object → narrowed to DoesNotExist.
  BUG 5  — toggle_status guard was `if request.data:` — truthy for any non-empty
             body, including bodies without a 'status' key, causing misleading 400s.
             Changed to `if 'status' in request.data`.
  BUG 7  — PageNumberPagination instantiated inside list() on every request →
             promoted to a named subclass defined at module level.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound          # BUG 1 FIX: top-level import
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.cms.models import Announcement
from apps.cms.serializers import (
    AnnouncementSerializer,
    AnnouncementStatsSerializer,
    AnnouncementToggleStatusSerializer,
)
from apps.cms.services.announcement_service import AnnouncementService


# BUG 7 FIX: define paginator as a named subclass at module level,
# not re-instantiated on every request inside list().
class _AnnouncementPagination(PageNumberPagination):
    page_size = 20


class AnnouncementViewSet(ViewSet):
    """
    Announcement CRUD + extras, delegating all logic to AnnouncementService.

    list            GET    /api/cms/announcements/
    create          POST   /api/cms/announcements/
    retrieve        GET    /api/cms/announcements/{id}/
    update          PUT    /api/cms/announcements/{id}/
    partial_update  PATCH  /api/cms/announcements/{id}/
    destroy         DELETE /api/cms/announcements/{id}/
    toggle_status   PATCH  /api/cms/announcements/{id}/toggle_status/
    stats           GET    /api/cms/announcements/stats/
    """

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _get_object(self, pk):
        # BUG 1 FIX: catch specific DoesNotExist instead of bare Exception.
        # Catching Exception hid programming errors (AttributeError, TypeError, etc.).
        try:
            return AnnouncementService.get_by_id(pk)
        except Announcement.DoesNotExist:
            raise NotFound(detail="Announcement not found.")

    # ── Standard actions ───────────────────────────────────────────────────────

    def list(self, request):
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search', '').strip()
        qs = AnnouncementService.get_filtered(status=status_filter, search=search)

        # BUG 7 FIX: use module-level paginator subclass, not a per-request instance.
        paginator = _AnnouncementPagination()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = AnnouncementSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = AnnouncementSerializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request):
        serializer = AnnouncementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = AnnouncementService.create(serializer.validated_data)
        return Response(AnnouncementSerializer(instance).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        instance = self._get_object(pk)
        return Response(AnnouncementSerializer(instance).data)

    def update(self, request, pk=None):
        instance = self._get_object(pk)
        serializer = AnnouncementSerializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = AnnouncementService.update(instance, serializer.validated_data)
        return Response(AnnouncementSerializer(updated).data)

    def partial_update(self, request, pk=None):
        instance = self._get_object(pk)
        serializer = AnnouncementSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = AnnouncementService.update(instance, serializer.validated_data)
        return Response(AnnouncementSerializer(updated).data)

    def destroy(self, request, pk=None):
        instance = self._get_object(pk)
        AnnouncementService.delete(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Extra actions ──────────────────────────────────────────────────────────

    @action(detail=True, methods=['patch'], url_path='toggle_status')
    def toggle_status(self, request, pk=None):
        instance = self._get_object(pk)
        new_status = None

        # BUG 5 FIX: `if request.data:` was truthy for any non-empty body,
        # even bodies missing the 'status' key, causing confusing 400s.
        # Guard on the specific key presence instead.
        if 'status' in request.data:
            ser = AnnouncementToggleStatusSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            new_status = ser.validated_data['status']

        updated = AnnouncementService.toggle_status(instance, new_status)
        return Response(AnnouncementSerializer(updated).data)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        data = AnnouncementService.get_stats()
        serializer = AnnouncementStatsSerializer(data)
        return Response(serializer.data)