from rest_framework import serializers
from apps.cms.models import Announcement


class AnnouncementSerializer(serializers.ModelSerializer):
    time_range = serializers.ReadOnlyField()

    class Meta:
        model = Announcement
        fields = [
            'id',
            'title',
            'message',
            'date',
            'time_from',
            'time_to',
            'time_range',
            'special_dish',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'time_range']

    def validate(self, data):
        time_from = data.get('time_from', getattr(self.instance, 'time_from', None))
        time_to = data.get('time_to', getattr(self.instance, 'time_to', None))
        if time_from and time_to and time_from >= time_to:
            raise serializers.ValidationError(
                {"time_to": "End time must be after start time."}
            )
        return data


class AnnouncementStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    active = serializers.IntegerField()
    inactive = serializers.IntegerField()
    with_special_dish = serializers.IntegerField()


class AnnouncementToggleStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Announcement.STATUS_CHOICES)