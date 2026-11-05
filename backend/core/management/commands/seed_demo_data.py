from datetime import date
from decimal import Decimal
from django.core.management.base import BaseCommand
from core.models import Vendor, PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem, ApprovalRule


class Command(BaseCommand):
    help = "Create fictional APFlow sample vendor, PO, GRN, and approval rules. Safe to rerun."

    def handle(self, *args, **options):
        vendor, _ = Vendor.objects.update_or_create(
            vendor_code="VEN-NORTHSTAR-01",
            defaults={
                "name": "Northstar Office Supplies Pvt. Ltd.",
                "email": "accounts@northstar.example",
                "phone": "+91 80 5550 0101",
                "address": "Fictional sample supplier address, Karnataka",
                "gst_number": "29AABCN1234F1Z5",
                "pan_number": "AABCN1234F",
                "bank_account_number": "000000000001",
                "ifsc_code": "SAMP0000001",
                "is_active": True,
            },
        )
        po, _ = PurchaseOrder.objects.update_or_create(
            po_number="PO-2026-0081",
            defaults={
                "vendor": vendor,
                "order_date": date(2026, 11, 1),
                "expected_delivery_date": date(2026, 11, 4),
                "total_amount": Decimal("7198.00"),
                "status": "COMPLETED",
            },
        )
        first, _ = PurchaseOrderItem.objects.update_or_create(
            purchase_order=po, description="A4 Copier Paper (ream)",
            defaults={"quantity": Decimal("20"), "unit_price": Decimal("245.00"), "amount": Decimal("4900.00")},
        )
        second, _ = PurchaseOrderItem.objects.update_or_create(
            purchase_order=po, description="Blue Ball Pens (box)",
            defaults={"quantity": Decimal("10"), "unit_price": Decimal("120.00"), "amount": Decimal("1200.00")},
        )
        grn, _ = GoodsReceipt.objects.update_or_create(
            grn_number="GRN-2026-0081",
            defaults={"purchase_order": po, "received_date": date(2026, 11, 4), "received_by": "Warehouse sample user"},
        )
        GoodsReceiptItem.objects.update_or_create(
            goods_receipt=grn, purchase_order_item=first,
            defaults={"received_quantity": Decimal("20")},
        )
        GoodsReceiptItem.objects.update_or_create(
            goods_receipt=grn, purchase_order_item=second,
            defaults={"received_quantity": Decimal("10")},
        )
        ApprovalRule.objects.update_or_create(
            name="Standard approval",
            defaults={"min_amount": Decimal("0.00"), "max_amount": Decimal("50000.00"), "approval_levels": 1, "approver_role": "Manager", "is_active": True},
        )
        ApprovalRule.objects.update_or_create(
            name="High value approval",
            defaults={"min_amount": Decimal("50000.01"), "max_amount": None, "approval_levels": 2, "approver_role": "Finance Controller", "is_active": True},
        )
        self.stdout.write(self.style.SUCCESS("APFlow sample vendor, PO, GRN, and approval rules are ready."))
        self.stdout.write("Upload backend/sample_data/INV_001_clean_invoice.pdf to test OCR and the matched approval flow.")
