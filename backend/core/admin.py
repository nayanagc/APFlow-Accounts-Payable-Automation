from django.contrib import admin
from .models import (
    Vendor, PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem,
    Invoice, InvoiceItem, Approval, Payment, AuditLog, ApprovalRule,
)

admin.site.register([Vendor, PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem, Invoice, InvoiceItem, Approval, Payment, AuditLog, ApprovalRule])
