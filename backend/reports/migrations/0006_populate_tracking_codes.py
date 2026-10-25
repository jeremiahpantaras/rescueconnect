from django.db import migrations

from reports.tracking import generate_tracking_code


def populate_tracking_codes(apps, schema_editor):
    """Step 2 of 3: give every existing report its own random code."""
    EmergencyReport = apps.get_model('reports', 'EmergencyReport')
    used = set()
    for report in EmergencyReport.objects.filter(tracking_code__isnull=True).iterator():
        code = generate_tracking_code()
        while code in used:  # astronomically unlikely, but the next step needs uniqueness
            code = generate_tracking_code()
        used.add(code)
        EmergencyReport.objects.filter(pk=report.pk).update(tracking_code=code)


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0005_emergencyreport_tracking_code'),
    ]

    operations = [
        # Reversing only needs to succeed; the column is dropped by reversing 0005.
        migrations.RunPython(populate_tracking_codes, migrations.RunPython.noop),
    ]
