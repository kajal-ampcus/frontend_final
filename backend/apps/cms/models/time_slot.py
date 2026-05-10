import uuid

from django.db import models


class TimeSlot(models.Model):
    SLOT_TYPE_BREAKFAST = 'BREAKFAST'
    SLOT_TYPE_MEAL = 'MEAL'
    SLOT_TYPE_SNACK = 'SNACK'

    SLOT_TYPE_CHOICES = [
        (SLOT_TYPE_BREAKFAST, 'Breakfast'),
        (SLOT_TYPE_MEAL, 'Meal'),
        (SLOT_TYPE_SNACK, 'Snack'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    canteen = models.ForeignKey(
        'cms.CanteenLocation',
        on_delete=models.CASCADE,
        related_name='time_slots',
    )
    name = models.CharField(max_length=100)
    slot_type = models.CharField(max_length=20, choices=SLOT_TYPE_CHOICES, default=SLOT_TYPE_MEAL)
    start_time = models.TimeField()
    end_time = models.TimeField()
    ordering_opens_at = models.TimeField(null=True, blank=True)
    ordering_deadline_time = models.TimeField()
    cancellation_deadline_time = models.TimeField()
    max_orders = models.PositiveIntegerField(null=True, blank=True)
    applicable_days = models.JSONField(default=list, blank=True)
    display_color = models.CharField(max_length=20, default='#3b82f6')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cms_time_slots'
        ordering = ['start_time', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['canteen', 'name'],
                name='uniq_time_slot_name_per_canteen',
            ),
        ]
        indexes = [
            models.Index(fields=['canteen_id', 'is_active'], name='idx_timeslot_canteen_active'),
        ]

    def __str__(self):
        return f'{self.name} @ {self.canteen_id}'
