import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { request } from "./services/client";
import type { ApprovalAction } from "./workflow";

export type Invoice = {
  id: string;
  recordId: number;
  vendor: string;
  vendorId: number;
  date: string;
  due: string;
  dateISO?: string | undefined;
  dueISO?: string | undefined;
  amount: number;
  tax: number;
  validation: string;
  approval: string;
  approvalId?: number | undefined;
  approverRole?: string | undefined;
  payment: string;
  po: string;
  gstin?: string | undefined;
  extractedGst?: string | undefined;
  subtotal?: number;
  status?: string | undefined;
  invoiceFile?: string | null | undefined;
  extractedText?: string | undefined;
  validationErrors?: string[] | undefined;
  items?: Array<{ id?: number | undefined; description: string; quantity: number; unit_price: number; tax_amount: number; amount: number }>;
};

export type Vendor = { name: string; code: string; email: string; phone: string; gstin: string; status: string; onboarding: string; spend: number; recordId?: number; address?: string; panNumber?: string; bankAccountNumber?: string; ifscCode?: string };
export type PurchaseOrderRow = { id: string; vendor: string; date: string; amount: number; quantity: number; status: string; recordId: number; vendorId: number; items: Array<{ id: number; description: string; quantity: number; unitPrice: number; amount: number }> };
export type GoodsReceiptRow = { id: string; po: string; vendor: string; date: string; quantity: number; status: string; recordId: number };
export type PaymentRow = { id: number; reference: string; invoice: string; vendor: string; amount: number; due: string; method: string; status: string; date: string };
export type ActivityRow = { title: string; detail: string; time: string; kind: string };

type ApiInvoice = {
  id: number; invoice_number: string | null; invoice_date: string | null; due_date: string | null;
  total_amount: string | number; tax_amount: string | number; subtotal: string | number;
  status: string; validation_errors: string[]; vendor: number; vendor_name: string; vendor_gst?: string;
  purchase_order_number?: string | null; purchase_order?: number | null; invoice_file?: string | null;
  extracted_text?: string; extracted_gst_number?: string; items?: Invoice["items"]; approvals?: Array<{ id: number; status: string; approval_level: number; approver_role?: string }>;
  payments?: Array<{ status: string }>;
};

type ApiVendor = { id: number; name: string; vendor_code: string; email: string; phone: string; gst_number: string; is_active: boolean; address?: string; pan_number?: string; bank_account_number?: string; ifsc_code?: string };

const money = (value: unknown) => Number(value ?? 0) || 0;
const dateLabel = (value: string | null | undefined) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function mapInvoice(row: ApiInvoice): Invoice {
  const approved = row.status === "APPROVED";
  const rejected = row.status === "REJECTED";
  const paid = row.status === "PAID" || row.payments?.some((p) => p.status === "COMPLETED");
  const pendingApproval = row.approvals?.find((a) => a.status === "PENDING");
  const lastPaymentStatus = row.payments?.at(-1)?.status;
  const validation = row.validation_errors?.length ? "Exception" : row.status === "PENDING_REVIEW" ? "Review" : "Passed";
  return {
    id: row.invoice_number || `DRAFT-${row.id}`,
    recordId: row.id,
    vendor: row.vendor_name,
    vendorId: row.vendor,
    date: dateLabel(row.invoice_date),
    due: dateLabel(row.due_date),
    dateISO: row.invoice_date ?? undefined,
    dueISO: row.due_date ?? undefined,
    amount: money(row.total_amount),
    tax: money(row.tax_amount),
    subtotal: money(row.subtotal),
    validation,
    approval: approved ? "Approved" : rejected ? "Rejected" : row.status === "PENDING_APPROVAL" ? "Pending" : row.status === "PENDING_REVIEW" ? "Needs review" : "—",
    approvalId: pendingApproval?.id,
    approverRole: pendingApproval?.approver_role,
    payment: paid ? "Paid" : lastPaymentStatus ? lastPaymentStatus[0] + lastPaymentStatus.slice(1).toLowerCase() : "Unpaid",
    po: row.purchase_order_number || "Not linked",
    gstin: row.vendor_gst,
    extractedGst: row.extracted_gst_number,
    status: row.status,
    invoiceFile: row.invoice_file,
    extractedText: row.extracted_text,
    validationErrors: row.validation_errors ?? [],
    items: row.items ?? [],
  };
}

