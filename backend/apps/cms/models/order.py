import uuid

from django.db import models


class CmsOrder(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_ACCEPTED = 'ACCEPTED'
    STATUS_PREPARING = 'PREPARING'
    STATUS_PREPARED = 'PREPARED'
    STATUS_COLLECTED = 'COLLECTED'
    STATUS_CANCELLED = 'CANCELLED'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_ACCEPTED, 'Accepted'),
        (STATUS_PREPARING, 'Preparing'),
        (STATUS_PREPARED, 'Prepared'),
        (STATUS_COLLECTED, 'Collected'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    PAYMENT_WALLET = 'WALLET'
    PAYMENT_SALARY = 'SALARY'
    PAYMENT_CASH = 'CASH'

    PAYMENT_CHOICES = [
        (PAYMENT_WALLET, 'Wallet'),
        (PAYMENT_SALARY, 'Salary'),
        (PAYMENT_CASH, 'Cash'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_code = models.CharField(max_length=50, unique=True, db_index=True)

    employee = models.ForeignKey(
        'accounts.Employee',
        on_delete=models.PROTECT,
        related_name='canteen_orders',
    )
    canteen = models.ForeignKey(
        'cms.CanteenLocation',
        on_delete=models.PROTECT,
        related_name='orders',
    )

    slot_id = models.CharField(max_length=100, db_index=True)
    slot_name = models.CharField(max_length=100)
    slot_start = models.TimeField(null=True, blank=True)
    slot_end = models.TimeField(null=True, blank=True)

    order_date = models.DateField(db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    payment_mode = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default=PAYMENT_WALLET)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deduction_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    placed_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    prepared_at = models.DateTimeField(null=True, blank=True)
    collected_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True, default='')

    billing_period = models.CharField(max_length=7, blank=True, default='')
    is_billed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cms_orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['canteen_id', 'order_date', 'status'], name='idx_order_canteen_date_status'),
            models.Index(fields=['employee_id', 'order_date'], name='idx_order_employee_date'),
            models.Index(fields=['slot_id', 'order_date', 'status'], name='idx_order_slot_date_status'),
        ]

    def __str__(self):
        return self.order_code

    @property
    def can_cancel(self):
        return self.status in {self.STATUS_PENDING, self.STATUS_ACCEPTED}


class CmsOrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        CmsOrder,
        on_delete=models.CASCADE,
        related_name='order_items',
    )
    menu_item = models.ForeignKey(
        'cms.MenuOrderItem',
        on_delete=models.PROTECT,
        related_name='ordered_items',
    )
    item_name_snapshot = models.CharField(max_length=200)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    base_price_snapshot = models.DecimalField(max_digits=12, decimal_places=2)
    pricing_rule = models.CharField(max_length=100, blank=True, default='')
    quantity = models.PositiveIntegerField()
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'cms_order_items'

    def __str__(self):
        return f"{self.item_name_snapshot} x {self.quantity}"
