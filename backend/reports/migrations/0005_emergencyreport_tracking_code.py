from django.db import migrations, models


class Migration(migrations.Migration):
    """Step 1 of 3: add the column, empty for now (existing rows get codes in 0006)."""

    dependencies = [
        ('reports', '0004_alter_emergencyreport_photo1_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='emergencyreport',
            name='tracking_code',
            field=models.CharField(editable=False, max_length=12, null=True),
        ),
    ]
