from rest_framework import serializers
from .models import (
    Vendor, PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem,
    Invoice, InvoiceItem, Approval, Payment, AuditLog, ApprovalRule,
)


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = "__all__"


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = "__all__"


class PurchaseOrderSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    items = PurchaseOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = "__all__"


class GoodsReceiptItemSerializer(serializers.ModelSerializer):
    description = serializers.CharField(source="purchase_order_item.description", read_only=True)

    class Meta:
        model = GoodsReceiptItem
        fields = "__all__"


class GoodsReceiptSerializer(serializers.ModelSerializer):
    po_number = serializers.CharField(source="purchase_order.po_number", read_only=True)
    vendor_name = serializers.CharField(source="purchase_order.vendor.name", read_only=True)
    items = GoodsReceiptItemSerializer(many=True, read_only=True)

    class Meta:
        model = GoodsReceipt
        fields = "__all__"


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = "__all__"


class ApprovalSerializer(serializers.ModelSerializer):
    approver_name = serializers.CharField(source="approver.username", read_only=True, default="Unassigned")

    class Meta:
        model = Approval
        fields = "__all__"


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    vendor_name = serializers.CharField(source="invoice.vendor.name", read_only=True)

    class Meta:
        model = Payment
        fields = "__all__"


class InvoiceSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    vendor_gst = serializers.CharField(source="vendor.gst_number", read_only=True)
    purchase_order_number = serializers.CharField(source="purchase_order.po_number", read_only=True, allow_null=True)
    items = InvoiceItemSerializer(many=True, read_only=True)
    approvals = ApprovalSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = "__all__"


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True, default="System")
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True, allow_null=True)

    class Meta:
        model = AuditLog
        fields = "__all__"


class ApprovalRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalRule
        fields = "__all__"
