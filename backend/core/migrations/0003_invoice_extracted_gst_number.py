from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0002_approvalrule")]

    operations = [
        migrations.AddField(
            model_name="invoice",
            name="extracted_gst_number",
            field=models.CharField(blank=True, max_length=20),
        ),
    ]
