import secrets
import uuid
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Employee, RoleChoices
from apps.cms.models.canteen import CanteenLocation
from apps.cms.models.menu import CanteenMenuItem
from apps.cms.models.order import ChangedByRole, Order, OrderItem, OrderStatus, OrderStatusLog
from apps.cms.models.slot import MealSlot, SlotMenuItem
from apps.cms.services.wallet import InsufficientWalletBalance, debit_wallet, get_or_create_wallet
from apps.common.permissions import IsEmployeeOrAdmin


def _token_value(request, key):
    try:
        return request.auth.get(key) if request.auth else None
    except Exception:
        return None


def _current_employee(request):
    employee_id = _token_value(request, 'employee_id')
    if not employee_id:
        return None
    return (
        Employee.objects
        .select_related('company', 'department')
        .filter(id=employee_id, is_active=True)
        .first()
    )


def _current_canteen(request, employee):
    company_id = getattr(request, 'tenant_company_id', None) or _token_value(request, 'company_id')
    if not company_id and employee and employee.company_id:
        company_id = employee.company_id

    qs = CanteenLocation.objects.filter(is_active=True, deleted_at__isnull=True)
    if company_id:
        qs = qs.filter(company_id=company_id)

    return qs.order_by('name').first()


def _photo_url(request, item):
    if not item.photo:
        return None
    try:
        return request.build_absolute_uri(item.photo.url)
    except Exception:
        return item.photo.url


def _frontend_category(category_name, is_veg):
    normalized = (category_name or '').strip().lower()
    if normalized in {'veg', 'vegetarian'} or is_veg:
        return 'Veg'
    if normalized in {'non veg', 'non-veg', 'nonveg'}:
        return 'Non-Veg'
    if normalized in {'beverage', 'beverages', 'drink', 'drinks'}:
        return 'Beverages'
    if normalized in {'dessert', 'desserts'}:
        return 'Desserts'
    if normalized in {'snack', 'snacks'}:
        return 'Snacks'
    return 'Veg' if is_veg else 'Non-Veg'


def _slot_type_name(slot):
    return 'Breakfast' if slot.meal_type == CanteenMenuItem.ITEM_TYPE_BREAKFAST else 'Meal'


def _slot_status(slot):
    today = timezone.localdate()
    now = timezone.localtime().time()
    if not slot.is_active or slot.date < today or slot.label == 'CLOSED':
        return 'expired'
    if slot.date > today or now < slot.start_time:
        return 'upcoming'
    if slot.start_time <= now <= slot.end_time:
        return 'active'
    return 'expired'


def _serialize_slot(slot, item_ids=None):
    start = slot.start_time.strftime('%H:%M')
    end = slot.end_time.strftime('%H:%M')
    return {
        'id': str(slot.id),
        'name': slot.name,
        'startTime': start,
        'endTime': end,
        'status': _slot_status(slot),
        'date': slot.date.isoformat(),
        'type': _slot_type_name(slot),
        'displayTime': f"{start} - {end}",
        'active': bool(slot.is_active),
        'capacity': slot.capacity,
        'menuItemIds': item_ids or [],
        'disabledItemIds': [],
    }


def _serialize_menu_item(request, item, assigned_slots):
    primary_slot = assigned_slots[0] if assigned_slots else None
    type_name = 'Breakfast' if item.item_type == CanteenMenuItem.ITEM_TYPE_BREAKFAST else 'Meal'
    return {
        'id': str(item.id),
        'name': item.name,
        'description': item.description or '',
        'price': float(item.base_price),
        'category': _frontend_category(item.category.name if item.category else '', item.is_veg),
        'type': type_name,
        'available': bool(item.is_available and item.is_active),
        'image': _photo_url(request, item),
        'tag': item.display_tag or '',
        'slot': primary_slot.name if primary_slot else '',
        'slotId': str(primary_slot.id) if primary_slot else '',
        'live': bool(item.is_available and item.is_active),
    }


def _status_to_frontend(value):
    return {
        OrderStatus.PLACED: 'pending',
        OrderStatus.PREPARING: 'preparing',
        OrderStatus.READY: 'ready',
        OrderStatus.DELIVERED: 'delivered',
        OrderStatus.CANCELLED: 'cancelled',
    }.get(value, 'pending')


