from decimal import Decimal
import re
from django.db.models import Sum
from ..models import Invoice, PurchaseOrder, GoodsReceiptItem


def validate_invoice(invoice: Invoice):
    """Run AP controls and return a list of human-readable exceptions."""
    errors = []
    if not invoice.invoice_number:
        errors.append("Invoice number could not be extracted; enter it during manual review.")
    if not invoice.invoice_date:
        errors.append("Invoice date is missing or could not be read.")
    if not invoice.due_date:
        errors.append("Due date is missing or could not be read.")
    if invoice.total_amount is None or invoice.total_amount <= 0:
        errors.append("Invoice total is missing or invalid.")

    if invoice.invoice_number:
        duplicate = Invoice.objects.filter(
            vendor=invoice.vendor,
            invoice_number__iexact=invoice.invoice_number,
        ).exclude(pk=invoice.pk).exists()
        if duplicate:
            errors.append("Duplicate invoice number already exists for this vendor.")

    gst = (invoice.vendor.gst_number or "").strip().upper()
    gst_pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$"
    if gst and not re.match(gst_pattern, gst):
        errors.append("Vendor master contains an invalid GSTIN format.")
    extracted_gst = (invoice.extracted_gst_number or "").strip().upper()
    if extracted_gst and not re.match(gst_pattern, extracted_gst):
        errors.append("Extracted GSTIN has an invalid format; verify it manually.")
    elif extracted_gst and gst and extracted_gst != gst:
        errors.append("Invoice GSTIN does not match the selected vendor master.")

    if invoice.purchase_order_id:
        po = invoice.purchase_order
        if po.vendor_id != invoice.vendor_id:
            errors.append("Purchase order belongs to a different vendor.")
        variance = abs(Decimal(invoice.total_amount) - Decimal(po.total_amount))
        if variance > Decimal("1.00"):
            errors.append(f"PO amount variance: invoice differs from PO by ₹{variance:.2f}.")
        # Three-way quantity control: received quantity must not exceed PO quantity.
        for po_item in po.items.all():
            received = GoodsReceiptItem.objects.filter(
                purchase_order_item=po_item
            ).aggregate(total=Sum("received_quantity"))["total"] or Decimal("0")
            if received > po_item.quantity:
                errors.append(f"Received quantity exceeds ordered quantity for '{po_item.description}'.")
            invoice_item = invoice.items.filter(description__iexact=po_item.description).first()
            if invoice_item and received and invoice_item.quantity > received:
                errors.append(f"Three-way match: billed quantity exceeds received quantity for '{po_item.description}'.")
    elif invoice.extracted_text and "purchase order" in invoice.extracted_text.lower():
        errors.append("A purchase order reference was present in the invoice but could not be matched.")

    # The amounts are checked only when subtotal and tax were both captured.
    if invoice.subtotal and invoice.tax_amount is not None and invoice.total_amount:
        calculated = Decimal(invoice.subtotal) + Decimal(invoice.tax_amount)
        if abs(calculated - Decimal(invoice.total_amount)) > Decimal("1.00"):
            errors.append("Subtotal plus tax does not equal the invoice total.")

    return errors
