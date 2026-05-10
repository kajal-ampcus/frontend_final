from decimal import Decimal

from rest_framework import serializers

from apps.cms.models import CmsOrder, CmsOrderItem, EmployeeWallet, TimeSlot, WalletTransaction


class CmsOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CmsOrderItem
        fields = [
            'id',
            'menu_item',
            'item_name_snapshot',
            'unit_price',
            'base_price_snapshot',
            'pricing_rule',
            'quantity',
            'line_total',
        ]


class CmsOrderSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    canteen_name = serializers.CharField(source='canteen.name', read_only=True)
    can_cancel = serializers.BooleanField(read_only=True)
    order_items = CmsOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = CmsOrder
        fields = [
            'id',
            'order_code',
            'employee',
            'employee_name',
            'employee_code',
            'canteen',
            'canteen_name',
            'slot_id',
            'slot_name',
            'slot_start',
            'slot_end',
            'order_date',
            'status',
            'subtotal',
            'tax_amount',
            'total_amount',
            'deduction_amount',
            'placed_at',
            'accepted_at',
            'prepared_at',
            'collected_at',
            'cancelled_at',
            'cancellation_reason',
            'billing_period',
            'is_billed',
            'can_cancel',
            'order_items',
            'created_at',
        ]


class PlaceOrderLineSerializer(serializers.Serializer):
    menu_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)


class PlaceOrderSerializer(serializers.Serializer):
    canteen_id = serializers.UUIDField(required=False)
    slot_id = serializers.CharField(max_length=100)
    payment_mode = serializers.ChoiceField(
        choices=[CmsOrder.PAYMENT_WALLET, CmsOrder.PAYMENT_SALARY, CmsOrder.PAYMENT_CASH],
        required=False,
        default=CmsOrder.PAYMENT_WALLET,
    )
    items = PlaceOrderLineSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('At least one item is required.')
        return value


class CancelOrderSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class UpdateOrderStatusSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class VerifyOrderCodeSerializer(serializers.Serializer):
    order_code = serializers.CharField(max_length=50)


class EmployeeWalletSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        model = EmployeeWallet
        fields = ['id', 'employee', 'balance', 'last_recharged_at', 'is_active']


class WalletTransactionSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    balance_before = serializers.DecimalField(max_digits=12, decimal_places=2)
    balance_after = serializers.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        model = WalletTransaction
        fields = [
            'id',
            'transaction_type',
            'amount',
            'balance_before',
            'balance_after',
            'reference',
            'notes',
            'created_at',
        ]


class RechargeWalletSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    method = serializers.ChoiceField(choices=['UPI', 'SALARY'])
    upi_ref = serializers.CharField(required=False, allow_blank=True)


class TimeSlotSerializer(serializers.ModelSerializer):
    canteen_name = serializers.CharField(source='canteen.name', read_only=True)
    slot_type_name = serializers.CharField(source='get_slot_type_display', read_only=True)
    slot_type_category = serializers.SerializerMethodField()
    current_order_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = TimeSlot
        fields = [
            'id',
            'canteen',
            'canteen_name',
            'slot_type',
            'slot_type_name',
            'slot_type_category',
            'name',
            'start_time',
            'end_time',
            'ordering_opens_at',
            'ordering_deadline_time',
            'cancellation_deadline_time',
            'max_orders',
            'applicable_days',
            'display_color',
            'is_active',
            'current_order_count',
        ]

    def get_slot_type_category(self, obj):
        return 'MEAL'


class TimeSlotWriteSerializer(serializers.ModelSerializer):
    canteen_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = TimeSlot
        fields = [
            'canteen_id',
            'name',
            'slot_type',
            'start_time',
            'end_time',
            'ordering_opens_at',
            'ordering_deadline_time',
            'cancellation_deadline_time',
            'max_orders',
            'applicable_days',
            'display_color',
            'is_active',
        ]
        extra_kwargs = {
            'ordering_opens_at': {'required': False, 'allow_null': True},
            'max_orders': {'required': False, 'allow_null': True},
            'applicable_days': {'required': False},
            'display_color': {'required': False},
            'is_active': {'required': False},
        }

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Slot name is required.')
        return value

    def validate(self, attrs):
        canteen_id = attrs.get('canteen_id')
        instance_canteen_id = getattr(getattr(self.instance, 'canteen', None), 'id', None)
        start_time = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        end_time = attrs.get('end_time', getattr(self.instance, 'end_time', None))
        ordering_deadline_time = attrs.get(
            'ordering_deadline_time',
            getattr(self.instance, 'ordering_deadline_time', None),
        )
        cancellation_deadline_time = attrs.get(
            'cancellation_deadline_time',
            getattr(self.instance, 'cancellation_deadline_time', None),
        )

        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError({'end_time': 'End time must be after start time.'})
        if ordering_deadline_time and start_time and ordering_deadline_time > start_time:
            raise serializers.ValidationError({'ordering_deadline_time': 'Ordering deadline cannot be after start time.'})
        if cancellation_deadline_time and start_time and cancellation_deadline_time > start_time:
            raise serializers.ValidationError({'cancellation_deadline_time': 'Cancellation deadline cannot be after start time.'})

        applicable_days = attrs.get('applicable_days')
        if applicable_days is not None:
            if not isinstance(applicable_days, list) or not all(isinstance(day, int) and 1 <= day <= 7 for day in applicable_days):
                raise serializers.ValidationError({'applicable_days': 'Applicable days must be a list of integers from 1 to 7.'})

        name = attrs.get('name', getattr(self.instance, 'name', None))
        effective_canteen_id = canteen_id or instance_canteen_id
        if effective_canteen_id and name:
            qs = TimeSlot.objects.filter(canteen_id=effective_canteen_id, name__iexact=name.strip())
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'name': 'A slot with this name already exists for this canteen.'})

        return attrs
