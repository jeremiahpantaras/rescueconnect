from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0008_emergencyreport_resolved_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='emergencyreport',
            name='client_ref',
            field=models.CharField(
                blank=True, editable=False, max_length=64, null=True, unique=True,
                help_text="Idempotency key from the citizen's device; a repeat send with the same key is not a new report.",
            ),
        ),
        migrations.AddField(
            model_name='emergencyreport',
            name='reported_at',
            field=models.DateTimeField(
                blank=True, editable=False, null=True,
                help_text="When the citizen made this report, by their device clock. Earlier than the received time "
                          "when the report was saved offline first.",
            ),
        ),
    ]
