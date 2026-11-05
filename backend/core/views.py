from decimal import Decimal, InvalidOperation
from uuid import uuid4

from django.db import transaction
from django.db.models import Sum, Count, Q
from django.http import Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from .models import (
    Invoice, InvoiceItem, Vendor, PurchaseOrder, PurchaseOrderItem,
    GoodsReceipt, GoodsReceiptItem, Approval, Payment, AuditLog, ApprovalRule,
)
from .serializers import (
    InvoiceSerializer, VendorSerializer, PurchaseOrderSerializer,
    GoodsReceiptSerializer, ApprovalSerializer, PaymentSerializer,
    AuditLogSerializer, ApprovalRuleSerializer,
)
from .services.ocr_service import process_invoice
from .services.validation_service import validate_invoice


def audit(action, description="", invoice=None, user=None):
    AuditLog.objects.create(action=action, description=description, invoice=invoice, user=user if getattr(user, "is_authenticated", False) else None)


def approval_rule_for_amount(amount):
    rule = ApprovalRule.objects.filter(is_active=True, min_amount__lte=amount).filter(
        models_q_max(amount)
    ).order_by("-min_amount").first()
    if rule:
        return rule.approval_levels, rule.approver_role
    return (2, "Manager") if amount > Decimal("50000") else (1, "Manager")


def approval_levels_for_amount(amount):
    return approval_rule_for_amount(amount)[0]


def models_q_max(amount):
    return Q(max_amount__isnull=True) | Q(max_amount__gte=amount)


def invoice_workflow_label(invoice):
    if invoice.status == "PAID":
        return "Paid"
    if invoice.status == "APPROVED":
        return "Approved"
    if invoice.status == "REJECTED":
        return "Rejected"
    if invoice.status == "PENDING_APPROVAL":
        return "Pending"
    if invoice.status == "PENDING_REVIEW":
        return "Needs review"
    return invoice.status.replace("_", " ").title()


