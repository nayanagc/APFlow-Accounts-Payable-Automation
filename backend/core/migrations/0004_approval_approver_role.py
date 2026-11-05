from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0003_invoice_extracted_gst_number")]

    operations = [
        migrations.AddField(
            model_name="approval",
            name="approver_role",
            field=models.CharField(default="Manager", max_length=80),
        ),
    ]
