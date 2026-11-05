from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.report_summary, name="api-health"),
    path("dashboard/", views.dashboard_summary, name="dashboard-summary"),
    path("reports/summary/", views.report_summary, name="report-summary"),
    path("invoices/", views.invoice_list, name="invoice-list"),
    path("invoices/upload/", views.upload_invoice, name="invoice-upload"),
    path("invoices/<int:pk>/", views.invoice_detail, name="invoice-detail"),
    path("invoices/<int:pk>/validate/", views.validate_invoice_view, name="invoice-validate"),
    path("vendors/", views.vendor_list, name="vendor-list"),
    path("vendors/<int:pk>/", views.vendor_detail, name="vendor-detail"),
    path("purchase-orders/", views.purchase_order_list, name="purchase-order-list"),
    path("goods-receipts/", views.goods_receipt_list, name="goods-receipt-list"),
    path("approvals/", views.approval_list, name="approval-list"),
    path("approval-rules/", views.approval_rule_list, name="approval-rule-list"),
    path("approval-rules/<int:pk>/", views.approval_rule_detail, name="approval-rule-detail"),
    path("approvals/<int:pk>/decision/", views.approval_decision, name="approval-decision"),
    path("payments/", views.payment_list, name="payment-list"),
    path("payments/<int:pk>/", views.payment_detail, name="payment-detail"),
    path("audit-logs/", views.audit_log_list, name="audit-log-list"),
]
