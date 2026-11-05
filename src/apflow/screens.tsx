import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Download, FileCheck2, FileText, Filter, Plus, UploadCloud, X, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, FilterSelect, PageTitle, Panel, SearchField, StatusBadge } from "./common";
import { formatMoney } from "./data";
import { useApFlow } from "./state";
import type { ApprovalAction } from "./workflow";
import { request } from "./services/client";

export type PageKind = "invoices" | "upload" | "review" | "vendors" | "purchase-orders" | "goods-receipts" | "approvals" | "payments" | "reports" | "audit-logs" | "settings";
const moneyColumn = (key: string, label: string) => ({ key, label, align: "right" as const, render: (row: Record<string, unknown>) => formatMoney(Number(row[key] ?? 0)) });
const statusColumn = (key: string, label: string) => ({ key, label, render: (row: Record<string, unknown>) => <StatusBadge status={String(row[key] ?? "—")} /> });

function ApiNotice() {
  const { apiError, loading } = useApFlow();
  if (loading || !apiError) return null;
  return <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>Django API is not reachable: {apiError}. Start the backend at <code>http://127.0.0.1:8000</code> and refresh.</span></div>;
}

function InvoiceListing() {
  const { invoices, loading, refresh } = useApFlow();
  const [search, setSearch] = useState("");
  const [approval, setApproval] = useState("all");
  const [payment, setPayment] = useState("all");
  const [validation, setValidation] = useState("all");
  const rows = invoices.filter((item) => (approval === "all" || item.approval === approval) && (payment === "all" || item.payment === payment) && (validation === "all" || item.validation === validation)).map((item) => ({ ...item, invoice: item.id }));
  return <><ApiNotice /><PageTitle eyebrow="AP operations" title="Invoices" description="Review, validate, and track vendor invoices stored in PostgreSQL." action={<div className="flex gap-2"><Button variant="outline" onClick={() => void refresh()}><RefreshCw /> Refresh</Button><Button asChild><Link to="/upload"><UploadCloud /> Upload invoice</Link></Button></div>} /><Panel title="Invoice register" subtitle={`${invoices.length} invoice record${invoices.length === 1 ? "" : "s"} from the AP database`}><div className="mb-4 flex flex-wrap gap-2"><SearchField value={search} onChange={setSearch} placeholder="Search invoice, vendor, PO..." /><FilterSelect value={approval} onChange={setApproval} options={[...new Set(invoices.map((item) => item.approval))]} placeholder="Approval" /><FilterSelect value={payment} onChange={setPayment} options={[...new Set(invoices.map((item) => item.payment))]} placeholder="Payment" /><FilterSelect value={validation} onChange={setValidation} options={[...new Set(invoices.map((item) => item.validation))]} placeholder="Validation" /><Button variant={validation === "Exception" ? "default" : "outline"} size="icon" title="Show validation exceptions" aria-label="Show validation exceptions" onClick={() => setValidation(validation === "Exception" ? "all" : "Exception")}><Filter /></Button></div><DataTable search={search} rows={rows as unknown as Record<string, unknown>[]} columns={[{ key: "invoice", label: "Invoice number", render: (row) => <span className="font-semibold text-primary">{String(row["invoice"])}</span> }, { key: "vendor", label: "Vendor" }, { key: "date", label: "Invoice date" }, { key: "due", label: "Due date" }, moneyColumn("amount", "Amount"), statusColumn("validation", "Validation"), statusColumn("approval", "Approval"), statusColumn("payment", "Payment")]} />{!loading && invoices.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No invoices yet. Upload a PDF or image to start the workflow.</p>}</Panel></>;
}

