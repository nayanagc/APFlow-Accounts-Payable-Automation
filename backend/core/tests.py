from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from core.models import Vendor, ApprovalRule
from core.views import approval_levels_for_amount
from core.services.ocr_service import extract_invoice_data


class AccountsPayableApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.vendor = Vendor.objects.create(name="Test Vendor", vendor_code="TEST-001", gst_number="29ABCDE1234F1Z5")

    def test_vendor_list_returns_created_vendor(self):
        response = self.client.get("/api/vendors/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["vendor_code"], "TEST-001")

    def test_approval_rules_select_levels_by_amount(self):
        ApprovalRule.objects.create(name="Standard", min_amount=0, max_amount=50000, approval_levels=1)
        ApprovalRule.objects.create(name="High value", min_amount=50000.01, max_amount=None, approval_levels=2)
        self.assertEqual(approval_levels_for_amount(Decimal("25000")), 1)
        self.assertEqual(approval_levels_for_amount(Decimal("75000")), 2)

    def test_invoice_list_is_empty_at_start(self):
        response = self.client.get("/api/invoices/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_ocr_extracts_header_fields_tax_and_line_items(self):
        text = """TAX INVOICE
Northstar Office Supplies Pvt. Ltd.
GSTIN: 29AABCN1234F1Z5
Invoice Number
NS-2026-1042
Invoice Date
03-Nov-2026
Due Date
03-Dec-2026
Purchase Order
PO-2026-0081
Description
Qty
Unit Price
Line Amount
A4 Copier Paper (ream)
20
INR 245.00
INR 4,900.00
Blue Ball Pens (box)
10
INR 120.00
INR 1,200.00
Taxable Amount
INR 6,100.00
CGST (9%)
INR 549.00
SGST (9%)
INR 549.00
IGST
INR 0.00
Invoice Total
INR 7,198.00"""
        result = extract_invoice_data(text)
        self.assertEqual(result["invoice_number"], "NS-2026-1042")
        self.assertEqual(result["invoice_date"], "2026-11-03")
        self.assertEqual(result["due_date"], "2026-12-03")
        self.assertEqual(result["gst_number"], "29AABCN1234F1Z5")
        self.assertEqual(result["total_amount"], 7198.0)
        self.assertEqual(result["subtotal"], 6100.0)
        self.assertEqual(len(result["items"]), 2)
