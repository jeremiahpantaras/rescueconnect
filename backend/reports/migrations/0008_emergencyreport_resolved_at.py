from django.db import migrations, models
from django.db.models import F


def backfill_resolved_at(apps, schema_editor):
    """Reports already marked resolved get their last-updated time as the best available resolution time."""
    EmergencyReport = apps.get_model('reports', 'EmergencyReport')
    EmergencyReport.objects.filter(status='resolved', resolved_at__isnull=True).update(resolved_at=F('updated_at'))


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0007_tracking_code_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='emergencyreport',
            name='resolved_at',
            field=models.DateTimeField(
                blank=True, editable=False, null=True,
                help_text='When this report was marked resolved; empty while it is open.',
            ),
        ),
        migrations.RunPython(backfill_resolved_at, migrations.RunPython.noop),
    ]
