from datetime import datetime, timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Employee, RoleChoices
from apps.cms.models import CanteenLocation, CmsOrder, EmployeeWallet, MenuItemSlotConfig, MenuOrderItem, TimeSlot, WalletTransaction
from apps.cms.serializers.menu import MenuItemSerializer
from apps.cms.serializers.order import (
    CancelOrderSerializer,
    CmsOrderSerializer,
    EmployeeWalletSerializer,
    PlaceOrderSerializer,
    RechargeWalletSerializer,
    TimeSlotSerializer,
    TimeSlotWriteSerializer,
    UpdateOrderStatusSerializer,
    VerifyOrderCodeSerializer,
    WalletTransactionSerializer,
)
from apps.cms.services.order_service import cancel_order_with_refund, get_or_create_wallet, place_employee_order, record_wallet_transaction


def _get_role(request):
    try:
        return request.auth.get('role_type') if request.auth else ''
    except Exception:
        return ''


def _get_employee(request):
    employee_id = request.auth.get('employee_id') if request.auth else None
    if not employee_id:
        return None
    try:
        return Employee.objects.select_related('company').get(id=employee_id, is_active=True)
    except Employee.DoesNotExist:
        return None


def _resolve_canteen(request, canteen_id=None):
    role = _get_role(request)
    # Try middleware-set company_id first, then fallback to JWT claim
    company_id = getattr(request, 'tenant_company_id', None)
    if not company_id and request.auth:
        company_id = request.auth.get('company_id')

    token_canteen_id = request.auth.get('canteen_id') if request.auth else None
    target_id = canteen_id or token_canteen_id or request.query_params.get('canteen_id') or request.data.get('canteen_id')

    filters = {
        'is_active': True,
        'deleted_at__isnull': True,
    }
    if target_id:
        filters['id'] = target_id
    if role != RoleChoices.SUPER_ADMIN and company_id:
        filters['company_id'] = company_id

    return CanteenLocation.objects.filter(**filters).order_by('name').first()


def _ensure_role(request, allowed_roles, message):
    if _get_role(request) not in allowed_roles:
        return Response({'detail': message}, status=status.HTTP_403_FORBIDDEN)
    return None


def _slot_type_label(slot_name, slot_id):
    base = (slot_name or slot_id or '').lower()
    if 'breakfast' in base:
        return 'BREAKFAST'
    if 'tea' in base or 'snack' in base:
        return 'SNACK'
    return 'MEAL'


class OrderViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        role = _get_role(request)
        canteen = _resolve_canteen(request)
        queryset = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items')

        if role == RoleChoices.EMPLOYEE:
            employee = _get_employee(request)
            if employee is None:
                return Response({'detail': 'Employee profile not found.'}, status=status.HTTP_403_FORBIDDEN)
            queryset = queryset.filter(employee=employee)
        elif role in {'KITCHEN', 'COUNTER'}:
            if canteen is None:
                return Response({'detail': 'Canteen not found.'}, status=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(canteen=canteen)
        elif role in RoleChoices.CMS_ADMIN_ROLES:
            if canteen is not None:
                queryset = queryset.filter(canteen=canteen)
        else:
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)

        status_filter = request.query_params.get('status')
        date_filter = request.query_params.get('date')
        slot_filter = request.query_params.get('slot_id')
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if date_filter:
            queryset = queryset.filter(order_date=date_filter)
        if slot_filter:
            queryset = queryset.filter(slot_id=slot_filter)

        serializer = CmsOrderSerializer(queryset.order_by('-created_at'), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, pk=None):
        queryset = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items')
        try:
            order = queryset.get(pk=pk)
        except CmsOrder.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        role = _get_role(request)
        if role == RoleChoices.EMPLOYEE:
            employee = _get_employee(request)
            if employee is None or order.employee_id != employee.id:
                return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(CmsOrderSerializer(order).data, status=status.HTTP_200_OK)

    def create(self, request):
        permission_error = _ensure_role(request, {RoleChoices.EMPLOYEE}, 'Employee access required.')
        if permission_error:
            return permission_error

        employee = _get_employee(request)
        if employee is None:
            return Response({'detail': 'Employee profile not found.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = PlaceOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        canteen = _resolve_canteen(request, serializer.validated_data.get('canteen_id'))
        if canteen is None:
            return Response({'detail': 'Canteen not found.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = place_employee_order(
                employee=employee,
                canteen=canteen,
                slot_id=serializer.validated_data['slot_id'],
                items_payload=serializer.validated_data['items'],
                payment_mode=serializer.validated_data.get('payment_mode', CmsOrder.PAYMENT_WALLET),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        order = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items').get(pk=order.pk)
        return Response(CmsOrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        serializer = CancelOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            order = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items').get(pk=pk)
        except CmsOrder.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        role = _get_role(request)
        if role == RoleChoices.EMPLOYEE:
            employee = _get_employee(request)
            if employee is None or order.employee_id != employee.id:
                return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        elif role not in {'KITCHEN', 'COUNTER', *RoleChoices.CMS_ADMIN_ROLES}:
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            order = cancel_order_with_refund(order=order, reason=serializer.validated_data.get('reason', ''))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        order = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items').get(pk=order.pk)
        return Response(CmsOrderSerializer(order).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        permission_error = _ensure_role(
            request,
            {'COUNTER', *RoleChoices.CMS_ADMIN_ROLES},
            'Counter or CMS Admin access required.',
        )
        if permission_error:
            return permission_error

        try:
            order = CmsOrder.objects.get(pk=pk)
        except CmsOrder.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != CmsOrder.STATUS_PENDING:
            return Response({'detail': 'Only pending orders can be accepted.'}, status=status.HTTP_400_BAD_REQUEST)

        order.status = CmsOrder.STATUS_ACCEPTED
        order.accepted_at = timezone.now()
        order.save(update_fields=['status', 'accepted_at', 'updated_at'])
        order = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items').get(pk=order.pk)
        return Response(CmsOrderSerializer(order).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        permission_error = _ensure_role(
            request,
            {'COUNTER', *RoleChoices.CMS_ADMIN_ROLES},
            'Counter or CMS Admin access required.',
        )
        if permission_error:
            return permission_error

        serializer = UpdateOrderStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            order = CmsOrder.objects.get(pk=pk)
        except CmsOrder.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            order = cancel_order_with_refund(order=order, reason=serializer.validated_data.get('reason', 'Rejected by counter'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        order = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items').get(pk=order.pk)
        return Response(CmsOrderSerializer(order).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='start-preparing')
    def start_preparing(self, request, pk=None):
        permission_error = _ensure_role(
            request,
            {'KITCHEN', *RoleChoices.CMS_ADMIN_ROLES},
            'Kitchen or CMS Admin access required.',
        )
        if permission_error:
            return permission_error

        try:
            order = CmsOrder.objects.get(pk=pk)
        except CmsOrder.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != CmsOrder.STATUS_ACCEPTED:
            return Response({'detail': 'Only accepted orders can move to preparing.'}, status=status.HTTP_400_BAD_REQUEST)

        order.status = CmsOrder.STATUS_PREPARING
        order.save(update_fields=['status', 'updated_at'])
        order = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items').get(pk=order.pk)
        return Response(CmsOrderSerializer(order).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='mark-prepared')
    def mark_prepared(self, request, pk=None):
        permission_error = _ensure_role(
            request,
            {'KITCHEN', *RoleChoices.CMS_ADMIN_ROLES},
            'Kitchen or CMS Admin access required.',
        )
        if permission_error:
            return permission_error

        try:
            order = CmsOrder.objects.get(pk=pk)
        except CmsOrder.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != CmsOrder.STATUS_PREPARING:
            return Response({'detail': 'Only preparing orders can be marked prepared.'}, status=status.HTTP_400_BAD_REQUEST)

        order.status = CmsOrder.STATUS_PREPARED
        order.prepared_at = timezone.now()
        order.save(update_fields=['status', 'prepared_at', 'updated_at'])
        order = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items').get(pk=order.pk)
        return Response(CmsOrderSerializer(order).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def collect(self, request, pk=None):
        permission_error = _ensure_role(
            request,
            {'COUNTER', *RoleChoices.CMS_ADMIN_ROLES},
            'Counter or CMS Admin access required.',
        )
        if permission_error:
            return permission_error

        try:
            order = CmsOrder.objects.get(pk=pk)
        except CmsOrder.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != CmsOrder.STATUS_PREPARED:
            return Response({'detail': 'Only prepared orders can be collected.'}, status=status.HTTP_400_BAD_REQUEST)

        order.status = CmsOrder.STATUS_COLLECTED
        order.collected_at = timezone.now()
        order.save(update_fields=['status', 'collected_at', 'updated_at'])
        order = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items').get(pk=order.pk)
        return Response(CmsOrderSerializer(order).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def verify(self, request):
        permission_error = _ensure_role(
            request,
            {'COUNTER', *RoleChoices.CMS_ADMIN_ROLES},
            'Counter or CMS Admin access required.',
        )
        if permission_error:
            return permission_error

        serializer = VerifyOrderCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            order = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items').get(
                order_code__iexact=serializer.validated_data['order_code'].strip(),
            )
        except CmsOrder.DoesNotExist:
            return Response({'valid': False, 'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'valid': True, 'order': CmsOrderSerializer(order).data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='kitchen-board')
    def kitchen_board(self, request):
        permission_error = _ensure_role(
            request,
            {'KITCHEN', *RoleChoices.CMS_ADMIN_ROLES},
            'Kitchen or CMS Admin access required.',
        )
        if permission_error:
            return permission_error

        canteen = _resolve_canteen(request)
        if canteen is None:
            return Response({'detail': 'Canteen not found.'}, status=status.HTTP_400_BAD_REQUEST)

        orders = CmsOrder.objects.select_related('employee', 'canteen').prefetch_related('order_items').filter(
            canteen=canteen,
            status__in=[CmsOrder.STATUS_ACCEPTED, CmsOrder.STATUS_PREPARING, CmsOrder.STATUS_PREPARED],
        )
        return Response(
            {
                'accepted': CmsOrderSerializer(orders.filter(status=CmsOrder.STATUS_ACCEPTED), many=True).data,
                'preparing': CmsOrderSerializer(orders.filter(status=CmsOrder.STATUS_PREPARING), many=True).data,
                'prepared': CmsOrderSerializer(orders.filter(status=CmsOrder.STATUS_PREPARED), many=True).data,
                'timestamp': timezone.now().isoformat(),
            },
            status=status.HTTP_200_OK,
        )


class WalletViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _employee_or_error(self, request):
        employee = _get_employee(request)
        if employee is None:
            return None, Response({'detail': 'Employee profile not found.'}, status=status.HTTP_403_FORBIDDEN)
        return employee, None

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        permission_error = _ensure_role(request, {RoleChoices.EMPLOYEE}, 'Employee access required.')
        if permission_error:
            return permission_error
        employee, error = self._employee_or_error(request)
        if error:
            return error
        wallet = get_or_create_wallet(employee)
        return Response(EmployeeWalletSerializer(wallet).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def transactions(self, request):
        permission_error = _ensure_role(request, {RoleChoices.EMPLOYEE}, 'Employee access required.')
        if permission_error:
            return permission_error
        employee, error = self._employee_or_error(request)
        if error:
            return error
        wallet = get_or_create_wallet(employee)
        transactions = wallet.transactions.order_by('-created_at')
        return Response(WalletTransactionSerializer(transactions, many=True).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def recharge(self, request):
        permission_error = _ensure_role(request, {RoleChoices.EMPLOYEE}, 'Employee access required.')
        if permission_error:
            return permission_error
        employee, error = self._employee_or_error(request)
        if error:
            return error

        serializer = RechargeWalletSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet = get_or_create_wallet(employee)
        amount = serializer.validated_data['amount']
        method = serializer.validated_data['method']
        upi_ref = serializer.validated_data.get('upi_ref', '')

        record_wallet_transaction(
            wallet=wallet,
            employee=employee,
            transaction_type=WalletTransaction.TYPE_CREDIT,
            amount=amount,
            reference=upi_ref if method == 'UPI' else f'SALARY-{timezone.now().strftime("%Y%m%d%H%M%S")}',
            notes=f'Wallet recharge via {method}',
        )
        wallet.refresh_from_db()
        return Response(EmployeeWalletSerializer(wallet).data, status=status.HTTP_200_OK)


class SlotCatalogViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        canteen = _resolve_canteen(request)
        if canteen is None:
            return Response([], status=status.HTTP_200_OK)

        include_inactive = request.query_params.get('include_inactive', '').lower() == 'true'
        slot_queryset = TimeSlot.objects.filter(canteen=canteen)
        if not include_inactive:
            slot_queryset = slot_queryset.filter(is_active=True)

        today = timezone.localdate()
        active_counts = {
            row['slot_id']: row['count']
            for row in CmsOrder.objects.filter(
                canteen=canteen,
                order_date=today,
                status__in=[
                    CmsOrder.STATUS_PENDING,
                    CmsOrder.STATUS_ACCEPTED,
                    CmsOrder.STATUS_PREPARING,
                    CmsOrder.STATUS_PREPARED,
                    CmsOrder.STATUS_COLLECTED,
                ],
            )
            .values('slot_id')
            .annotate(count=Count('id'))
        }

        results = []
        now_time = timezone.localtime().time()
        today_weekday = timezone.localdate().isoweekday()

        for slot in slot_queryset.order_by('start_time', 'name'):
            payload = TimeSlotSerializer(slot).data
            payload['current_order_count'] = active_counts.get(str(slot.id), 0)
            payload['is_ordering_open'] = bool(
                slot.is_active
                and today_weekday in (slot.applicable_days or [])
                and now_time >= (slot.ordering_opens_at or slot.start_time)
                and now_time <= slot.ordering_deadline_time
            )
            results.append(payload)

        return Response(results, status=status.HTTP_200_OK)

    def create(self, request):
        permission_error = _ensure_role(
            request,
            set(RoleChoices.CMS_ADMIN_ROLES) | {RoleChoices.SUPER_ADMIN},
            'CMS Admin access required.',
        )
        if permission_error:
            return permission_error

        serializer = TimeSlotWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        canteen = _resolve_canteen(request, serializer.validated_data.get('canteen_id'))
        if canteen is None:
            return Response({'detail': 'Canteen not found.'}, status=status.HTTP_400_BAD_REQUEST)

        slot = TimeSlot.objects.create(
            canteen=canteen,
            name=serializer.validated_data['name'],
            slot_type=serializer.validated_data['slot_type'],
            start_time=serializer.validated_data['start_time'],
            end_time=serializer.validated_data['end_time'],
            ordering_opens_at=serializer.validated_data.get('ordering_opens_at'),
            ordering_deadline_time=serializer.validated_data['ordering_deadline_time'],
            cancellation_deadline_time=serializer.validated_data['cancellation_deadline_time'],
            max_orders=serializer.validated_data.get('max_orders'),
            applicable_days=serializer.validated_data.get('applicable_days', [1, 2, 3, 4, 5, 6, 7]),
            display_color=serializer.validated_data.get('display_color', '#3b82f6'),
            is_active=serializer.validated_data.get('is_active', True),
        )
        return Response(TimeSlotSerializer(slot).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        permission_error = _ensure_role(
            request,
            set(RoleChoices.CMS_ADMIN_ROLES) | {RoleChoices.SUPER_ADMIN},
            'CMS Admin access required.',
        )
        if permission_error:
            return permission_error

        try:
            slot = TimeSlot.objects.select_related('canteen').get(pk=pk)
        except TimeSlot.DoesNotExist:
            return Response({'detail': 'Slot not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = TimeSlotWriteSerializer(slot, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        MenuItemSlotConfig.objects.filter(canteen=slot.canteen, slot_id=str(slot.id)).update(
            slot_name=slot.name,
            slot_start_time=slot.start_time,
            slot_end_time=slot.end_time,
            updated_at=timezone.now(),
        )
        slot.refresh_from_db()
        return Response(TimeSlotSerializer(slot).data, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        permission_error = _ensure_role(
            request,
            set(RoleChoices.CMS_ADMIN_ROLES) | {RoleChoices.SUPER_ADMIN},
            'CMS Admin access required.',
        )
        if permission_error:
            return permission_error

        try:
            slot = TimeSlot.objects.select_related('canteen').get(pk=pk)
        except TimeSlot.DoesNotExist:
            return Response({'detail': 'Slot not found.'}, status=status.HTTP_404_NOT_FOUND)

        slot.is_active = False
        slot.save(update_fields=['is_active', 'updated_at'])
        MenuItemSlotConfig.objects.filter(canteen=slot.canteen, slot_id=str(slot.id)).update(
            is_active=False,
            updated_at=timezone.now(),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='menu')
    def menu(self, request):
        canteen = _resolve_canteen(request)
        slot_id = request.query_params.get('slot_id')
        if canteen is None or not slot_id:
            return Response([], status=status.HTTP_200_OK)

        menu_item_ids = list(
            MenuItemSlotConfig.objects.filter(canteen=canteen, slot_id=slot_id, is_active=True)
            .values_list('menu_item_id', flat=True)
        )
        items = (
            MenuOrderItem.objects.filter(
                canteen=canteen,
                id__in=menu_item_ids,
                is_active=True,
                is_available=True,
            )
            .select_related('category')
            .prefetch_related('slot_configs')
            .order_by('name')
        )
        serializer = MenuItemSerializer(items, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
