from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.cms.models import CmsOrder, CmsOrderItem, EmployeeWallet, MenuItemSlotConfig, MenuOrderItem, WalletTransaction


ACTIVE_ORDER_STATUSES = {
    CmsOrder.STATUS_PENDING,
    CmsOrder.STATUS_ACCEPTED,
    CmsOrder.STATUS_PREPARING,
    CmsOrder.STATUS_PREPARED,
    CmsOrder.STATUS_COLLECTED,
}


def get_or_create_wallet(employee):
    wallet, _ = EmployeeWallet.objects.get_or_create(
        employee=employee,
        defaults={
            'company': employee.company,
            'balance': Decimal('0.00'),
        },
    )
    return wallet


def record_wallet_transaction(*, wallet, employee, transaction_type, amount, reference='', notes='', order=None):
    amount = Decimal(amount)
    before = Decimal(wallet.balance)

    if transaction_type == WalletTransaction.TYPE_DEBIT:
        after = before - amount
    else:
        after = before + amount

    wallet.balance = after
    if transaction_type == WalletTransaction.TYPE_CREDIT:
        wallet.last_recharged_at = timezone.now()
        wallet.save(update_fields=['balance', 'last_recharged_at', 'updated_at'])
    else:
        wallet.save(update_fields=['balance', 'updated_at'])

    return WalletTransaction.objects.create(
        wallet=wallet,
        employee=employee,
        order=order,
        transaction_type=transaction_type,
        amount=amount,
        balance_before=before,
        balance_after=after,
        reference=reference,
        notes=notes,
    )


def generate_order_code():
    today = timezone.localdate().strftime('%Y%m%d')
    prefix = f'CX-{today}-'
    latest = CmsOrder.objects.filter(order_code__startswith=prefix).order_by('-order_code').first()
    next_number = 1
    if latest:
        try:
            next_number = int(latest.order_code.split('-')[-1]) + 1
        except (TypeError, ValueError):
            next_number = 1
    return f'{prefix}{next_number:04d}'


def _sum_existing_quantity(*, employee, canteen, slot_id, menu_item, order_date, statuses):
    aggregate = (
        CmsOrderItem.objects.filter(
            order__employee=employee,
            order__canteen=canteen,
            order__slot_id=slot_id,
            order__order_date=order_date,
            order__status__in=statuses,
            menu_item=menu_item,
        )
        .aggregate(total=Sum('quantity'))
    )
    return int(aggregate['total'] or 0)


def _sum_slot_consumption(*, canteen, slot_id, menu_item, order_date, statuses):
    aggregate = (
        CmsOrderItem.objects.filter(
            order__canteen=canteen,
            order__slot_id=slot_id,
            order__order_date=order_date,
            order__status__in=statuses,
            menu_item=menu_item,
        )
        .aggregate(total=Sum('quantity'))
    )
    return int(aggregate['total'] or 0)