@api_view(["GET", "POST"])
def vendor_list(request):
    if request.method == "GET":
        queryset = Vendor.objects.all().order_by("name")
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search) | queryset.filter(vendor_code__icontains=search) | queryset.filter(gst_number__icontains=search)
        return Response(VendorSerializer(queryset, many=True).data)
    serializer = VendorSerializer(data=request.data)
    if serializer.is_valid():
        vendor = serializer.save()
        audit("VENDOR_CREATED", f"Vendor {vendor.vendor_code} created.")
        return Response(VendorSerializer(vendor).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PATCH", "DELETE"])
def vendor_detail(request, pk):
    try:
        vendor = Vendor.objects.get(pk=pk)
    except Vendor.DoesNotExist:
        raise Http404
    if request.method == "GET":
        return Response(VendorSerializer(vendor).data)
    if request.method == "DELETE":
        vendor.is_active = False
        vendor.save(update_fields=["is_active"])
        audit("VENDOR_DEACTIVATED", f"Vendor {vendor.vendor_code} deactivated.")
        return Response({"message": "Vendor deactivated."})
    serializer = VendorSerializer(vendor, data=request.data, partial=True)
    if serializer.is_valid():
        vendor = serializer.save()
        audit("VENDOR_UPDATED", f"Vendor {vendor.vendor_code} updated.")
        return Response(VendorSerializer(vendor).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
def purchase_order_list(request):
    if request.method == "GET":
        return Response(PurchaseOrderSerializer(PurchaseOrder.objects.select_related("vendor").prefetch_related("items").order_by("-created_at"), many=True).data)
    items = request.data.get("items", [])
    serializer = PurchaseOrderSerializer(data=request.data)
    if serializer.is_valid():
        with transaction.atomic():
            po = serializer.save()
            for item in items:
                PurchaseOrderItem.objects.create(purchase_order=po, **item)
        audit("PURCHASE_ORDER_CREATED", f"Purchase order {po.po_number} created.")
        return Response(PurchaseOrderSerializer(po).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
def goods_receipt_list(request):
    if request.method == "GET":
        queryset = GoodsReceipt.objects.select_related("purchase_order", "purchase_order__vendor").prefetch_related("items").order_by("-created_at")
        return Response(GoodsReceiptSerializer(queryset, many=True).data)

    items = request.data.get("items", [])
    serializer = GoodsReceiptSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    if not isinstance(items, list) or not items:
        return Response({"items": "Add at least one received PO item."}, status=status.HTTP_400_BAD_REQUEST)

    purchase_order = serializer.validated_data["purchase_order"]
    prepared_items = []
    for item in items:
        po_item = PurchaseOrderItem.objects.filter(
            pk=item.get("purchase_order_item"), purchase_order=purchase_order
        ).first()
        if po_item is None:
            return Response({"items": "Every goods receipt item must belong to the selected purchase order."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            received_quantity = Decimal(str(item.get("received_quantity", 0)))
        except (InvalidOperation, TypeError, ValueError):
            return Response({"items": "Received quantity must be a valid number."}, status=status.HTTP_400_BAD_REQUEST)
        if received_quantity <= 0:
            return Response({"items": "Received quantities must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)
        prepared_items.append((po_item, received_quantity))

    with transaction.atomic():
        grn = serializer.save()
        for po_item, received_quantity in prepared_items:
            GoodsReceiptItem.objects.create(
                goods_receipt=grn,
                purchase_order_item=po_item,
                received_quantity=received_quantity,
            )
        po = grn.purchase_order
        total_ordered = sum((x.quantity for x in po.items.all()), Decimal("0"))
        total_received = sum((x.received_quantity for x in GoodsReceiptItem.objects.filter(purchase_order_item__purchase_order=po)), Decimal("0"))
        if total_received >= total_ordered and total_ordered > 0:
            po.status = "COMPLETED"
        elif total_received > 0:
            po.status = "PARTIALLY_RECEIVED"
        po.save(update_fields=["status"])
    audit("GOODS_RECEIPT_CREATED", f"Goods receipt {grn.grn_number} recorded.")
    return Response(GoodsReceiptSerializer(grn).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def invoice_list(request):
    if request.method == "POST":
        return upload_invoice(request)
    queryset = Invoice.objects.select_related("vendor", "purchase_order").prefetch_related("items", "approvals", "payments").order_by("-created_at")
    search = request.query_params.get("search")
    status_filter = request.query_params.get("status")
    vendor_filter = request.query_params.get("vendor")
    if search:
        queryset = queryset.filter(invoice_number__icontains=search) | queryset.filter(vendor__name__icontains=search)
    if status_filter:
        queryset = queryset.filter(status=status_filter.upper().replace(" ", "_"))
    if vendor_filter:
        queryset = queryset.filter(vendor_id=vendor_filter)
    return Response(InvoiceSerializer(queryset, many=True, context={"request": request}).data)


@api_view(["GET", "POST"])
@parser_classes([MultiPartParser, FormParser])
def upload_invoice(request):
    if request.method == "GET":
        return Response({"message": "Upload an invoice using POST.", "required_fields": ["file", "vendor_id"], "supported_formats": ["pdf", "jpg", "jpeg", "png", "tif", "tiff"]})
    uploaded_file = request.FILES.get("file")
    vendor_id = request.data.get("vendor_id")
    if not uploaded_file:
        return Response({"error": "Please upload an invoice file."}, status=status.HTTP_400_BAD_REQUEST)
    if not vendor_id:
        return Response({"error": "Please select a vendor."}, status=status.HTTP_400_BAD_REQUEST)
    if uploaded_file.size > 20 * 1024 * 1024:
        return Response({"error": "File exceeds the 20 MB upload limit."}, status=status.HTTP_400_BAD_REQUEST)
    allowed = (".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff")
    if not uploaded_file.name.lower().endswith(allowed):
        return Response({"error": "Unsupported file format."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        vendor = Vendor.objects.get(pk=vendor_id, is_active=True)
    except Vendor.DoesNotExist:
        return Response({"error": "Active vendor not found."}, status=status.HTTP_404_NOT_FOUND)

    ocr_result = process_invoice(uploaded_file)
    if not ocr_result["success"]:
        return Response({"error": ocr_result["error"]}, status=status.HTTP_400_BAD_REQUEST)
    extracted = ocr_result["invoice_data"]
    invoice_number = extracted.get("invoice_number")
    if invoice_number and Invoice.objects.filter(vendor=vendor, invoice_number__iexact=invoice_number).exists():
        return Response({"error": "Duplicate invoice detected for this vendor and invoice number."}, status=status.HTTP_409_CONFLICT)

    po = None
    po_number = extracted.get("purchase_order_number")
    if po_number:
        po = PurchaseOrder.objects.filter(po_number__iexact=po_number).first()

    # OCR reads the stream; rewind it before Django stores the original file.
    uploaded_file.seek(0)
    with transaction.atomic():
        invoice = Invoice.objects.create(
            vendor=vendor,
            purchase_order=po,
            invoice_file=uploaded_file,
            invoice_number=invoice_number,
            invoice_date=extracted.get("invoice_date"),
            due_date=extracted.get("due_date"),
            subtotal=extracted.get("subtotal") or 0,
            tax_amount=extracted.get("tax_amount") or 0,
            total_amount=extracted.get("total_amount") or 0,
            extracted_text=ocr_result["extracted_text"],
            extracted_gst_number=extracted.get("gst_number") or "",
            # This is a field-coverage estimate, not an OCR engine confidence score.
            ocr_confidence=sum(bool(extracted.get(k)) for k in ("invoice_number", "invoice_date", "due_date", "gst_number", "total_amount")) / 5 * 100,
            status="PENDING_REVIEW",
        )
        for item in extracted.get("items", []):
            InvoiceItem.objects.create(invoice=invoice, **item)
        errors = validate_invoice(invoice)
        invoice.validation_errors = errors
        if not errors:
            invoice.status = "PENDING_APPROVAL"
            approval_levels, approver_role = approval_rule_for_amount(invoice.total_amount)
            for level in range(1, approval_levels + 1):
                Approval.objects.create(invoice=invoice, approval_level=level, approver_role=approver_role)
        invoice.save(update_fields=["validation_errors", "status", "ocr_confidence", "updated_at"])
        audit("INVOICE_UPLOADED", "Invoice file stored and OCR extraction completed.", invoice, request.user)
    return Response({
        "message": "Invoice uploaded and OCR completed.",
        "invoice": InvoiceSerializer(invoice, context={"request": request}).data,
        "extracted_data": extracted,
        "validation_errors": errors,
        "field_coverage": invoice.ocr_confidence,
    }, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
def invoice_detail(request, pk):
    try:
        invoice = Invoice.objects.select_related("vendor", "purchase_order").prefetch_related("items", "approvals", "payments").get(pk=pk)
    except Invoice.DoesNotExist:
        raise Http404
    if request.method == "GET":
        return Response(InvoiceSerializer(invoice, context={"request": request}).data)
    allowed_fields = {"invoice_number", "invoice_date", "due_date", "subtotal", "tax_amount", "total_amount", "purchase_order", "extracted_gst_number"}
    updates = {key: value for key, value in request.data.items() if key in allowed_fields}
    if "purchase_order" in updates:
        try:
            updates["purchase_order"] = PurchaseOrder.objects.get(pk=updates["purchase_order"])
        except PurchaseOrder.DoesNotExist:
            return Response({"error": "Purchase order not found."}, status=status.HTTP_400_BAD_REQUEST)
    for key, value in updates.items():
        setattr(invoice, key, value)
    invoice.save()
    audit("INVOICE_CORRECTED", "Invoice fields updated during manual review.", invoice, request.user)
    return Response(InvoiceSerializer(invoice, context={"request": request}).data)


@api_view(["POST"])
def validate_invoice_view(request, pk):
    try:
        invoice = Invoice.objects.select_related("vendor", "purchase_order").get(pk=pk)
    except Invoice.DoesNotExist:
        raise Http404
    errors = validate_invoice(invoice)
    invoice.validation_errors = errors
    if errors:
        invoice.status = "PENDING_REVIEW"
    else:
        invoice.status = "PENDING_APPROVAL"
        if not invoice.approvals.exists():
            levels, approver_role = approval_rule_for_amount(invoice.total_amount)
            for level in range(1, levels + 1):
                Approval.objects.create(invoice=invoice, approval_level=level, approver_role=approver_role)
    invoice.save(update_fields=["validation_errors", "status", "updated_at"])
    audit("INVOICE_VALIDATED", "Validation controls rerun." if not errors else "Validation exceptions identified.", invoice, request.user)
    return Response({"valid": not errors, "errors": errors, "invoice": InvoiceSerializer(invoice).data})


@api_view(["GET"])
def approval_list(request):
    approvals = Approval.objects.select_related("invoice", "invoice__vendor", "approver").filter(status="PENDING", invoice__status="PENDING_APPROVAL").order_by("approval_level", "created_at")
    data = []
    for approval in approvals:
        invoice = approval.invoice
        data.append({
            **ApprovalSerializer(approval).data,
            "invoice_number": invoice.invoice_number,
            "invoice_id": invoice.id,
            "vendor_name": invoice.vendor.name,
            "amount": str(invoice.total_amount),
            "invoice_date": invoice.invoice_date,
            "due_date": invoice.due_date,
            "validation_errors": invoice.validation_errors,
        })
    return Response(data)


@api_view(["POST"])
def approval_decision(request, pk):
    try:
        approval = Approval.objects.select_related("invoice").get(pk=pk)
    except Approval.DoesNotExist:
        raise Http404
    if approval.status != "PENDING" or approval.invoice.status != "PENDING_APPROVAL":
        return Response({"error": "This approval is no longer pending."}, status=status.HTTP_409_CONFLICT)
    if approval.approver_id and (not request.user.is_authenticated or request.user.id != approval.approver_id):
        return Response({"error": "This approval is assigned to a different user."}, status=status.HTTP_403_FORBIDDEN)
    action = str(request.data.get("action", "")).strip().lower()
    comment = str(request.data.get("comment", ""))
    invoice = approval.invoice
    if action in ("approve", "approved"):
        approval.status = "APPROVED"
        approval.comments = comment
        approval.action_date = timezone.now()
        approval.save()
        pending = invoice.approvals.filter(status="PENDING").exists()
        if not pending:
            invoice.status = "APPROVED"
            invoice.save(update_fields=["status", "updated_at"])
        audit("INVOICE_APPROVED", f"Approval level {approval.approval_level} approved. {comment}".strip(), invoice, request.user)
    elif action in ("request changes", "changes", "request_changes"):
        approval.status = "REJECTED"
        approval.comments = comment or "Changes requested"
        approval.action_date = timezone.now()
        approval.save()
        invoice.status = "PENDING_REVIEW"
        invoice.save(update_fields=["status", "updated_at"])
        invoice.approvals.filter(status="PENDING").update(status="REJECTED", comments="Closed because changes were requested", action_date=timezone.now())
        audit("INVOICE_CHANGES_REQUESTED", comment, invoice, request.user)
    elif action in ("reject", "rejected"):
        approval.status = "REJECTED"
        approval.comments = comment
        approval.action_date = timezone.now()
        approval.save()
        invoice.status = "REJECTED"
        invoice.save(update_fields=["status", "updated_at"])
        invoice.approvals.filter(status="PENDING").update(status="REJECTED", comments="Closed because invoice was rejected", action_date=timezone.now())
        audit("INVOICE_REJECTED", comment, invoice, request.user)
    else:
        return Response({"error": "Action must be Approve, Request changes, or Reject."}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"approval": ApprovalSerializer(approval).data, "invoice": InvoiceSerializer(invoice).data})


@api_view(["GET", "POST"])
def payment_list(request):
    if request.method == "GET":
        queryset = Payment.objects.select_related("invoice", "invoice__vendor").order_by("-created_at")
        return Response(PaymentSerializer(queryset, many=True).data)
    invoice_id = request.data.get("invoice") or request.data.get("invoice_id")
    try:
        invoice = Invoice.objects.get(pk=invoice_id)
    except (Invoice.DoesNotExist, TypeError, ValueError):
        return Response({"error": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)
    if invoice.status not in ("APPROVED", "PAID"):
        return Response({"error": "Only approved invoices can be scheduled for payment."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        amount = Decimal(str(request.data.get("amount", invoice.total_amount)))
    except InvalidOperation:
        return Response({"error": "Invalid payment amount."}, status=status.HTTP_400_BAD_REQUEST)
    if amount <= 0 or amount > invoice.total_amount:
        return Response({"error": "Payment amount must be positive and cannot exceed the invoice total."}, status=status.HTTP_400_BAD_REQUEST)
    reference = request.data.get("payment_reference") or f"APF-{uuid4().hex[:10].upper()}"
    payment = Payment.objects.create(
        invoice=invoice,
        payment_reference=reference,
        amount=amount,
        payment_date=request.data.get("payment_date") or None,
        payment_method=request.data.get("payment_method", "Bank transfer"),
        status="PENDING",
    )
    audit("PAYMENT_CREATED", f"Payment {reference} created. No bank transfer was initiated.", invoice, request.user)
    return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
def payment_detail(request, pk):
    try:
        payment = Payment.objects.select_related("invoice").get(pk=pk)
    except Payment.DoesNotExist:
        raise Http404
    new_status = str(request.data.get("status", "")).upper()
    valid = {choice[0] for choice in Payment.STATUS_CHOICES}
    if new_status not in valid:
        return Response({"error": f"Status must be one of {sorted(valid)}."}, status=status.HTTP_400_BAD_REQUEST)
    payment.status = new_status
    if request.data.get("payment_date"):
        payment.payment_date = request.data["payment_date"]
    payment.save()
    if new_status == "COMPLETED":
        invoice = payment.invoice
        if (invoice.payments.filter(status="COMPLETED").aggregate(total=Sum("amount"))["total"] or Decimal("0")) >= invoice.total_amount:
            invoice.status = "PAID"
            invoice.save(update_fields=["status", "updated_at"])
    audit("PAYMENT_STATUS_UPDATED", f"Payment {payment.payment_reference} updated to {new_status}.", payment.invoice, request.user)
    return Response(PaymentSerializer(payment).data)


@api_view(["GET"])
def audit_log_list(request):
    queryset = AuditLog.objects.select_related("user", "invoice").order_by("-timestamp")
    search = request.query_params.get("search")
    if search:
        queryset = queryset.filter(action__icontains=search) | queryset.filter(description__icontains=search)
    return Response(AuditLogSerializer(queryset[:500], many=True).data)


def build_report_summary():
    invoices = Invoice.objects.all()
    today = timezone.localdate()
    pending = invoices.filter(status__in=["PENDING_REVIEW", "PENDING_APPROVAL"])
    overdue = invoices.filter(due_date__lt=today).exclude(status__in=["PAID", "REJECTED"])
    return {
        "total_invoices": invoices.count(),
        "total_amount": invoices.aggregate(total=Sum("total_amount"))["total"] or 0,
        "pending_approvals": invoices.filter(status="PENDING_APPROVAL").count(),
        "pending_review": invoices.filter(status="PENDING_REVIEW").count(),
        "approved_invoices": invoices.filter(status="APPROVED").count(),
        "paid_invoices": invoices.filter(status="PAID").count(),
        "payments_pending": Payment.objects.exclude(status__in=["COMPLETED", "FAILED"]).count(),
        "overdue_invoices": overdue.count(),
        "overdue_amount": overdue.aggregate(total=Sum("total_amount"))["total"] or 0,
        "exception_count": sum(len(errors) for errors in pending.values_list("validation_errors", flat=True)),
        "vendor_count": Vendor.objects.filter(is_active=True).count(),
        "invoices_by_status": list(invoices.values("status").annotate(count=Count("id")).order_by("status")),
    }


@api_view(["GET"])
def report_summary(request):
    return Response(build_report_summary())


@api_view(["GET"])
def dashboard_summary(request):
    summary = build_report_summary()
    recent = InvoiceSerializer(Invoice.objects.select_related("vendor").prefetch_related("approvals", "payments").order_by("-created_at")[:8], many=True).data
    top_vendors = list(Vendor.objects.annotate(spend=Sum("invoices__total_amount")).values("id", "name", "vendor_code", "spend").order_by("-spend")[:5])
    activity = AuditLogSerializer(AuditLog.objects.select_related("invoice").order_by("-timestamp")[:8], many=True).data
    return Response({"summary": summary, "recent_invoices": recent, "top_vendors": top_vendors, "recent_activity": activity})


@api_view(["GET", "POST"])
def approval_rule_list(request):
    if request.method == "GET":
        return Response(ApprovalRuleSerializer(ApprovalRule.objects.all(), many=True).data)
    serializer = ApprovalRuleSerializer(data=request.data)
    if serializer.is_valid():
        rule = serializer.save()
        audit("APPROVAL_RULE_CREATED", f"Approval rule '{rule.name}' created.")
        return Response(ApprovalRuleSerializer(rule).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PATCH", "DELETE"])
def approval_rule_detail(request, pk):
    try:
        rule = ApprovalRule.objects.get(pk=pk)
    except ApprovalRule.DoesNotExist:
        raise Http404
    if request.method == "DELETE":
        rule.is_active = False
        rule.save(update_fields=["is_active"])
        return Response({"message": "Approval rule deactivated."})
    serializer = ApprovalRuleSerializer(rule, data=request.data, partial=True)
    if serializer.is_valid():
        rule = serializer.save()
        audit("APPROVAL_RULE_UPDATED", f"Approval rule '{rule.name}' updated.")
        return Response(ApprovalRuleSerializer(rule).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
