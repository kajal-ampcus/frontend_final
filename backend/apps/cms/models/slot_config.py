import uuid

from django.db import models


class MenuItemSlotConfig(models.Model):
    """
    Slot-specific limits for a menu item.

    This model is intentionally separate from menu.py so slot-related logic
    does not live inside the menu item model module.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    canteen = models.ForeignKey(
        'cms.CanteenLocation',
        on_delete=models.CASCADE,
        related_name='menu_item_slot_configs',
    )
    menu_item = models.ForeignKey(
        'cms.MenuOrderItem',
        on_delete=models.CASCADE,
        related_name='slot_configs',
    )

    slot_id = models.CharField(max_length=100)
    slot_name = models.CharField(max_length=100, blank=True, default='')
    slot_start_time = models.TimeField(null=True, blank=True)
    slot_end_time = models.TimeField(null=True, blank=True)

    quantity_per_slot = models.PositiveIntegerField()
    max_qty_per_order = models.PositiveIntegerField(default=1)
    max_qty_per_person = models.PositiveIntegerField(default=1)
    max_qty_per_day = models.PositiveIntegerField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cms_menu_item_slot_configs'
        ordering = ['slot_name', 'slot_id']
        unique_together = [('menu_item', 'slot_id')]
        indexes = [
            models.Index(
                fields=['menu_item_id', 'is_active'],
                name='idx_misc_item_active',
            ),
            models.Index(
                fields=['canteen_id', 'slot_id', 'is_active'],
                name='idx_misc_canteen_slot_active',
            ),
        ]

    def __str__(self):
        return f"{self.menu_item_id} -> {self.slot_name or self.slot_id}"
