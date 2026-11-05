from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="ApprovalRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("min_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("max_amount", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("approval_levels", models.PositiveIntegerField(default=1)),
                ("approver_role", models.CharField(default="Manager", max_length=80)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["min_amount", "approval_levels"]},
        ),
    ]