function UploadScreen() {
  const { vendors, uploadInvoice, refresh } = useApFlow();
  const [files, setFiles] = useState<File[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted: File[] = [];
    Array.from(list).forEach((file) => {
      if (!/\.(pdf|jpe?g|png|tiff?)$/i.test(file.name)) toast.error(`${file.name}: unsupported file type`);
      else if (file.size > 20 * 1024 * 1024) toast.error(`${file.name}: file exceeds 20 MB`);
      else accepted.push(file);
    });
    setFiles((current) => [...current, ...accepted]);
    setResults([]);
  };
  const submit = async () => {
    if (!vendorId) { toast.error("Select the vendor for these documents."); return; }
    setBusy(true);
    const completed: string[] = [];
    for (const file of files) {
      try { await uploadInvoice(file, Number(vendorId)); completed.push(`${file.name}: uploaded and processed`); }
      catch (error) { completed.push(`${file.name}: ${error instanceof Error ? error.message : "Upload failed"}`); }
    }
    setResults(completed);
    setFiles([]);
    setBusy(false);
    await refresh();
    const successful = completed.filter((item) => item.includes("uploaded and processed")).length;
    if (successful) toast.success(`${successful} invoice file${successful === 1 ? "" : "s"} uploaded.`);
    if (successful !== completed.length) toast.error("Some files need attention. See the results below.");
  };
  return <><ApiNotice /><PageTitle eyebrow="Invoice intake" title="Upload invoices" description="Upload vendor PDF or image invoices. OCR extracts the fields and line items for review." /><div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]"><Panel title="Add documents" subtitle="PDF, JPG, PNG, or TIFF · up to 20 MB each · bulk selection supported"><label className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-5 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:bg-muted/60"}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}><span className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10"><UploadCloud className="size-6 text-primary" /></span><span className="text-sm font-semibold">Drag files here or browse</span><span className="mt-1 text-xs text-muted-foreground">Scanned and text PDFs are supported</span><input className="sr-only" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" aria-label="Select invoice files" onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label><label className="mt-4 block space-y-1.5 text-xs font-medium">Vendor<select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={vendorId} onChange={(event) => setVendorId(event.target.value)}><option value="">Choose vendor…</option>{vendors.filter((vendor) => vendor.status === "Active").map((vendor) => <option key={vendor.recordId} value={vendor.recordId}>{vendor.name} · {vendor.code}</option>)}</select></label>{files.length > 0 && <div className="mt-4 space-y-2">{files.map((file, index) => <div className="flex items-center gap-3 rounded-sm border border-border px-3 py-2.5" key={`${file.name}-${index}`}><FileText className="size-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{file.name}</p><p className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to upload</p></div><Button variant="ghost" size="icon" title="Remove file" aria-label={`Remove ${file.name}`} onClick={() => setFiles((items) => items.filter((_, i) => i !== index))}><X /></Button></div>)}</div>}<Button className="mt-4 w-full" disabled={!files.length || busy || !vendorId} onClick={() => void submit()}>{busy ? "Uploading and running OCR…" : <><UploadCloud /> Upload and process {files.length || ""}</>}</Button>{results.length > 0 && <div className="mt-4 space-y-2 rounded-md border border-border p-3 text-xs">{results.map((result) => <p key={result} className={result.includes("uploaded and processed") ? "text-success" : "text-destructive"}>{result}</p>)}</div>}</Panel><Panel title="Processing stages" subtitle="Live backend workflow"><div className="space-y-4">{["Secure file upload", "PDF text extraction / Tesseract OCR", "Header and line-item extraction", "Duplicate, GST and amount checks", "PO / GRN matching", "Manual review and approval"].map((label, index) => <div className="flex items-start gap-3" key={label}><span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span><div><p className="text-sm font-medium">{label}</p><p className="mt-1 text-[11px] text-muted-foreground">{index === 1 ? "Multi-page PDFs supported; scanned pages use Tesseract." : index === 5 ? "Exceptions stay in review until corrected." : "Executed by Django services when an invoice is submitted."}</p></div></div>)}</div></Panel></div></>;
}

function ReviewScreen() {
  const { invoices, updateInvoice, refresh } = useApFlow();
  const [invoiceId, setInvoiceId] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const invoice = invoices.find((item) => item.id === invoiceId) ?? invoices.find((item) => item.validation !== "Passed") ?? invoices[0];
  useEffect(() => { if (invoice && !invoiceId) setInvoiceId(invoice.id); }, [invoice, invoiceId]);
  useEffect(() => { setFields({}); }, [invoiceId]);
  if (!invoice) return <><PageTitle eyebrow="Manual verification" title="OCR extraction review" description="Uploaded invoices will appear here." /><Panel title="Nothing to review"><p className="text-sm text-muted-foreground">Upload an invoice to view the extracted fields and line items.</p><Button asChild className="mt-4"><Link to="/upload">Upload invoice</Link></Button></Panel></>;
  const values: Record<string, string> = {
    invoice: invoice.id, gstin: invoice.extractedGst ?? invoice.gstin ?? "", date: invoice.dateISO ?? "", due: invoice.dueISO ?? "",
    subtotal: String(invoice.subtotal ?? 0), tax: String(invoice.tax), total: String(invoice.amount),
  };
  const fieldsSpec: Array<[string, string, string]> = [["Invoice number", "invoice", "text"], ["Invoice GSTIN", "gstin", "text"], ["Invoice date", "date", "date"], ["Due date", "due", "date"], ["Subtotal", "subtotal", "number"], ["Tax amount", "tax", "number"], ["Total amount", "total", "number"]];
  const save = async (confirm: boolean) => {
    setBusy(true);
    try {
      await updateInvoice(invoice.id, {
        id: fields["invoice"] ?? invoice.id,
        gstin: fields["gstin"] ?? invoice.extractedGst ?? invoice.gstin ?? "",
        dateISO: fields["date"] ?? invoice.dateISO,
        dueISO: fields["due"] ?? invoice.dueISO,
        subtotal: Number(fields["subtotal"] ?? invoice.subtotal ?? 0),
        tax: Number(fields["tax"] ?? invoice.tax),
        amount: Number(fields["total"] ?? invoice.amount),
      });
      await refresh();
      toast.success(confirm ? "Corrections saved and validation rerun." : "Corrections saved and validation rerun.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save corrections."); }
    finally { setBusy(false); }
  };
  return <><ApiNotice /><PageTitle eyebrow="Manual verification" title="OCR extraction review" description="Verify extracted invoice fields, inspect line items, and rerun validation after corrections." /><div className="mb-5 flex flex-wrap items-center gap-3"><label className="text-sm font-medium" htmlFor="review-invoice">Invoice</label><select id="review-invoice" className="h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm" value={invoice.id} onChange={(event) => setInvoiceId(event.target.value)}>{invoices.map((item) => <option key={item.recordId} value={item.id}>{item.id} · {item.vendor}</option>)}</select><StatusBadge status={invoice.validation} /></div><div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><Panel title="Source document" subtitle={invoice.invoiceFile?.split("/").pop() ?? "No file attached"}><div className="flex min-h-[300px] flex-col items-center justify-center rounded-sm border border-border bg-muted/30 p-6 text-center"><FileText className="mb-3 size-10 text-primary" /><p className="font-semibold">{invoice.invoiceFile ? "Invoice document stored" : "Document unavailable"}</p>{invoice.invoiceFile && <a className="mt-2 text-xs text-primary underline" href={`http://127.0.0.1:8000${invoice.invoiceFile}`} target="_blank" rel="noreferrer">Open uploaded document</a>}<p className="mt-3 text-xs text-muted-foreground">Field coverage estimate: {invoice.status ? "Based on populated OCR fields; not a model confidence score." : "Not available."}</p></div><div className="mt-4"><p className="mb-2 text-xs font-semibold">Extracted text</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-sm bg-muted p-3 text-[10px] leading-5">{invoice.extractedText || "No extracted text stored."}</pre></div></Panel><div className="space-y-5"><Panel title="Extracted fields" subtitle="Edit values and save to the database"><div className="grid gap-3 sm:grid-cols-2">{fieldsSpec.map(([label, key, type]) => <label className="space-y-1.5" key={key}><span className="text-[11px] font-medium">{label}</span><Input type={type} step={type === "number" ? "0.01" : undefined} value={fields[key] ?? values[key]} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div><Button className="mt-4" disabled={busy} onClick={() => void save(true)}><CheckCircle2 /> {busy ? "Saving…" : "Save corrections and validate"}</Button>{invoice.validationErrors && invoice.validationErrors.length > 0 && <div className="mt-4 rounded-sm border border-warning/30 bg-warning/10 p-3"><p className="mb-2 text-xs font-semibold text-warning-foreground">Validation exceptions</p><ul className="list-disc space-y-1 pl-4 text-xs text-warning-foreground">{invoice.validationErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}</Panel><Panel title="Extracted line items" subtitle="Rows parsed from the invoice table"><div className="overflow-x-auto"><table className="w-full min-w-[440px] text-left text-xs"><thead className="border-b border-border text-muted-foreground"><tr>{["Description", "Qty", "Unit price", "Tax", "Line total"].map((col) => <th className="px-2 py-2 font-medium" key={col}>{col}</th>)}</tr></thead><tbody>{(invoice.items ?? []).map((line, index) => <tr className="border-b border-border last:border-0" key={line.id ?? index}><td className="px-2 py-2">{line.description}</td><td className="px-2 py-2">{line.quantity}</td><td className="px-2 py-2">{formatMoney(line.unit_price)}</td><td className="px-2 py-2">{formatMoney(line.tax_amount)}</td><td className="px-2 py-2">{formatMoney(line.amount)}</td></tr>)}</tbody></table>{!invoice.items?.length && <p className="py-5 text-center text-xs text-muted-foreground">No line items were extracted from this file.</p>}</div></Panel></div></div></>;
}

function VendorListing() {
  const { vendors, addVendor } = useApFlow();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  return <><ApiNotice /><PageTitle eyebrow="Supplier directory" title="Vendors" description="Maintain supplier tax, contact, and bank master details." action={<Button onClick={() => setShowForm((show) => !show)}><Plus /> Add vendor</Button>} />{showForm && <Panel title="Add vendor" subtitle="Vendor details are saved in PostgreSQL"><form className="mb-5 grid gap-3 sm:grid-cols-2" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const name = String(data.get("name") ?? ""); const gstin = String(data.get("gstin") ?? "").toUpperCase(); if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) { toast.error("Enter a valid GSTIN format."); return; } setBusy(true); try { await addVendor({ name, code: `VEN-${Date.now()}`, email: String(data.get("email") ?? ""), phone: String(data.get("phone") ?? ""), gstin, status: "Active", onboarding: "Complete", spend: 0, address: String(data.get("address") ?? ""), panNumber: String(data.get("pan") ?? ""), bankAccountNumber: String(data.get("bank") ?? ""), ifscCode: String(data.get("ifsc") ?? "") }); form.reset(); setShowForm(false); toast.success("Vendor created."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create vendor."); } finally { setBusy(false); } }}><Input required name="name" placeholder="Vendor name" /><Input required name="gstin" placeholder="GSTIN" /><Input name="email" type="email" placeholder="Contact email" /><Input name="phone" placeholder="Phone" /><Input name="pan" placeholder="PAN (optional)" /><Input name="address" placeholder="Address" /><Input name="bank" placeholder="Bank account number" /><Input name="ifsc" placeholder="IFSC code" /><div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save vendor"}</Button></div></form></Panel>}<Panel title="Vendor directory" subtitle={`${vendors.length} vendor record${vendors.length === 1 ? "" : "s"}`}><div className="mb-4"><SearchField value={search} onChange={setSearch} placeholder="Search vendor, code, GSTIN..." /></div><DataTable search={search} rows={vendors as unknown as Record<string, unknown>[]} columns={[{ key: "name", label: "Vendor", render: (row) => <div><p className="font-semibold">{String(row["name"])}</p><p className="mt-1 text-[10px] text-muted-foreground">{String(row["code"])}</p></div> }, { key: "email", label: "Contact email" }, { key: "phone", label: "Phone" }, { key: "gstin", label: "GSTIN" }, { key: "spend", label: "Lifetime spend", align: "right", render: (row) => formatMoney(Number(row["spend"])) }, statusColumn("status", "Status"), statusColumn("onboarding", "Onboarding")]} />{vendors.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No vendors yet. Add a vendor before uploading an invoice.</p>}</Panel></>;
}

function ApprovalListing() {
  const { invoices, decideInvoice } = useApFlow();
  const [selected, setSelected] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = invoices.filter((invoice) => invoice.approval === "Pending" && invoice.approvalId).map((row) => ({ ...row, invoice: row.id, approver: row.approverRole ?? "Manager", stage: "Level-based review" }));
  const decide = async (action: ApprovalAction) => {
    const id = selected || String(rows[0]?.id ?? "");
    if (!id) return;
    setBusy(true);
    try { await decideInvoice(id, action, comment); toast.success(`${id}: ${action.toLowerCase()} recorded.`); setSelected(""); setComment(""); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to record decision."); }
    finally { setBusy(false); }
  };
  return <><ApiNotice /><PageTitle eyebrow="Decision queue" title="Approvals" description="Record approval, change requests, and rejection decisions against persisted approval steps." /><div className="mb-5 flex flex-wrap gap-2"><StatusBadge status={`${rows.length} pending`} /><StatusBadge status="Approval matrix" /></div><Panel title="Awaiting review" subtitle="Invoices that passed validation and entered the approval workflow"><div className="mb-4 max-w-md"><Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a review comment (optional)" rows={2} /></div><DataTable selectedId={selected} onRowClick={(row) => setSelected(String(row["id"]))} rows={rows as unknown as Record<string, unknown>[]} columns={[{ key: "invoice", label: "Invoice", render: (row) => <span className="font-semibold text-primary">{String(row["invoice"])}</span> }, { key: "vendor", label: "Vendor" }, moneyColumn("amount", "Amount"), { key: "date", label: "Invoice date" }, { key: "stage", label: "Approval stage" }, { key: "approver", label: "Assigned to" }, statusColumn("validation", "Validation")]} /><div className="flex flex-wrap gap-2 border-t border-border pt-4">{(["Approve", "Request changes", "Reject"] as ApprovalAction[]).map((action) => <Button key={action} variant={action === "Reject" ? "destructive" : action === "Approve" ? "default" : "outline"} disabled={!rows.length || busy} onClick={() => void decide(action)}>{action}</Button>)}</div>{selected && <p className="mt-3 text-xs text-muted-foreground">Selected: {selected}</p>}{!rows.length && <p className="py-5 text-center text-xs text-muted-foreground">No invoices are waiting for approval.</p>}</Panel></>;
}

function ReportsScreen() {
  const { invoices } = useApFlow();
  const [report, setReport] = useState("Accounts Payable Aging");
  const data = useMemo(() => {
    if (report === "Exception Report") return invoices.filter((row) => row.validation === "Exception" || row.validation === "Review");
    if (report === "Invoice Status") return invoices;
    if (report === "Payment Tracking") return invoices.filter((row) => row.payment !== "Unpaid");
    if (report === "GST / Tax Summary") return invoices.filter((row) => row.tax > 0);
    if (report === "Vendor Spending") return invoices;
    return invoices.filter((row) => row.payment === "Overdue" || row.approval === "Pending");
  }, [invoices, report]);
  const exportCsv = () => {
    const headers = ["Invoice", "Vendor", "Invoice date", "Due date", "Amount", "Tax", "Validation", "Approval", "Payment"];
    const lines = [headers, ...data.map((row) => [row.id, row.vendor, row.date, row.due, row.amount, row.tax, row.validation, row.approval, row.payment])].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${report.toLowerCase().replaceAll(" ", "-")}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  return <><ApiNotice /><PageTitle eyebrow="Finance intelligence" title="Reports & analytics" description="Reports are calculated from stored invoice and payment records." /><div className="mb-5 flex flex-wrap gap-2">{["Accounts Payable Aging", "Invoice Status", "Exception Report", "GST / Tax Summary", "Vendor Spending", "Payment Tracking"].map((item) => <Button key={item} variant={report === item ? "default" : "outline"} onClick={() => setReport(item)}>{item}</Button>)}</div><div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">{[{ label: "Amount in report", value: formatMoney(data.reduce((sum, row) => sum + row.amount, 0)) }, { label: "Invoices in report", value: String(data.length) }, { label: "Exceptions", value: String(data.filter((row) => row.validation === "Exception" || row.validation === "Review").length) }, { label: "Data source", value: "PostgreSQL" }].map((item) => <div className="rounded-md border border-border bg-card p-4" key={item.label}><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-2 text-xl font-bold">{item.value}</p></div>)}</div><Panel title={report} subtitle="Live database records" action={<Button variant="outline" onClick={exportCsv}><Download /> Export CSV</Button>}><DataTable rows={data.map((row) => ({ ...row, invoice: row.id })) as unknown as Record<string, unknown>[]} columns={[{ key: "invoice", label: "Invoice" }, { key: "vendor", label: "Vendor" }, { key: "due", label: "Due date" }, moneyColumn("amount", "Amount"), statusColumn("approval", "Approval"), statusColumn("payment", "Payment")]} /></Panel></>;
}

function PurchaseOrdersScreen() {
  const { invoices, purchaseOrders, vendors, refresh } = useApFlow();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ po_number: "", vendor: "", order_date: new Date().toISOString().slice(0, 10), description: "", quantity: "1", unit_price: "0" });
  const matching = purchaseOrders.map((order) => {
    const invoice = invoices.find((item) => item.po === order.id);
    return { ...order, invoice: invoice?.id ?? "No invoice", invoiceAmount: invoice?.amount ?? 0, result: !invoice ? "No invoice" : Math.abs(invoice.amount - order.amount) <= 1 ? "Matched" : "Amount variance" };
  });
  const create = async (event: FormEvent) => {
    event.preventDefault();
    const qty = Number(form.quantity), price = Number(form.unit_price);
    if (!form.vendor || !form.po_number.trim() || !form.description.trim() || qty <= 0 || price < 0) { toast.error("Enter a PO number, vendor, item, quantity, and valid price."); return; }
    setBusy(true);
    try {
      const lineTotal = Number((qty * price).toFixed(2));
      await request("/api/purchase-orders/", { method: "POST", body: JSON.stringify({ po_number: form.po_number.trim(), vendor: Number(form.vendor), order_date: form.order_date, total_amount: lineTotal, status: "OPEN", items: [{ description: form.description.trim(), quantity: qty, unit_price: price, amount: lineTotal }] }) });
      await refresh(); setForm({ ...form, po_number: "", description: "", quantity: "1", unit_price: "0" }); setShowForm(false); toast.success("Purchase order created.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create purchase order."); }
    finally { setBusy(false); }
  };
  return <><ApiNotice /><PageTitle eyebrow="Procurement" title="Purchase orders" description="Create purchase orders and compare linked invoice values." action={<Button onClick={() => setShowForm((value) => !value)}><Plus /> New purchase order</Button>} />{showForm && <Panel title="Create purchase order" subtitle="This quick form creates one PO line item; multi-line POs can be entered through Django admin/API."><form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void create(event)}><Input required placeholder="PO number" value={form.po_number} onChange={(event) => setForm({ ...form, po_number: event.target.value })} /><select required className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })}><option value="">Select vendor…</option>{vendors.map((vendor) => <option key={vendor.recordId} value={vendor.recordId}>{vendor.name}</option>)}</select><label className="space-y-1 text-xs">Order date<Input required type="date" value={form.order_date} onChange={(event) => setForm({ ...form, order_date: event.target.value })} /></label><Input required placeholder="Item description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><label className="space-y-1 text-xs">Quantity<Input required type="number" min="0.01" step="0.01" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label className="space-y-1 text-xs">Unit price (₹)<Input required type="number" min="0" step="0.01" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} /></label><p className="text-sm font-semibold sm:col-span-2">PO total: {formatMoney(Number(form.quantity) * Number(form.unit_price))}</p><div className="sm:col-span-2"><Button type="submit" disabled={busy || !vendors.length}>{busy ? "Saving…" : "Save purchase order"}</Button></div></form></Panel>}<Panel title="Purchase order register" subtitle="Purchase orders and their invoice matching status"><DataTable rows={matching as unknown as Record<string, unknown>[]} columns={[{ key: "id", label: "PO number" }, { key: "vendor", label: "Vendor" }, { key: "date", label: "Order date" }, moneyColumn("amount", "PO amount"), { key: "quantity", label: "Ordered qty", align: "right" }, { key: "invoice", label: "Linked invoice" }, moneyColumn("invoiceAmount", "Invoice amount"), statusColumn("result", "Match result"), statusColumn("status", "PO status")]} />{!matching.length && <p className="py-6 text-center text-xs text-muted-foreground">No purchase orders are registered yet.</p>}</Panel></>;
}

