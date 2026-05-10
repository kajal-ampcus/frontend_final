import csv
from datetime import date, datetime
from django.http import HttpResponse
from django.db.models import Q, Sum, Avg, Count
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet
from rest_framework.permissions import IsAuthenticated
from apps.cms.models import MenuOrderItem, GuestOrder, CanteenLocation
from apps.cms.serializers import (
    MenuItemSerializer, GuestOrderSerializer, GuestOrderCreateSerializer,
    GuestOrderStatusUpdateSerializer, GuestOrderStatsSerializer
)


class GuestOrderViewSet(ModelViewSet):
    queryset = GuestOrder.objects.all()
    serializer_class = GuestOrderSerializer
    permission_classes = [IsAuthenticated]

    def _get_canteen(self):
        """Resolve the canteen for the current admin user."""
        canteen = CanteenLocation.objects.filter(is_active=True).first()
        if canteen is None:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'canteen': 'No active canteen found. Please create a canteen first.'})
        return canteen

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get('status', 'all')
        search = self.request.query_params.get('search', '')
        if status_filter != 'all':
            queryset = queryset.filter(status=status_filter)
        if search:
            queryset = queryset.filter(
                Q(guest_name__icontains=search) | Q(phone__icontains=search)
            )
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return GuestOrderCreateSerializer
        return super().get_serializer_class()

    def perform_create(self, serializer):
        canteen = self._get_canteen()
        serializer.save(canteen=canteen)

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Delete is not allowed for guest orders.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    @action(detail=True, methods=['patch'], url_path='status', url_name='guest-order-status')
    def status(self, request, pk=None):
        """Update guest order status."""
        try:
            order = self.get_object()
            serializer = GuestOrderStatusUpdateSerializer(data=request.data)
            if serializer.is_valid():
                order.status = serializer.validated_data['status']
                order.save()
                return Response(GuestOrderSerializer(order).data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except GuestOrder.DoesNotExist:
            return Response(
                {'detail': 'Guest order not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        today = date.today()
        orders_today = GuestOrder.objects.filter(created_at__date=today)
        total_guests = orders_today.values('guest_name').distinct().count()
        active_orders = orders_today.filter(status__in=['pending', 'accepted', 'preparing', 'prepared', 'ready']).count()
        todays_revenue = orders_today.filter(status__in=['completed', 'collected']).aggregate(
            total=Sum('total')
        )['total'] or 0
        average_order = orders_today.filter(status__in=['completed', 'collected']).aggregate(
            avg=Avg('total')
        )['avg'] or 0
        data = {
            'total_guests': total_guests,
            'active_orders': active_orders,
            'todays_revenue': todays_revenue,
            'average_order': average_order,
        }
        serializer = GuestOrderStatsSerializer(data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        status_filter = request.query_params.get('status')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        queryset = GuestOrder.objects.all()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="guest_orders.csv"'
        writer = csv.writer(response)
        writer.writerow(['Order ID', 'Guest Name', 'Phone', 'Total', 'Status', 'Created At', 'Estimated Time', 'Special Instructions'])

        for order in queryset:
            writer.writerow([
                order.order_number,
                order.guest_name,
                order.phone,
                order.total,
                order.status,
                order.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                order.estimated_time.strftime('%H:%M') if order.estimated_time else '',
                order.special_instructions,
            ])
        return response

    @action(detail=False, methods=['get'])
    def export_detailed(self, request):
        status_filter = request.query_params.get('status')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        queryset = GuestOrder.objects.prefetch_related('items').all()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="guest_orders_detailed.csv"'
        writer = csv.writer(response)
        writer.writerow(['Order ID', 'Guest Name', 'Phone', 'Item Name', 'Qty', 'Price', 'Subtotal', 'Status', 'Created At'])

        for order in queryset:
            for item in order.items.all():
                writer.writerow([
                    order.order_number,
                    order.guest_name,
                    order.phone,
                    item.name,
                    item.qty,
                    item.price,
                    item.subtotal,
                    order.status,
                    order.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                ])
        return response


class MenuViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def available(self, request):
        slot = request.query_params.get('slot')
        category = request.query_params.get('category')
        search = request.query_params.get('search')
        day = request.query_params.get('day', date.today().strftime('%a')[:3])

        queryset = MenuOrderItem.objects.filter(is_available=True, is_active=True)
        if slot:
            normalized_slot = slot.strip().upper()
            if normalized_slot in {'BREAKFAST', 'MEAL'}:
                queryset = queryset.filter(item_type=normalized_slot)
        if category:
            queryset = queryset.filter(category__name__iexact=category)
        if search:
            queryset = queryset.filter(name__icontains=search)

        serializer = MenuItemSerializer(queryset, many=True)
        return Response({'results': serializer.data})

    @action(detail=False, methods=['get'])
    def slots(self, request):
        slots = [choice[0] for choice in MenuOrderItem.ITEM_TYPE_CHOICES]
        return Response({'slots': slots})
