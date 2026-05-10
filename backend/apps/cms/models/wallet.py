import uuid

from django.db import models


class EmployeeWallet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.OneToOneField(
        'accounts.Employee',
        on_delete=models.CASCADE,
        related_name='canteen_wallet',
    )
    company = models.ForeignKey(
        'accounts.Company',
        on_delete=models.CASCADE,
        related_name='canteen_wallets',
    )
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    last_recharged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cms_employee_wallets'
        indexes = [
            models.Index(fields=['company_id', 'is_active'], name='idx_wallet_company_active'),
        ]

    def __str__(self):
        return f"{self.employee_id} wallet"


class WalletTransaction(models.Model):
    TYPE_CREDIT = 'CREDIT'
    TYPE_DEBIT = 'DEBIT'
    TYPE_REFUND = 'REFUND'
    TYPE_ADJUSTMENT = 'ADJUSTMENT'

    TYPE_CHOICES = [
        (TYPE_CREDIT, 'Credit'),
        (TYPE_DEBIT, 'Debit'),
        (TYPE_REFUND, 'Refund'),
        (TYPE_ADJUSTMENT, 'Adjustment'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(
        EmployeeWallet,
        on_delete=models.CASCADE,
        related_name='transactions',
    )
    employee = models.ForeignKey(
        'accounts.Employee',
        on_delete=models.CASCADE,
        related_name='wallet_transactions',
    )
    order = models.ForeignKey(
        'cms.CmsOrder',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='wallet_transactions',
    )
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_before = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=100, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cms_wallet_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee_id', 'created_at'], name='idx_wallet_tx_employee_created'),
            models.Index(fields=['transaction_type', 'created_at'], name='idx_wallet_tx_type_created'),
        ]

    def __str__(self):
        return f"{self.transaction_type} {self.amount} for {self.employee_id}"
