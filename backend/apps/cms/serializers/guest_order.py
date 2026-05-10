from datetime import datetime, time
from rest_framework import serializers
from apps.cms.models import MenuOrderItem, GuestOrder, GuestOrderItem


class MenuItemSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(source='base_price', max_digits=10, decimal_places=2, read_only=True)
    category = serializers.CharField(source='category.name', read_only=True)
    slot = serializers.SerializerMethodField()
    tag = serializers.CharField(source='display_tag', read_only=True)
    live = serializers.BooleanField(source='is_available', read_only=True)
    days = serializers.SerializerMethodField()

    class Meta:
        model = MenuOrderItem
        fields = ['id', 'name', 'description', 'price', 'category', 'slot', 'tag', 'live', 'days']

    def get_slot(self, obj):
        return obj.item_type

    def get_days(self, obj):
        return []


class GuestOrderItemSerializer(serializers.ModelSerializer):
    name = serializers.CharField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    is_custom = serializers.BooleanField()

    class Meta:
        model = GuestOrderItem
        fields = ['name', 'qty', 'price', 'is_custom']



class GuestOrderSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    order_number = serializers.CharField(read_only=True)

    class Meta:
        model = GuestOrder
        fields = [
            'id', 'order_number', 'guest_name', 'guest_email', 'phone', 'items', 'total',
            'status', 'created_at', 'updated_at', 'estimated_time', 'special_instructions'
        ]
        read_only_fields = ['id', 'order_number', 'created_at', 'updated_at']

    def get_items(self, obj):
        return GuestOrderItemSerializer(
            obj.items.all(), many=True
        ).data

# class GuestOrderSerializer(serializers.ModelSerializer):
#     items = GuestOrderItemSerializer(many=True, read_only=True)
#     order_number = serializers.CharField(read_only=True)

#     class Meta:
#         model = GuestOrder
#         fields = [
#             'id', 'order_number', 'guest_name', 'guest_email', 'phone', 'items', 'total',
#             'status', 'created_at', 'updated_at', 'estimated_time', 'special_instructions'
#         ]
#         read_only_fields = ['id', 'order_number', 'created_at', 'updated_at']


class GuestOrderCreateSerializer(serializers.Serializer):
    guest_name = serializers.CharField(max_length=200)
    guest_email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20)
    estimated_time = serializers.TimeField(required=False, allow_null=True)
    special_instructions = serializers.CharField(required=False, allow_blank=True)
    items = serializers.ListField(child=serializers.DictField())

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = data.copy()
            estimated_time = data.get('estimated_time')
            if isinstance(estimated_time, str):
                estimated_time = estimated_time.strip()
                if estimated_time == '':
                    data['estimated_time'] = None
                else:
                    parsed_time = self._parse_estimated_time(estimated_time)
                    if parsed_time is not None:
                        data['estimated_time'] = parsed_time
        return super().to_internal_value(data)

    def _parse_estimated_time(self, value: str):
        normalized = value.strip().lower().replace(' ', '')

        if normalized.isdigit():
            if len(normalized) <= 2:
                normalized = f"{normalized.zfill(2)}:00"
            elif len(normalized) == 3:
                normalized = f"{normalized[0]}:{normalized[1:]}"
            elif len(normalized) == 4:
                normalized = f"{normalized[:2]}:{normalized[2:]}"

        if ':' in normalized:
            parts = normalized.split(':')
            if len(parts) in (2, 3):
                try:
                    hour = int(parts[0])
                    minute = int(parts[1])
                    second = int(parts[2]) if len(parts) == 3 else 0
                    if 0 <= hour < 24 and 0 <= minute < 60 and 0 <= second < 60:
                        return time(hour, minute, second)
                except ValueError:
                    pass

        return None

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        canteen = validated_data.pop('canteen')

        order = GuestOrder.objects.create(canteen=canteen, **validated_data)

        total = 0

        for item_data in items_data:
            if item_data.get('menu_item_id'):
                menu_item = MenuOrderItem.objects.get(id=item_data['menu_item_id'])

                item = GuestOrderItem.objects.create(
                    order=order,
                    name=menu_item.name,
                    price=menu_item.base_price,
                    qty=item_data['qty'],
                    is_custom=False
                )
            else:
                item = GuestOrderItem.objects.create(
                    order=order,
                    name=item_data['name'],
                    price=item_data['price'],
                    qty=item_data['qty'],
                    is_custom=True
                )

            total += item.subtotal

        order.total = total
        order.save()

        return order

    def to_representation(self, instance):
        return GuestOrderSerializer(instance).data


class GuestOrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=GuestOrder.STATUS_CHOICES)

    def to_internal_value(self, data):
        if isinstance(data, dict) and 'status' in data and isinstance(data['status'], str):
            data = data.copy()
            data['status'] = data['status'].strip().lower()
        return super().to_internal_value(data)


class GuestOrderStatsSerializer(serializers.Serializer):
    total_guests = serializers.IntegerField()
    active_orders = serializers.IntegerField()
    todays_revenue = serializers.DecimalField(max_digits=10, decimal_places=2)
    average_order = serializers.DecimalField(max_digits=10, decimal_places=2)