function GoodsReceiptsScreen() {
  const { invoices, purchaseOrders, receipts, refresh } = useApFlow();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ po: "", item: "", grn_number: "", received_date: new Date().toISOString().slice(0, 10), received_quantity: "1" });
  const selectedPo = purchaseOrders.find((order) => String(order.recordId) === form.po);
  const matches = receipts.map((receipt) => {
    const order = purchaseOrders.find((item) => item.id === receipt.po);
    const invoice = invoices.find((item) => item.po === receipt.po);
    const received = Boolean(order && receipt.quantity >= order.quantity);
    const billed = Boolean(order && invoice && Math.abs(invoice.amount - order.amount) <= 1);
    return { ...receipt, orderedQty: order?.quantity ?? 0, invoice: invoice?.id ?? "No invoice", invoiceAmount: invoice?.amount ?? 0, orderAmount: order?.amount ?? 0, match: received && billed ? "Matched" : received ? "Amount variance" : "Quantity variance" };
  });
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPo || !form.item || !form.grn_number.trim() || Number(form.received_quantity) <= 0) { toast.error("Select a PO item and enter a GRN number and positive quantity."); return; }
    setBusy(true);
    try {
      await request("/api/goods-receipts/", { method: "POST", body: JSON.stringify({ grn_number: form.grn_number.trim(), purchase_order: selectedPo.recordId, received_date: form.received_date, received_by: "AP Operations", items: [{ purchase_order_item: Number(form.item), received_quantity: Number(form.received_quantity) }] }) });
      await refresh(); setForm({ ...form, item: "", grn_number: "", received_quantity: "1" }); setShowForm(false); toast.success("Goods receipt recorded.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to record goods receipt."); }
    finally { setBusy(false); }
  };
  return <><ApiNotice /><PageTitle eyebrow="Receiving" title="Goods receipts" description="Record received quantities and compare purchase orders, GRNs, and invoices for three-way matching." action={<Button onClick={() => setShowForm((value) => !value)} disabled={!purchaseOrders.length}><Plus /> Record goods receipt</Button>} />{showForm && <Panel title="Record goods receipt" subtitle="This quick form records one PO line item per receipt."><form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void create(event)}><Input required placeholder="GRN number" value={form.grn_number} onChange={(event) => setForm({ ...form, grn_number: event.target.value })} /><select required className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.po} onChange={(event) => setForm({ ...form, po: event.target.value, item: "" })}><option value="">Select purchase order…</option>{purchaseOrders.map((order) => <option key={order.recordId} value={order.recordId}>{order.id} · {order.vendor}</option>)}</select><select required className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.item} onChange={(event) => setForm({ ...form, item: event.target.value })}><option value="">Select PO item…</option>{(selectedPo?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.description} · ordered {item.quantity}</option>)}</select><label className="space-y-1 text-xs">Received date<Input required type="date" value={form.received_date} onChange={(event) => setForm({ ...form, received_date: event.target.value })} /></label><label className="space-y-1 text-xs">Quantity received<Input required type="number" min="0.01" step="0.01" value={form.received_quantity} onChange={(event) => setForm({ ...form, received_quantity: event.target.value })} /></label><div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save goods receipt"}</Button></div></form></Panel>}<Panel title="Goods receipt register" subtitle="Goods receipts stored in the database"><DataTable rows={matches as unknown as Record<string, unknown>[]} columns={[{ key: "id", label: "GRN number" }, { key: "po", label: "Related PO" }, { key: "vendor", label: "Vendor" }, { key: "date", label: "Received date" }, { key: "orderedQty", label: "Ordered qty", align: "right" }, { key: "quantity", label: "Received qty", align: "right" }, { key: "invoice", label: "Invoice" }, moneyColumn("orderAmount", "PO amount"), moneyColumn("invoiceAmount", "Invoice amount"), statusColumn("match", "Match result"), statusColumn("status", "Receipt status")]} />{!matches.length && <p className="py-6 text-center text-xs text-muted-foreground">No goods receipts yet.</p>}</Panel></>;
}

