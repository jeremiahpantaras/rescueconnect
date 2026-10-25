from django.db import models
from django.utils import timezone
from django.core.validators import FileExtensionValidator
from cloudinary.models import CloudinaryField

from .tracking import generate_tracking_code

class EmergencyReport(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('acknowledged', 'Acknowledged'),
        ('responding', 'Responding'),
        ('resolved', 'Resolved'),
    ]
    
    latitude = models.FloatField()
    longitude = models.FloatField()
    accuracy = models.FloatField(null=True, blank=True)
    message = models.TextField(blank=True)
    device_id = models.CharField(max_length=255)
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='pending'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Secret the citizen uses on the public status page (see reports/tracking.py).
    tracking_code = models.CharField(
        max_length=12, unique=True, default=generate_tracking_code, editable=False,
        help_text='Secret code the citizen uses to check this report.',
    )
    # When the report was marked resolved (cleared if it is reopened). Set by save(), never edited by hand.
    resolved_at = models.DateTimeField(
        null=True, blank=True, editable=False,
        help_text='When this report was marked resolved; empty while it is open.',
    )

    # Store-and-forward support. The citizen's phone keeps a report until it can be sent, then may send it more
    # than once if a reply is lost. client_ref is the key that makes a repeat send return the original report
    # instead of creating a duplicate; reported_at is when the citizen actually made it (their device clock).
    client_ref = models.CharField(
        max_length=64, unique=True, null=True, blank=True, editable=False,
        help_text="Idempotency key from the citizen's device; a repeat send with the same key is not a new report.",
    )
    reported_at = models.DateTimeField(
        null=True, blank=True, editable=False,
        help_text="When the citizen made this report, by their device clock. Earlier than the received time "
                  "when the report was saved offline first.",
    )

    # Cloudinary image fields
    photo1 = CloudinaryField('image', blank=True, null=True, folder='tabang_negros/reports')
    photo2 = CloudinaryField('image', blank=True, null=True, folder='tabang_negros/reports')
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Report #{self.id} - {self.status}"

    def save(self, *args, **kwargs):
        # Keep resolved_at in step with status, whichever code path changed it (admin, API, shell).
        changed = False
        if self.status == 'resolved' and self.resolved_at is None:
            self.resolved_at, changed = timezone.now(), True
        elif self.status != 'resolved' and self.resolved_at is not None:
            self.resolved_at, changed = None, True
        update_fields = kwargs.get('update_fields')
        if changed and update_fields is not None:
            kwargs['update_fields'] = {*update_fields, 'resolved_at'}
        super().save(*args, **kwargs)
    
    @property
    def photo1_url(self):
        """Return the Cloudinary URL for photo1"""
        if self.photo1:
            return self.photo1.url
        return None
    
    @property
    def photo2_url(self):
        """Return the Cloudinary URL for photo2"""
        if self.photo2:
            return self.photo2.url
        return None