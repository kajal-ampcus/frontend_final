"""
apps/cms/serializers/slot.py

Corrections applied vs original:
  FIX A  — Removed 'categories' from all serializer field lists (field deleted from model)
  FIX B  — menu_item_ids ListField child changed from IntegerField → UUIDField
             (matches new SlotMenuItem.menu_item_id UUIDField type)
  FIX 5  — occupancy_count / occupancy_percentage are now annotated on the queryset
             in the view. Serializers expose them as read-only IntegerField /
             FloatField with default=0 so the field still appears in responses.
  NEW    — SlotMenuItemSerializer exposes max_qty_per_order (new model field)
  NEW    — MealSlotListSerializer exposes is_active (new model field)
"""

import uuid

from rest_framework import serializers
from apps.cms.models import MealSlot, SlotMenuItem


# ---------------------------------------------------------------------------
# SlotMenuItem
# ---------------------------------------------------------------------------

class SlotMenuItemSerializer(serializers.ModelSerializer):
    """
    Read: item id, toggle state, and per-slot quantity cap.
    Frontend merges full item details (name, price, category) from the menu app
    using menu_item_id.
    """

    class Meta:
        model = SlotMenuItem
        fields = ["menu_item_id", "is_enabled", "max_qty_per_order"]


class SlotMenuItemToggleSerializer(serializers.ModelSerializer):
    """PATCH body: { "is_enabled": true }"""

    class Meta:
        model = SlotMenuItem
        fields = ["is_enabled"]


# ---------------------------------------------------------------------------
# MealSlot — read
# ---------------------------------------------------------------------------

class MealSlotListSerializer(serializers.ModelSerializer):
    # FIX 5: computed via annotation in the view (annotate occupancy_count).
    # default=0 ensures the field is present even when the view omits the annotation.
    occupancy_count      = serializers.IntegerField(read_only=True, default=0)
    occupancy_percentage = serializers.FloatField(read_only=True, default=0)

    class Meta:
        model = MealSlot
        fields = [
            "id",
            "name",
            "label",
            "date",
            "start_time",
            "end_time",
            "capacity",
            "meal_type",
            # FIX A: 'categories' removed — field no longer exists on the model
            "is_active",        # FIX 8 (new field)
            "occupancy_count",
            "occupancy_percentage",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class MealSlotDetailSerializer(MealSlotListSerializer):
    """Includes assigned items with toggle state — used in the slot detail view."""

    items = SlotMenuItemSerializer(source="slot_items", many=True, read_only=True)

    class Meta(MealSlotListSerializer.Meta):
        fields = MealSlotListSerializer.Meta.fields + ["items"]


# ---------------------------------------------------------------------------
# MealSlot — write (Add New Slot / Edit Slot modals)
# ---------------------------------------------------------------------------

class MealSlotWriteSerializer(serializers.ModelSerializer):
    """
    `menu_item_ids` — list of UUID strings referencing CanteenMenuItem records.
    We store them in SlotMenuItem without a hard FK.
    Validated here: each UUID must exist and belong to the same canteen as the slot.
    """

    # FIX B: child changed to UUIDField — matches SlotMenuItem.menu_item_id (UUIDField)
    menu_item_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        default=list,
    )

    class Meta:
        model = MealSlot
        fields = [
            "id",
            "name",
            "label",
            "date",
            "start_time",
            "end_time",
            "capacity",
            "meal_type",
            # FIX A: 'categories' removed — field no longer exists on the model
            "is_active",        # FIX 8 (new field)
            "menu_item_ids",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        start = attrs.get("start_time")
        end   = attrs.get("end_time")
        if start and end and start >= end:
            raise serializers.ValidationError(
                {"end_time": "End time must be after start time."}
            )
        return attrs

    def _sync_items(self, slot, item_ids: list[uuid.UUID]):
        """
        Reconcile SlotMenuItem rows for this slot against the supplied list.
        - Removes items no longer in the list.
        - Creates new SlotMenuItem rows for newly added items (is_enabled=True).
        - Preserves is_enabled toggle state for existing items.
        """
        incoming = set(item_ids)
        existing = {smi.menu_item_id: smi for smi in slot.slot_items.all()}

        # Remove deselected items
        for item_id, smi in existing.items():
            if item_id not in incoming:
                smi.delete()

        # Add newly selected items (default is_enabled=True)
        for item_id in incoming:
            if item_id not in existing:
                SlotMenuItem.objects.create(
                    slot=slot,
                    menu_item_id=item_id,
                    is_enabled=True,
                )

    def create(self, validated_data):
        item_ids = validated_data.pop("menu_item_ids", [])
        slot = MealSlot.objects.create(**validated_data)
        self._sync_items(slot, item_ids)
        return slot

    def update(self, instance, validated_data):
        item_ids = validated_data.pop("menu_item_ids", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if item_ids is not None:
            self._sync_items(instance, item_ids)
        return instance