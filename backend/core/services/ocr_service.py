import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO

import pymupdf
import pytesseract
from PIL import Image
from django.conf import settings


if getattr(settings, "TESSERACT_CMD", None):
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD


def extract_text_from_pdf(uploaded_file):
    """Read embedded PDF text and OCR scanned pages with Tesseract."""
    raw = uploaded_file.read()
    pages_text = []
    with pymupdf.open(stream=raw, filetype="pdf") as pdf:
        for page in pdf:
            page_text = page.get_text("text").strip()
            if not page_text:
                pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
                image = Image.open(BytesIO(pix.tobytes("png"))).convert("RGB")
                page_text = pytesseract.image_to_string(image)
            pages_text.append(page_text)
    return "\n".join(pages_text)


def extract_text_from_image(uploaded_file):
    image = Image.open(uploaded_file).convert("RGB")
    return pytesseract.image_to_string(image)


def _first(patterns, text, flags=re.IGNORECASE | re.MULTILINE):
    for pattern in patterns:
        match = re.search(pattern, text, flags)
        if match:
            return match.group(1).strip()
    return None


def _parse_date(value):
    if not value:
        return None
    cleaned = re.sub(r"[,\s]+", "-", value.strip()).strip("-")
    for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d/%b/%Y", "%d/%B/%Y"):
        try:
            return datetime.strptime(cleaned, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _amount(value):
    if not value:
        return None
    try:
        return float(Decimal(re.sub(r"[^0-9.]", "", value.replace(",", ""))))
    except (InvalidOperation, ValueError):
        return None


def _extract_line_items(text):
    """Extract common OCR text-layer table rows: description, qty, unit, line amount."""
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    start = 0
    for idx, line in enumerate(lines):
        if "line amount" in line.lower():
            start = idx + 1
            break
    items = []
    currency_amount = re.compile(r"^(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)$", re.IGNORECASE)
    number = re.compile(r"^\d+(?:\.\d+)?$")
    i = start
    while i + 3 < len(lines):
        desc, qty_text, unit_text, amount_text = lines[i:i+4]
        unit_match = currency_amount.match(unit_text)
        amount_match = currency_amount.match(amount_text)
        if desc and number.match(qty_text) and unit_match and amount_match:
            qty = Decimal(qty_text)
            unit = Decimal(unit_match.group(1).replace(",", ""))
            amount = Decimal(amount_match.group(1).replace(",", ""))
            items.append({
                "description": desc[:255],
                "quantity": str(qty),
                "unit_price": str(unit),
                "amount": str(amount),
                "tax_amount": "0.00",
            })
            i += 4
        else:
            i += 1
    return items


def extract_invoice_data(text):
    invoice_number = _first([
        r"\bInvoice\s*(?:Number\b|No\.?\b|#)\s*[:\-]?\s*\n?\s*([A-Z0-9][A-Z0-9/-]+)",
        r"\bInv\.?\s*(?:Number|No\.?)\s*[:\-]?\s*\n?\s*([A-Z0-9][A-Z0-9/-]+)",
    ], text)
    raw_invoice_date = _first([r"\bInvoice\s*Date\s*[:\-]?\s*\n?\s*([0-9]{1,2}[-/][A-Za-z0-9]{2,9}[-/][0-9]{2,4})"], text)
    raw_due_date = _first([r"\bDue\s*Date\s*[:\-]?\s*\n?\s*([0-9]{1,2}[-/][A-Za-z0-9]{2,9}[-/][0-9]{2,4})"], text)
    gst = _first([r"\b(?:GSTIN|GST\s*IN)\s*[:\-]?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])", r"\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])\b"], text)
    total = _first([
        r"\bInvoice\s*Total\s*[:\-]?\s*\n?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
        r"\bGrand\s*Total\s*[:\-]?\s*\n?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
        r"\bTotal\s*Amount\s*[:\-]?\s*\n?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
        r"\bNet\s*Amount\s*[:\-]?\s*\n?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
    ], text)
    subtotal = _first([r"\b(?:Taxable\s*Amount|Sub\s*Total|Subtotal)\s*[:\-]?\s*\n?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)"], text)
    taxes = []
    for label in ("CGST", "SGST", "IGST"):
        value = _first([rf"\b{label}\s*(?:\([^)]+\))?\s*[:\-]?\s*\n?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{{1,2}})?)"], text)
        if value:
            parsed = _amount(value)
            if parsed is not None:
                taxes.append(Decimal(str(parsed)))
    po_number = _first([r"\bPurchase\s*Order\s*(?:Number|No\.?|#)?\s*[:\-]?\s*\n?\s*([A-Z0-9][A-Z0-9/-]+)", r"\bPO\s*(?:Number|No\.?|#)\s*[:\-]?\s*\n?\s*([A-Z0-9][A-Z0-9/-]+)"], text)
    return {
        "invoice_number": invoice_number,
        "invoice_date": _parse_date(raw_invoice_date),
        "due_date": _parse_date(raw_due_date),
        "gst_number": gst.upper() if gst else None,
        "total_amount": _amount(total),
        "subtotal": _amount(subtotal),
        "tax_amount": float(sum(taxes, Decimal("0.00"))) if taxes else None,
        "purchase_order_number": po_number,
        "items": _extract_line_items(text),
    }


def process_invoice(uploaded_file):
    """OCR an uploaded PDF or image and return extracted fields."""
    name = uploaded_file.name.lower()
    try:
        if name.endswith(".pdf"):
            text = extract_text_from_pdf(uploaded_file)
        elif name.endswith((".png", ".jpg", ".jpeg", ".tif", ".tiff")):
            text = extract_text_from_image(uploaded_file)
        else:
            raise ValueError("Unsupported file format. Upload PDF, JPG, PNG, or TIFF.")
        if not text.strip():
            raise ValueError("No readable text found. Check the document quality and try again.")
        return {"success": True, "extracted_text": text, "invoice_data": extract_invoice_data(text)}
    except Exception as exc:
        return {"success": False, "error": str(exc)}