@transaction.atomic
def place_employee_order(*, employee, canteen, slot_id, items_payload, payment_mode=CmsOrder.PAYMENT_WALLET):
    slot_configs = {
        config.menu_item_id: config
        for config in MenuItemSlotConfig.objects.select_for_update().filter(
            canteen=canteen,
            slot_id=slot_id,
            is_active=True,
        )
    }
    if not slot_configs:
        raise ValueError('No active slot configuration found for this slot.')

    menu_items = {
        item.id: item
        for item in MenuOrderItem.objects.select_for_update().filter(
            id__in=[row['menu_item_id'] for row in items_payload],
            canteen=canteen,
            is_available=True,
            is_active=True,
        )
    }

    if len(menu_items) != len(items_payload):
        raise ValueError('One or more menu items are unavailable.')

    today = timezone.localdate()
    subtotal = Decimal('0.00')
    order_lines = []
    first_slot = None

    for row in items_payload:
        menu_item = menu_items[row['menu_item_id']]
        config = slot_configs.get(menu_item.id)
        if config is None:
            raise ValueError(f'{menu_item.name} is not available in this slot.')

        qty = int(row['quantity'])
        if qty <= 0:
            raise ValueError(f'Invalid quantity for {menu_item.name}.')
        if qty > config.max_qty_per_order:
            raise ValueError(f'{menu_item.name} exceeds the per-order limit for this slot.')

        employee_existing = _sum_existing_quantity(
            employee=employee,
            canteen=canteen,
            slot_id=slot_id,
            menu_item=menu_item,
            order_date=today,
            statuses=ACTIVE_ORDER_STATUSES - {CmsOrder.STATUS_CANCELLED},
        )
        if employee_existing + qty > config.max_qty_per_person:
            raise ValueError(f'{menu_item.name} exceeds the per-person limit for this slot.')

        if config.max_qty_per_day is not None and employee_existing + qty > config.max_qty_per_day:
            raise ValueError(f'{menu_item.name} exceeds the daily limit for this slot.')

        slot_consumed = _sum_slot_consumption(
            canteen=canteen,
            slot_id=slot_id,
            menu_item=menu_item,
            order_date=today,
            statuses=ACTIVE_ORDER_STATUSES - {CmsOrder.STATUS_CANCELLED},
        )
        if slot_consumed + qty > config.quantity_per_slot:
            raise ValueError(f'Only {max(config.quantity_per_slot - slot_consumed, 0)} {menu_item.name} left in this slot.')

        line_total = Decimal(menu_item.base_price) * qty
        subtotal += line_total
        order_lines.append((menu_item, qty, line_total))
        first_slot = config

    wallet = get_or_create_wallet(employee)
    deduction_amount = subtotal if payment_mode == CmsOrder.PAYMENT_WALLET else Decimal('0.00')
    if payment_mode == CmsOrder.PAYMENT_WALLET and wallet.balance < subtotal:
        raise ValueError('Insufficient wallet balance.')

    now = timezone.now()
    order = CmsOrder.objects.create(
        order_code=generate_order_code(),
        employee=employee,
        canteen=canteen,
        slot_id=slot_id,
        slot_name=first_slot.slot_name or slot_id,
        slot_start=first_slot.slot_start_time,
        slot_end=first_slot.slot_end_time,
        order_date=today,
        status=CmsOrder.STATUS_PENDING,
        payment_mode=payment_mode,
        subtotal=subtotal,
        tax_amount=Decimal('0.00'),
        total_amount=subtotal,
        deduction_amount=deduction_amount,
        placed_at=now,
        billing_period=today.strftime('%Y-%m'),
    )

    CmsOrderItem.objects.bulk_create(
        [
            CmsOrderItem(
                order=order,
                menu_item=menu_item,
                item_name_snapshot=menu_item.name,
                unit_price=menu_item.base_price,
                base_price_snapshot=menu_item.base_price,
                pricing_rule='',
                quantity=qty,
                line_total=line_total,
            )
            for menu_item, qty, line_total in order_lines
        ]
    )

    if payment_mode == CmsOrder.PAYMENT_WALLET:
        record_wallet_transaction(
            wallet=wallet,
            employee=employee,
            transaction_type=WalletTransaction.TYPE_DEBIT,
            amount=subtotal,
            reference=order.order_code,
            notes=f'Order payment for {order.order_code}',
            order=order,
        )

    return order


@transaction.atomic
def cancel_order_with_refund(*, order, reason=''):
    if order.status not in {CmsOrder.STATUS_PENDING, CmsOrder.STATUS_ACCEPTED}:
        raise ValueError('This order can no longer be cancelled.')

    if order.status == CmsOrder.STATUS_CANCELLED:
        return order

    order.status = CmsOrder.STATUS_CANCELLED
    order.cancelled_at = timezone.now()
    order.cancellation_reason = reason or order.cancellation_reason
    order.save(update_fields=['status', 'cancelled_at', 'cancellation_reason', 'updated_at'])

    if order.payment_mode == CmsOrder.PAYMENT_WALLET:
        refund_exists = order.wallet_transactions.filter(transaction_type=WalletTransaction.TYPE_REFUND).exists()
        if not refund_exists:
            wallet = get_or_create_wallet(order.employee)
            record_wallet_transaction(
                wallet=wallet,
                employee=order.employee,
                transaction_type=WalletTransaction.TYPE_REFUND,
                amount=order.deduction_amount,
                reference=order.order_code,
                notes=f'Refund for cancelled order {order.order_code}',
                order=order,
            )

    return order