function PaymentsScreen() {
  const { payments, invoices, createPayment, updatePaymentStatus } = useApFlow();
  const [invoiceId, setInvoiceId] = useState("");
  const [busy, setBusy] = useState(false);
  const approvedUnpaid = invoices.filter((invoice) => invoice.status === "APPROVED" && invoice.payment === "Unpaid");
  const schedule = async () => {
    const invoice = approvedUnpaid.find((item) => item.recordId === Number(invoiceId));
    if (!invoice) return;
    setBusy(true);
    try { await createPayment(invoice.recordId, invoice.amount); toast.success("Payment request recorded. No bank transfer was initiated."); setInvoiceId(""); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to schedule payment."); }
    finally { setBusy(false); }
  };
  return <><ApiNotice /><PageTitle eyebrow="Disbursements" title="Payments" description="Create payment requests and track payment status. No bank transfer is initiated by this application." /><Panel title="Schedule a payment" subtitle="Only approved, unpaid invoices are eligible"><div className="flex flex-wrap gap-2"><select className="h-10 min-w-[260px] rounded-md border border-input bg-background px-3 text-sm" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}><option value="">Select approved invoice…</option>{approvedUnpaid.map((invoice) => <option key={invoice.recordId} value={invoice.recordId}>{invoice.id} · {invoice.vendor} · {formatMoney(invoice.amount)}</option>)}</select><Button disabled={!invoiceId || busy} onClick={() => void schedule()}>{busy ? "Saving…" : "Create payment request"}</Button></div></Panel><Panel title="Payment register" subtitle={`${payments.length} payment request${payments.length === 1 ? "" : "s"}`}><DataTable rows={payments as unknown as Record<string, unknown>[]} columns={[{ key: "reference", label: "Payment reference" }, { key: "invoice", label: "Invoice" }, { key: "vendor", label: "Vendor" }, moneyColumn("amount", "Amount"), { key: "method", label: "Method" }, statusColumn("status", "Status"), { key: "date", label: "Payment date" }, { key: "actions", label: "Tracking action", render: (row) => { const payment = payments.find((item) => item.id === Number(row["id"])); if (!payment || payment.status === "Completed" || payment.status === "Failed") return <span className="text-muted-foreground">—</span>; const next = payment.status === "Pending" ? "PROCESSING" : "COMPLETED"; return <Button size="sm" variant="outline" onClick={() => void updatePaymentStatus(payment.id, next).then(() => toast.success(`Payment marked ${next.toLowerCase()}.`)).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Unable to update payment."))}>{next === "PROCESSING" ? "Start processing" : "Mark completed"}</Button>; } }]} />{!payments.length && <p className="py-6 text-center text-xs text-muted-foreground">No payment requests have been created.</p>}</Panel></>;
}

function AuditLogsScreen() {
  const { activities } = useApFlow();
  const [search, setSearch] = useState("");
  const rows = activities.map((item) => ({ timestamp: item.time, action: item.title, entityType: item.detail.split(" · ")[0], description: item.detail }));
  return <><ApiNotice /><PageTitle eyebrow="Traceability" title="Audit logs" description="Review persisted actions across invoice, vendor, approval, and payment workflows." /><Panel title="Activity history" subtitle="Most recent events from the audit log"><div className="mb-4 max-w-sm"><SearchField value={search} onChange={setSearch} placeholder="Search event, entity, description..." /></div><DataTable search={search} rows={rows as unknown as Record<string, unknown>[]} columns={[{ key: "timestamp", label: "Timestamp" }, { key: "action", label: "Action" }, { key: "entityType", label: "Identifier" }, { key: "description", label: "Description" }]} />{!rows.length && <p className="py-6 text-center text-xs text-muted-foreground">No audit events recorded yet.</p>}</Panel></>;
}

type Rule = { id: number; name: string; min_amount: string; max_amount: string | null; approval_levels: number; approver_role: string; is_active: boolean };
function SettingsScreen() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "Standard approval", min_amount: "0", max_amount: "50000", approval_levels: "1", approver_role: "Manager" });
  const loadRules = async () => { try { setRules(await request<Rule[]>("/api/approval-rules/")); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load approval rules."); } };
  useEffect(() => { void loadRules(); }, []);
  const addRule = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { const payload = { ...form, min_amount: Number(form.min_amount), max_amount: form.max_amount ? Number(form.max_amount) : null, approval_levels: Number(form.approval_levels), is_active: true }; await request("/api/approval-rules/", { method: "POST", body: JSON.stringify(payload) }); await loadRules(); toast.success("Approval rule saved."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save approval rule."); }
    finally { setBusy(false); }
  };
  const deactivate = async (id: number) => { try { await request(`/api/approval-rules/${id}/`, { method: "DELETE" }); await loadRules(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to deactivate rule."); } };
  return <><ApiNotice /><PageTitle eyebrow="Workspace preferences" title="Settings" description="Configure invoice approval thresholds and reviewer levels." /><div className="grid gap-5 xl:grid-cols-2"><Panel title="Approval matrix" subtitle="Rules are applied to new invoices when they pass validation"><div className="space-y-3">{rules.map((rule) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-3" key={rule.id}><div><p className="text-sm font-semibold">{rule.name}</p><p className="mt-1 text-xs text-muted-foreground">₹{Number(rule.min_amount).toLocaleString("en-IN")} – {rule.max_amount ? `₹${Number(rule.max_amount).toLocaleString("en-IN")}` : "No upper limit"} · {rule.approval_levels} level(s) · {rule.approver_role}</p></div><div className="flex items-center gap-2"><StatusBadge status={rule.is_active ? "Active" : "Inactive"} /><Button size="sm" variant="outline" onClick={() => void deactivate(rule.id)} disabled={!rule.is_active}>Deactivate</Button></div></div>)}{!rules.length && <p className="text-xs text-muted-foreground">No custom rules. Default behavior: one approval up to ₹50,000 and two levels above ₹50,000.</p>}</div></Panel><Panel title="Add approval rule" subtitle="Define amount band and approval depth"><form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void addRule(event)}><Input required placeholder="Rule name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><Input required placeholder="Approver role" value={form.approver_role} onChange={(event) => setForm({ ...form, approver_role: event.target.value })} /><label className="space-y-1 text-xs">Minimum amount (₹)<Input type="number" min="0" step="0.01" value={form.min_amount} onChange={(event) => setForm({ ...form, min_amount: event.target.value })} /></label><label className="space-y-1 text-xs">Maximum amount (₹) · blank = no limit<Input type="number" min="0" step="0.01" value={form.max_amount} onChange={(event) => setForm({ ...form, max_amount: event.target.value })} /></label><label className="space-y-1 text-xs sm:col-span-2">Approval levels<Input type="number" min="1" max="5" value={form.approval_levels} onChange={(event) => setForm({ ...form, approval_levels: event.target.value })} /></label><div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save approval rule"}</Button></div></form></Panel><Panel title="Workflow controls" subtitle="Validation rules applied at invoice intake"><ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground"><li>Duplicate invoice numbers are checked per vendor.</li><li>GSTIN format, invoice dates, due dates, totals, and PO amounts are validated.</li><li>PO-linked invoices can be checked against received quantities.</li><li>Approval steps are created only after validation passes.</li><li>Payment requests are available only for approved invoices.</li></ul></Panel><Panel title="External integrations" subtitle="Require credentials or an external provider"><ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground"><li>Real bank transfers and bank reconciliation require a bank/payment provider integration.</li><li>Email inbox ingestion and automatic reminders require SMTP/IMAP or an email service account.</li><li>Local development uses Tesseract OCR installed on the machine.</li></ul></Panel></div></>;
}

export function PageScreen({ kind }: { kind: PageKind }) {
  if (kind === "invoices") return <InvoiceListing />;
  if (kind === "upload") return <UploadScreen />;
  if (kind === "review") return <ReviewScreen />;
  if (kind === "vendors") return <VendorListing />;
  if (kind === "purchase-orders") return <PurchaseOrdersScreen />;
  if (kind === "goods-receipts") return <GoodsReceiptsScreen />;
  if (kind === "approvals") return <ApprovalListing />;
  if (kind === "payments") return <PaymentsScreen />;
  if (kind === "reports") return <ReportsScreen />;
  if (kind === "audit-logs") return <AuditLogsScreen />;
  return <SettingsScreen />;
}
