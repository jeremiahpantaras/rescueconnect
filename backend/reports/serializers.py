import re
from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers
from .models import EmergencyReport
from .tracking import format_tracking_code

class ForgivingDateTimeField(serializers.DateTimeField):
    """An optional timestamp from the citizen's phone. If it cannot be read, drop it: a bad clock or a
    malformed value must never cause an emergency report to be rejected."""

    def to_internal_value(self, value):
        try:
            return super().to_internal_value(value)
        except serializers.ValidationError:
            return None


class EmergencyReportSerializer(serializers.ModelSerializer):
    # Sent by the citizen's device only; never returned. Declared explicitly because the model fields are
    # editable=False (which DRF would make read-only), and without automatic validators: the view does the
    # uniqueness check so a repeat send returns the original report instead of a validation error.
    client_ref = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True, max_length=64)
    reported_at = ForgivingDateTimeField(write_only=True, required=False, allow_null=True)
    photo1_url = serializers.ReadOnlyField()
    photo2_url = serializers.ReadOnlyField()
    tracking_code = serializers.SerializerMethodField()
    
    class Meta:
        model = EmergencyReport
        fields = [
            'id', 
            'latitude', 
            'longitude', 
            'accuracy', 
            'message', 
            'device_id', 
            'status',
            'created_at',
            'updated_at',
            'photo1',
            'photo2',
            'photo1_url',
            'photo2_url',
            'tracking_code',
            'resolved_at',
            'client_ref',
            'reported_at',
        ]
        read_only_fields = ('created_at', 'updated_at', 'photo1_url', 'photo2_url')

    
    CLIENT_REF_PATTERN = re.compile(r'^[A-Za-z0-9-]{8,64}$')

    def validate_client_ref(self, value):
        if value and not self.CLIENT_REF_PATTERN.match(value):
            raise serializers.ValidationError('Invalid client_ref')
        return value or None

    def validate_reported_at(self, value):
        # A wrong phone clock must not distort what staff see: ignore times from the future or from long ago.
        if value is None:
            return None
        now = timezone.now()
        if value > now + timedelta(minutes=5) or value < now - timedelta(days=14):
            return None
        return value

    def get_tracking_code(self, obj):
        return format_tracking_code(obj.tracking_code)

    def validate_latitude(self, value):
        if not -90 <= value <= 90:
            raise serializers.ValidationError("Invalid latitude")
        return value
    
    def validate_longitude(self, value):
        if not -180 <= value <= 180:
            raise serializers.ValidationError("Invalid longitude")
        return value
    
    def validate_message(self, value):
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Message too short")
        return value