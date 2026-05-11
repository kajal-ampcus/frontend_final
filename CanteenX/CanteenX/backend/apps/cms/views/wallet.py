import csv
from decimal import Decimal

from django.db.models import Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.cms.models.wallet import WalletTransaction, WalletTransactionType
from apps.cms.services.wallet import credit_wallet, get_or_create_wallet
from apps.cms.views.employee_order import _current_employee
from apps.common.permissions import IsEmployeeOrAdmin


def _serialize_transaction(transaction):
    return {
        'id': str(transaction.id),
        'customerId': str(transaction.employee_id),
        'type': 'credit' if transaction.transaction_type == WalletTransactionType.CREDIT else 'debit',
        'amount': float(transaction.amount),
        'balance': float(transaction.balance_after),
        'description': transaction.description,
        'reference': transaction.reference,
        'orderId': str(transaction.order_id) if transaction.order_id else None,
        'createdAt': transaction.created_at.isoformat(),
    }


def _date_range(request):
    start = request.query_params.get('start')
    end = request.query_params.get('end')
    qs_filter = {}
    if start:
        qs_filter['created_at__date__gte'] = start
    if end:
        qs_filter['created_at__date__lte'] = end
    return qs_filter


def _wallet_payload(request, employee):
    wallet = get_or_create_wallet(employee)
    txns = WalletTransaction.objects.filter(employee=employee).select_related('order')
    txns = txns.filter(**_date_range(request))

    month_start = timezone.localdate().replace(day=1)
    monthly_totals = (
        WalletTransaction.objects
        .filter(
            employee=employee,
            created_at__date__gte=month_start,
        )
        .aggregate(
            debits=Sum('amount', filter=Q(transaction_type=WalletTransactionType.DEBIT)),
            credits=Sum('amount', filter=Q(transaction_type=WalletTransactionType.CREDIT)),
        )
    )
    monthly_spent = (monthly_totals['debits'] or Decimal('0')) - (monthly_totals['credits'] or Decimal('0'))
    if monthly_spent < 0:
        monthly_spent = Decimal('0')

    return {
        'id': str(wallet.id),
        'employee': str(employee.id),
        'balance': float(wallet.balance),
        'monthlySpent': float(monthly_spent),
        'lastRechargedAt': wallet.last_recharged_at.isoformat() if wallet.last_recharged_at else None,
        'transactions': [_serialize_transaction(txn) for txn in txns],
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsEmployeeOrAdmin])
def employee_wallet_view(request):
    employee = _current_employee(request)
    if employee is None:
        return Response({'detail': 'Employee profile not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(_wallet_payload(request, employee), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsEmployeeOrAdmin])
def employee_wallet_recharge_view(request):
    employee = _current_employee(request)
    if employee is None:
        return Response({'detail': 'Employee profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        amount = Decimal(str(request.data.get('amount')))
    except Exception:
        return Response({'amount': 'Valid amount is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if amount <= 0:
        return Response({'amount': 'Amount must be positive.'}, status=status.HTTP_400_BAD_REQUEST)

    credit_wallet(
        employee=employee,
        amount=amount,
        description='Wallet top-up',
        reference=f"TOPUP-{timezone.now().strftime('%Y%m%d%H%M%S')}",
    )
    return Response(_wallet_payload(request, employee), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsEmployeeOrAdmin])
def employee_wallet_export_view(request):
    employee = _current_employee(request)
    if employee is None:
        return Response({'detail': 'Employee profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    transactions = (
        WalletTransaction.objects
        .filter(employee=employee)
        .filter(**_date_range(request))
        .order_by('-created_at')
    )

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="wallet-transactions.csv"'
    writer = csv.writer(response)
    writer.writerow(['Date', 'Type', 'Description', 'Reference', 'Amount', 'Balance'])
    for txn in transactions:
        writer.writerow([
            txn.created_at.isoformat(),
            txn.transaction_type,
            txn.description,
            txn.reference or '-',
            str(txn.amount),
            str(txn.balance_after),
        ])
    return response