def _generate_order_code():
    for _ in range(8):
        code = f"CMS-{secrets.token_hex(3).upper()}"
        if not Order.objects.filter(order_code=code).exists():
            return code
    return f"CMS-{uuid.uuid4().hex[:8].upper()}"


def _serialize_order(order):
    try:
        slot = order.slot
    except MealSlot.DoesNotExist:
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
        'customerName': employee.full_name,
        'department': employee.department.name if employee.department else '',
        'slotId': str(order.slot_id),
        'slotName': slot.name if slot else 'Slot',
        'items': items,
        'subtotal': float(order.subtotal),
        'tax': 0,
        'total': float(order.total_amount),
        'totalAmount': float(order.total_amount),
        'status': _status_to_frontend(order.status),
        'paymentMethod': 'wallet',
        'createdAt': order.placed_at.isoformat(),
        'updatedAt': order.updated_at.isoformat(),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsEmployeeOrAdmin])
def employee_menu_view(request):
    employee = _current_employee(request)
    role_type = _token_value(request, 'role_type')
    if employee is None and role_type == RoleChoices.EMPLOYEE:
        return Response({'detail': 'Employee profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    canteen = _current_canteen(request, employee)
    if canteen is None:
        return Response({'detail': 'No active canteen found.'}, status=status.HTTP_404_NOT_FOUND)

    slots = list(
        MealSlot.objects
        .filter(canteen=canteen, date=timezone.localdate(), is_active=True)
        .exclude(label='CLOSED')
        .prefetch_related('slot_items')
        .order_by('start_time', 'name')
    )

    slot_items = list(
        SlotMenuItem.objects
        .filter(slot__in=slots, is_enabled=True)
        .select_related('slot')
        .order_by('slot__start_time')
    )
    item_ids = {row.menu_item_id for row in slot_items}
    items = list(
        CanteenMenuItem.objects
        .filter(id__in=item_ids, canteen=canteen, is_active=True, is_available=True)
        .select_related('category')
        .order_by('item_type', 'name')
    )
    item_by_id = {item.id: item for item in items}
    item_ids_by_slot = {str(slot.id): [] for slot in slots}
    slots_by_item_id = {}

    for row in slot_items:
        item = item_by_id.get(row.menu_item_id)
        if item is None:
            continue
        item_ids_by_slot.setdefault(str(row.slot_id), []).append(str(row.menu_item_id))
        slots_by_item_id.setdefault(str(row.menu_item_id), []).append(row.slot)

    serialized_items = [
        _serialize_menu_item(request, item, slots_by_item_id.get(str(item.id), []))
        for item in items
        if str(item.id) in slots_by_item_id
    ]

    serialized_slots = [
        _serialize_slot(slot, item_ids_by_slot.get(str(slot.id), []))
        for slot in slots
    ]

    return Response(
        {
            'canteen': {'id': str(canteen.id), 'name': canteen.name},
            'slots': serialized_slots,
            'items': serialized_items,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsEmployeeOrAdmin])
def employee_orders_view(request):
    employee = _current_employee(request)
    if employee is None:
        return Response({'detail': 'Employee profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    canteen = _current_canteen(request, employee)
    if canteen is None:
        return Response({'detail': 'No active canteen found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        orders = (
            Order.objects
            .filter(employee=employee)
            .select_related('employee', 'employee__department')
            .prefetch_related('items')
            .order_by('-placed_at')
        )
        return Response({'results': [_serialize_order(order) for order in orders]}, status=status.HTTP_200_OK)

    slot_id = str(request.data.get('slot_id') or '').strip()
    try:
        slot = MealSlot.objects.get(id=slot_id, canteen=canteen, is_active=True)
    except (MealSlot.DoesNotExist, ValueError):
        return Response({'slot_id': 'A valid slot_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if _slot_status(slot) == 'expired':
        return Response({'slot_id': 'This slot is closed for ordering.'}, status=status.HTTP_400_BAD_REQUEST)

    payload_items = request.data.get('items')
    if not isinstance(payload_items, list) or not payload_items:
        return Response({'items': 'At least one item is required.'}, status=status.HTTP_400_BAD_REQUEST)

    quantities_by_item_id = {}
    for row in payload_items:
        menu_item_id = str((row or {}).get('menu_item_id') or '').strip()
        try:
            quantity = int((row or {}).get('quantity', 1))
        except (TypeError, ValueError):
            quantity = 0
        if not menu_item_id or quantity <= 0:
            return Response({'items': 'Each item needs menu_item_id and positive quantity.'}, status=status.HTTP_400_BAD_REQUEST)
        quantities_by_item_id[menu_item_id] = quantities_by_item_id.get(menu_item_id, 0) + quantity

    menu_items = {
        str(item.id): item
        for item in CanteenMenuItem.objects.filter(
            id__in=quantities_by_item_id.keys(),
            canteen=canteen,
            is_active=True,
            is_available=True,
        ).select_related('category')
    }
    if len(menu_items) != len(quantities_by_item_id):
        return Response({'items': 'One or more menu items are unavailable.'}, status=status.HTTP_400_BAD_REQUEST)

    enabled_item_ids = {
        str(row.menu_item_id)
        for row in SlotMenuItem.objects.filter(
            slot=slot,
            is_enabled=True,
            menu_item_id__in=quantities_by_item_id.keys(),
        )
    }
    if enabled_item_ids != set(quantities_by_item_id.keys()):
        return Response({'items': 'One or more items are not assigned to this slot.'}, status=status.HTTP_400_BAD_REQUEST)

    wrong_slot_items = [item.name for item in menu_items.values() if item.item_type != slot.meal_type]
    if wrong_slot_items:
        return Response(
            {'items': f"Items do not belong to {slot.name}: {', '.join(wrong_slot_items)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        wallet = get_or_create_wallet(employee)
        subtotal = sum(
            menu_items[item_id].base_price * Decimal(quantity)
            for item_id, quantity in quantities_by_item_id.items()
        )
        if wallet.balance < subtotal:
            return Response({'detail': 'Insufficient wallet balance.'}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.create(
            order_code=_generate_order_code(),
            employee=employee,
            canteen=canteen,
            slot=slot,
            order_date=timezone.localdate(),
            status=OrderStatus.PLACED,
            subtotal=subtotal,
            total_amount=subtotal,
        )

        for item_id, quantity in quantities_by_item_id.items():
            menu_item = menu_items[item_id]
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                item_name_snapshot=menu_item.name,
                unit_price=menu_item.base_price,
                base_price_snapshot=menu_item.base_price,
                quantity=quantity,
            )

        OrderStatusLog.objects.create(
            order=order,
            from_status=None,
            to_status=OrderStatus.PLACED,
            changed_by=employee,
            changed_by_role=ChangedByRole.EMPLOYEE,
            note='Order placed by employee.',
        )

        try:
            debit_wallet(
                employee=employee,
                amount=subtotal,
                description=f"Order payment for {slot.name}",
                reference=order.order_code,
                order=order,
            )
        except InsufficientWalletBalance:
            return Response({'detail': 'Insufficient wallet balance.'}, status=status.HTTP_400_BAD_REQUEST)

    order = (
        Order.objects
        .select_related('employee', 'employee__department')
        .prefetch_related('items')
        .get(pk=order.pk)
    )
    return Response(_serialize_order(order), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsEmployeeOrAdmin])
def employee_order_cancel_view(request, order_id):
    employee = _current_employee(request)
    if employee is None:
        return Response({'detail': 'Employee profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        order = (
            Order.objects
            .select_related('employee', 'employee__department')
            .prefetch_related('items')
            .get(id=order_id, employee=employee)
        )
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not order.can_cancel:
        return Response({'detail': 'Only placed orders can be cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

    previous_status = order.status
    order.status = OrderStatus.CANCELLED
    order.cancelled_at = timezone.now()
    order.cancelled_by = employee
    order.cancellation_reason = request.data.get('reason') or 'Cancelled by employee.'
    order.save(update_fields=['status', 'cancelled_at', 'cancelled_by', 'cancellation_reason', 'updated_at'])

    OrderStatusLog.objects.create(
        order=order,
        from_status=previous_status,
        to_status=OrderStatus.CANCELLED,
        changed_by=employee,
        changed_by_role=ChangedByRole.EMPLOYEE,
        note=order.cancellation_reason,
    )

    from apps.cms.services.wallet import credit_wallet
    if order.wallet_transactions.filter(transaction_type='DEBIT').exists():
        credit_wallet(
            employee=employee,
            amount=order.total_amount,
            description=f"Refund for cancelled order {order.order_code}",
            reference=f"REFUND-{order.order_code}",
            order=order,
        )

    return Response(_serialize_order(order), status=status.HTTP_200_OK)
