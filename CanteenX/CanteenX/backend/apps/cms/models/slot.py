"""
apps/cms/models/slot.py

Corrections applied vs original:
  FIX 1  — MealSlot.id: integer PK → UUIDField (matches Order.slot_id type)
  FIX 2  — MealSlot.canteen FK added for tenant isolation
  FIX 3  — SlotMenuItem.menu_item_id: PositiveIntegerField → UUIDField
  FIX 4  — MealSlot.categories JSONField removed (derived from SlotMenuItems)
  FIX 5  — occupancy_count / occupancy_percentage properties removed
             (compute via .annotate() in views to avoid N+1)
  FIX 6  — DB indexes added on MealSlot and SlotMenuItem
  FIX 8  — MealSlot.is_active added for soft-deactivation
  FIX 7  — SlotLabel "NEW SESSION" space kept as-is (deferred — breaking migration)
  NEW    — MealType values normalised to UPPER_UNDERSCORE (requires data migration
             if rows already store "Breakfast"/"Meal" — see note below)
  NEW    — SlotMenuItem.max_qty_per_order snapshot field added
"""

import uuid

from django.db import models


# ──────────────────────────────────────────────────────────────────────────────
# Choices
# ──────────────────────────────────────────────────────────────────────────────

class SlotLabel(models.TextChoices):
    # NOTE (FIX 7): "NEW SESSION" contains a space — kept for migration safety.
    # Rename to "NEW_SESSION" in a future migration + data migration.
    NEW_SESSION = "NEW SESSION", "New Session"
    UPCOMING    = "UPCOMING",    "Upcoming"
    ACTIVE      = "ACTIVE",      "Active"
    CLOSED      = "CLOSED",      "Closed"


class MealType(models.TextChoices):
    # WARNING: original stored "Breakfast" / "Meal" (Title case).
    # Changing to UPPER requires a data migration:
    #   MealSlot.objects.filter(meal_type="Breakfast").update(meal_type="BREAKFAST")
    #   MealSlot.objects.filter(meal_type="Meal").update(meal_type="MEAL")
    BREAKFAST = "BREAKFAST", "Breakfast"
    MEAL      = "MEAL",      "Meal"


# ──────────────────────────────────────────────────────────────────────────────
# MealSlot
# ──────────────────────────────────────────────────────────────────────────────

class MealSlot(models.Model):
    """
    cms_meal_slots

    A dining time window for a specific canteen on a specific date.
    Admin creates slots and assigns menu items via SlotMenuItem.
    Employees can only order within an ACTIVE slot's time window.

    Relationship to Order:
      Order.slot_id (UUIDField) must reference MealSlot.id (UUIDField) — types now match.
      Once Order.slot_id is upgraded to a proper FK, occupancy can be annotated:
          MealSlot.objects.annotate(
              occupancy_count=Count(
                  'slot_orders',
                  filter=Q(slot_orders__status__in=[PLACED, PREPARING, READY])
              )
          )
    """

    # FIX 1: explicit UUID PK — must match Order.slot_id (UUIDField)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # FIX 2: canteen FK — required for tenant isolation
    canteen = models.ForeignKey(
        'cms.CanteenLocation',
        on_delete=models.CASCADE,
        related_name='meal_slots',
        db_column='canteen_id',
    )

    name = models.CharField(max_length=100)
    label = models.CharField(
        max_length=20,
        choices=SlotLabel.choices,
        default=SlotLabel.NEW_SESSION,
        db_index=True,
    )
    meal_type = models.CharField(
        max_length=20,
        choices=MealType.choices,
        db_index=True,
    )

    date       = models.DateField()
    start_time = models.TimeField()
    end_time   = models.TimeField()
    capacity   = models.PositiveIntegerField(default=100)

    # FIX 8: soft-deactivation flag
    # CLOSED label  = ordering window ended (normal daily lifecycle)
    # is_active=False = admin permanently deactivated this slot
    is_active = models.BooleanField(default=True, db_index=True)

    # FIX 4: categories JSONField removed.
    # Categories served in a slot are derived from assigned SlotMenuItems
    # (via menu_item → category). No duplication, no stale strings.

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cms_meal_slots'
        ordering = ['date', 'start_time']

        # FIX 6: composite indexes
        indexes = [
            # Kitchen board / employee ordering: "Today's slots for canteen X"
            models.Index(
                fields=['canteen_id', 'date', 'label'],
                name='idx_slot_canteen_date_label',
            ),
            # Admin list: "All active slots for canteen X"
            models.Index(
                fields=['canteen_id', 'is_active', 'date'],
                name='idx_slot_canteen_active_date',
            ),
            # Meal-type filter: "Breakfast slots for canteen X on date Y"
            models.Index(
                fields=['canteen_id', 'date', 'meal_type'],
                name='idx_slot_canteen_date_mealtype',
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['canteen', 'date', 'name'],
                name='uniq_slot_canteen_date_name',
            ),
        ]

    def __str__(self):
        return f"{self.name} [{self.meal_type}] {self.date} {self.start_time}–{self.end_time}"

    @property
    def is_ordering_open(self) -> bool:
        """True only when label=ACTIVE and is_active=True."""
        return self.label == SlotLabel.ACTIVE and self.is_active

    # FIX 5: occupancy_count and occupancy_percentage removed from model.
    # Compute in the view via annotation — avoids hidden N+1 in list views.
    # Example:
    #
    #   from django.db.models import Count, Q
    #   from apps.cms.models.order import OrderStatus
    #
    #   slots = MealSlot.objects.annotate(
    #       occupancy_count=Count(
    #           'slot_orders',
    #           filter=Q(slot_orders__status__in=[
    #               OrderStatus.PLACED,
    #               OrderStatus.PREPARING,
    #               OrderStatus.READY,
    #           ])
    #       )
    #   ).filter(canteen_id=canteen_id, date=today)


