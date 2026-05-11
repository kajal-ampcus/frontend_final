from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Employee, RoleChoices
from apps.cms.models.order import ChangedByRole, Order, OrderStatus, OrderStatusLog


def _token_value(request, key):
    try:
        return request.auth.get(key) if request.auth else None
    except Exception:
        return None


def _role_type(request):
    return _token_value(request, 'role_type') or ''


def _is_counter_user(request):
    role = _role_type(request)
    return role == 'COUNTER' or role in RoleChoices.CMS_ADMIN_ROLES


def _current_employee(request):
    employee_id = _token_value(request, 'employee_id')
    if not employee_id:
        return None
    return Employee.objects.filter(id=employee_id, is_active=True).first()


def _changed_by_role(request):
    return ChangedByRole.COUNTER if _role_type(request) == 'COUNTER' else ChangedByRole.ADMIN


def _status_to_frontend(value):
    return {
        OrderStatus.PLACED: 'pending',
        OrderStatus.PREPARING: 'preparing',
        OrderStatus.READY: 'ready',
        OrderStatus.DELIVERED: 'delivered',
        OrderStatus.CANCELLED: 'cancelled',
    }.get(value, 'pending')


def _slot_display(slot):
    if slot is None:
        return ''
    return f"{slot.start_time.strftime('%H:%M')} - {slot.end_time.strftime('%H:%M')}"


def _serialize_counter_order(order):
    try:
        slot = order.slot
    except Exception:
        slot = None

    employee = order.employee
    items = [
        {
            'id': str(item.id),
            'orderId': str(order.id),
            'menuItemId': str(item.menu_item_id),
            'name': item.item_name_snapshot,
            'quantity': item.quantity,
            'unitPrice': float(item.unit_price),
            'price': float(item.unit_price),
            'totalPrice': float(item.line_total),
            'slotId': str(order.slot_id),
        }
        for item in order.items.all()
    ]

    return {
        'id': str(order.id),
        'orderNumber': order.order_code,
        'customerId': str(employee.id),
        'employeeCode': employee.employee_code,
        'customerName': employee.full_name,
        'department': employee.department.name if employee.department else '',
        'slotId': str(order.slot_id),
        'slotName': slot.name if slot else 'Slot',
        'slot': _slot_display(slot),
        'items': items,
        'subtotal': float(order.subtotal),
        'tax': 0,
        'total': float(order.total_amount),
        'totalAmount': float(order.total_amount),
        'status': _status_to_frontend(order.status),
        'rawStatus': order.status,
        'paymentMethod': 'wallet',
        'createdAt': order.placed_at.isoformat(),
        'updatedAt': order.updated_at.isoformat(),
        'collectedAt': order.collected_at.isoformat() if order.collected_at else None,
        'receiptPrintedAt': order.receipt_printed_at.isoformat() if order.receipt_printed_at else None,
    }


def _order_queryset(request):
    qs = (
        Order.objects
        .select_related('employee', 'employee__department', 'slot')
        .prefetch_related('items')
    )
    canteen_id = _token_value(request, 'canteen_id')
    company_id = _token_value(request, 'company_id')
    role = _role_type(request)

    if canteen_id:
        qs = qs.filter(canteen_id=canteen_id)
    elif company_id and role != RoleChoices.SUPER_ADMIN:
        qs = qs.filter(canteen__company_id=company_id)

    return qs


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def counter_order_lookup_view(request, order_code):
    if not _is_counter_user(request):
        return Response({'detail': 'Counter access required.'}, status=status.HTTP_403_FORBIDDEN)

    code = (order_code or '').strip().upper()
    order = _order_queryset(request).filter(order_code__iexact=code).first()
    if order is None:
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    return Response(_serialize_counter_order(order), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def counter_order_collect_view(request, order_id):
    if not _is_counter_user(request):
        return Response({'detail': 'Counter access required.'}, status=status.HTTP_403_FORBIDDEN)

    with transaction.atomic():
        order = _order_queryset(request).select_for_update().filter(id=order_id).first()
        if order is None:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        if order.status == OrderStatus.DELIVERED:
            order.receipt_printed_at = now
            order.save(update_fields=['receipt_printed_at', 'updated_at'])
            return Response(_serialize_counter_order(order), status=status.HTTP_200_OK)

        if order.status != OrderStatus.READY:
            return Response(
                {'detail': 'Only ready orders can be collected at the counter.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous_status = order.status
        order.status = OrderStatus.DELIVERED
        order.collected_at = now
        order.receipt_printed_at = now
        order.save(update_fields=['status', 'collected_at', 'receipt_printed_at', 'updated_at'])

        OrderStatusLog.objects.create(
            order=order,
            from_status=previous_status,
            to_status=OrderStatus.DELIVERED,
            changed_by=_current_employee(request),
            changed_by_role=_changed_by_role(request),
            note='Order collected and receipt printed at counter.',
        )

    return Response(_serialize_counter_order(order), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def counter_recent_collections_view(request):
    if not _is_counter_user(request):
        return Response({'detail': 'Counter access required.'}, status=status.HTTP_403_FORBIDDEN)

    orders = (
        _order_queryset(request)
        .filter(status=OrderStatus.DELIVERED, collected_at__date=timezone.localdate())
        .order_by('-collected_at')[:10]
    )
    return Response({'results': [_serialize_counter_order(order) for order in orders]}, status=status.HTTP_200_OK)