function mapVendor(row: ApiVendor, invoices: Invoice[]): Vendor {
  const spend = invoices.filter((invoice) => invoice.vendorId === row.id).reduce((sum, invoice) => sum + invoice.amount, 0);
  return { name: row.name, code: row.vendor_code, email: row.email ?? "", phone: row.phone ?? "", gstin: row.gst_number ?? "", status: row.is_active ? "Active" : "Inactive", onboarding: row.is_active ? "Complete" : "Inactive", spend, recordId: row.id, address: row.address ?? "", panNumber: row.pan_number ?? "", bankAccountNumber: row.bank_account_number ?? "", ifscCode: row.ifsc_code ?? "" };
}

function mapPurchaseOrder(row: any): PurchaseOrderRow {
  return { id: row.po_number, vendor: row.vendor_name, date: dateLabel(row.order_date), amount: money(row.total_amount), quantity: (row.items ?? []).reduce((sum: number, item: any) => sum + money(item.quantity), 0), vendorId: row.vendor, items: (row.items ?? []).map((item: any) => ({ id: item.id, description: item.description, quantity: money(item.quantity), unitPrice: money(item.unit_price), amount: money(item.amount) })), status: row.status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()), recordId: row.id };
}

function mapReceipt(row: any): GoodsReceiptRow {
  return { id: row.grn_number, po: row.po_number, vendor: row.vendor_name, date: dateLabel(row.received_date), quantity: (row.items ?? []).reduce((sum: number, item: any) => sum + money(item.received_quantity), 0), status: "Received", recordId: row.id };
}

const ApFlowContext = createContext<{
  invoices: Invoice[]; vendors: Vendor[]; purchaseOrders: PurchaseOrderRow[]; receipts: GoodsReceiptRow[];
  payments: PaymentRow[]; activities: ActivityRow[]; loading: boolean; apiError: string | null;
  refresh: () => Promise<void>; updateInvoice: (id: string, changes: Partial<Invoice>) => Promise<void>;
  decideInvoice: (id: string, action: ApprovalAction, comment?: string) => Promise<void>;
  updatePaymentStatus: (paymentId: number, status: "PROCESSING" | "COMPLETED" | "FAILED") => Promise<void>;
  addVendor: (vendor: Vendor) => Promise<void>; uploadInvoice: (file: File, vendorId: number) => Promise<void>; createPayment: (invoiceRecordId: number, amount?: number) => Promise<void>;
} | null>(null);