# ──────────────────────────────────────────────────────────────────────────────
# SlotMenuItem
# ──────────────────────────────────────────────────────────────────────────────

class SlotMenuItem(models.Model):
    """
    cms_slot_menu_items

    Through-table linking a MealSlot to a CanteenMenuItem.
    menu_item_id is a UUIDField — no FK constraint across apps, but column
    type now matches CanteenMenuItem.id. Validated at the serializer layer
    (item must exist and belong to the same canteen as the slot).

    N+1 pattern — load items for a slot in 2 queries:
        slot_items = SlotMenuItem.objects.filter(slot_id=slot_id, is_enabled=True)
        item_ids   = slot_items.values_list('menu_item_id', flat=True)
        items      = CanteenMenuItem.objects.filter(id__in=item_ids).select_related('category')
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    slot = models.ForeignKey(
        MealSlot,
        on_delete=models.CASCADE,
        related_name='slot_items',
        db_column='slot_id',
    )

    # FIX 3: UUIDField — matches CanteenMenuItem.id type
    menu_item_id = models.UUIDField(
        help_text=(
            "UUID of CanteenMenuItem. No DB FK constraint — "
            "validated at app layer to ensure item belongs to slot's canteen."
        )
    )

    is_enabled = models.BooleanField(
        default=True,
        help_text="Admin toggle — False hides this item from the slot's menu.",
    )

    # Snapshot: per-order quantity cap for this item in this slot.
    # Copied from CanteenMenuItem.max_qty_per_order at assignment time.
    max_qty_per_order = models.PositiveIntegerField(
        default=3,
        help_text="Per-order quantity cap for this item in this slot.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cms_slot_menu_items'

        constraints = [
            models.UniqueConstraint(
                fields=['slot', 'menu_item_id'],
                name='uniq_slot_menu_item',
            ),
        ]

        # FIX 6: indexes on SlotMenuItem
        indexes = [
            # "Which items are enabled in slot X?" — employee menu view
            models.Index(
                fields=['slot_id', 'is_enabled'],
                name='idx_smi_slot_enabled',
            ),
            # "Which slots contain item X?" — admin reverse lookup
            models.Index(
                fields=['menu_item_id'],
                name='idx_smi_menuitem',
            ),
        ]

    def __str__(self):
        status = 'enabled' if self.is_enabled else 'disabled'
        return f"Item {self.menu_item_id} in slot '{self.slot.name}' ({status})"