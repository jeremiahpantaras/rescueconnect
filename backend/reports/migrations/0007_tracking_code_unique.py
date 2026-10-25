from django.db import migrations, models

import reports.tracking


class Migration(migrations.Migration):
    """Step 3 of 3: every row has a code now, so make it required and unique."""

    dependencies = [
        ('reports', '0006_populate_tracking_codes'),
    ]

    operations = [
        migrations.AlterField(
            model_name='emergencyreport',
            name='tracking_code',
            field=models.CharField(
                default=reports.tracking.generate_tracking_code,
                editable=False,
                help_text='Secret code the citizen uses to check this report.',
                max_length=12,
                unique=True,
            ),
        ),
    ]