export function ApFlowProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceiptRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [invoiceRows, vendorRows, poRows, receiptRows, paymentRows, auditRows] = await Promise.all([
        request<ApiInvoice[]>("/api/invoices/"), request<ApiVendor[]>("/api/vendors/"),
        request<any[]>("/api/purchase-orders/"), request<any[]>("/api/goods-receipts/"),
        request<any[]>("/api/payments/"), request<any[]>("/api/audit-logs/"),
      ]);
      const mappedInvoices = invoiceRows.map(mapInvoice);
      setInvoices(mappedInvoices);
      setVendors(vendorRows.map((row) => mapVendor(row, mappedInvoices)));
      setPurchaseOrders(poRows.map(mapPurchaseOrder));
      setReceipts(receiptRows.map(mapReceipt));
      setPayments(paymentRows.map((p) => ({ id: p.id, reference: p.payment_reference, invoice: p.invoice_number || `Invoice ${p.invoice}`, vendor: p.vendor_name, amount: money(p.amount), due: "—", method: p.payment_method, status: p.status[0] + p.status.slice(1).toLowerCase(), date: p.payment_date ? dateLabel(p.payment_date) : "—" })));
      setActivities(auditRows.map((a) => ({ title: a.action.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()), detail: `${a.invoice_number || "Workspace"} · ${a.description}`, time: new Date(a.timestamp).toLocaleString(), kind: /APPROVED|COMPLETED|CREATED/.test(a.action) ? "success" : /REJECTED|EXCEPTION/.test(a.action) ? "warning" : "info" })));
      setApiError(null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to connect to the Django API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const updateInvoice = useCallback(async (id: string, changes: Partial<Invoice>) => {
    const invoice = invoices.find((item) => item.id === id);
    if (!invoice) throw new Error("Invoice not found in the current list.");
    const payload: Record<string, unknown> = {};
    if (changes.id) payload["invoice_number"] = changes.id;
    if (changes.dateISO) payload["invoice_date"] = changes.dateISO;
    if (changes.dueISO) payload["due_date"] = changes.dueISO;
    if (changes.amount !== undefined) payload["total_amount"] = changes.amount;
    if (changes.tax !== undefined) payload["tax_amount"] = changes.tax;
    if (changes.subtotal !== undefined) payload["subtotal"] = changes.subtotal;
    if (changes.gstin !== undefined) payload["extracted_gst_number"] = changes.gstin;
    await request(`/api/invoices/${invoice.recordId}/`, { method: "PATCH", body: JSON.stringify(payload) });
    await request(`/api/invoices/${invoice.recordId}/validate/`, { method: "POST", body: JSON.stringify({}) });
    await refresh();
  }, [invoices, refresh]);

  const decideInvoice = useCallback(async (id: string, action: ApprovalAction, comment = "") => {
    const invoice = invoices.find((item) => item.id === id);
    if (!invoice?.approvalId) throw new Error("No pending approval is assigned to this invoice.");
    await request(`/api/approvals/${invoice.approvalId}/decision/`, { method: "POST", body: JSON.stringify({ action, comment }) });
    await refresh();
  }, [invoices, refresh]);

  const addVendor = useCallback(async (vendor: Vendor) => {
    await request("/api/vendors/", { method: "POST", body: JSON.stringify({
      name: vendor.name, vendor_code: vendor.code, email: vendor.email, phone: vendor.phone,
      gst_number: vendor.gstin, address: vendor.address ?? "", pan_number: vendor.panNumber ?? "", bank_account_number: vendor.bankAccountNumber ?? "", ifsc_code: vendor.ifscCode ?? "", is_active: true,
    }) });
    await refresh();
  }, [refresh]);

  const uploadInvoice = useCallback(async (file: File, vendorId: number) => {
    const body = new FormData();
    body.append("file", file);
    body.append("vendor_id", String(vendorId));
    await request("/api/invoices/upload/", { method: "POST", body });
    await refresh();
  }, [refresh]);

  const createPayment = useCallback(async (invoiceRecordId: number, amount?: number) => {
    await request("/api/payments/", { method: "POST", body: JSON.stringify({ invoice_id: invoiceRecordId, amount, payment_method: "Bank transfer" }) });
    await refresh();
  }, [refresh]);

  const updatePaymentStatus = useCallback(async (paymentId: number, status: "PROCESSING" | "COMPLETED" | "FAILED") => {
    await request(`/api/payments/${paymentId}/`, { method: "PATCH", body: JSON.stringify({ status }) });
    await refresh();
  }, [refresh]);

  const value = useMemo(() => ({ invoices, vendors, purchaseOrders, receipts, payments, activities, loading, apiError, refresh, updateInvoice, decideInvoice, addVendor, uploadInvoice, createPayment, updatePaymentStatus }), [invoices, vendors, purchaseOrders, receipts, payments, activities, loading, apiError, refresh, updateInvoice, decideInvoice, addVendor, uploadInvoice, createPayment, updatePaymentStatus]);
  return <ApFlowContext.Provider value={value}>{children}</ApFlowContext.Provider>;
}

export function useApFlow() {
  const state = useContext(ApFlowContext);
  if (!state) throw new Error("useApFlow must be used within ApFlowProvider");
  return state;
}
