export type Invoice = { id: string; vendor: string; date: string; due: string; amount: number; tax: number; validation: string; approval: string; payment: string; po: string };
export type Vendor = { name: string; code: string; email: string; phone: string; gstin: string; status: string; onboarding: string; spend: number };
export const invoices: Invoice[] = [
  { id: "INV-2026-0842", vendor: "Apex Industrial Supplies", date: "Oct 24, 2026", due: "Nov 23, 2026", amount: 48250, tax: 7350, validation: "Passed", approval: "Pending", payment: "Unpaid", po: "PO-2026-1184" },
  { id: "INV-2026-0841", vendor: "Northstar Office Systems", date: "Oct 23, 2026", due: "Nov 22, 2026", amount: 12840, tax: 1959, validation: "Review", approval: "Pending", payment: "Unpaid", po: "PO-2026-1179" },
  { id: "INV-2026-0839", vendor: "Meridian Logistics", date: "Oct 21, 2026", due: "Oct 28, 2026", amount: 76500, tax: 11669, validation: "Passed", approval: "Approved", payment: "Overdue", po: "PO-2026-1160" },
  { id: "INV-2026-0837", vendor: "Brightline Technology", date: "Oct 19, 2026", due: "Nov 18, 2026", amount: 23600, tax: 3600, validation: "Passed", approval: "Approved", payment: "Scheduled", po: "PO-2026-1152" },
  { id: "INV-2026-0835", vendor: "Apex Industrial Supplies", date: "Oct 17, 2026", due: "Nov 16, 2026", amount: 19400, tax: 2954, validation: "Exception", approval: "Changes requested", payment: "Unpaid", po: "PO-2026-1138" },
  { id: "INV-2026-0832", vendor: "Cedar & Stone Packaging", date: "Oct 14, 2026", due: "Nov 13, 2026", amount: 31860, tax: 4857, validation: "Passed", approval: "Approved", payment: "Paid", po: "PO-2026-1122" },
  { id: "INV-2026-0829", vendor: "Northstar Office Systems", date: "Oct 11, 2026", due: "Nov 10, 2026", amount: 8640, tax: 1318, validation: "Passed", approval: "Approved", payment: "Paid", po: "PO-2026-1109" },
  { id: "INV-2026-0826", vendor: "Meridian Logistics", date: "Oct 08, 2026", due: "Nov 07, 2026", amount: 54200, tax: 8268, validation: "Passed", approval: "Pending", payment: "Unpaid", po: "PO-2026-1091" },
  { id: "INV-2026-0823", vendor: "Brightline Technology", date: "Oct 05, 2026", due: "Nov 04, 2026", amount: 16750, tax: 2555, validation: "Review", approval: "Rejected", payment: "Failed", po: "PO-2026-1075" },
  { id: "INV-2026-0818", vendor: "Cedar & Stone Packaging", date: "Oct 01, 2026", due: "Oct 31, 2026", amount: 29300, tax: 4469, validation: "Passed", approval: "Approved", payment: "Overdue", po: "PO-2026-1058" },
];
export const vendors: Vendor[] = [
  { name: "Apex Industrial Supplies", code: "VEN-0041", email: "accounts@apexindustrial.example", phone: "+91 80 5550 4100", gstin: "29AABCA1234F1Z5", status: "Active", onboarding: "Complete", spend: 246800 },
  { name: "Northstar Office Systems", code: "VEN-0028", email: "finance@northstar.example", phone: "+91 22 5550 2800", gstin: "27AACCN5678H1Z2", status: "Active", onboarding: "Complete", spend: 189420 },
  { name: "Meridian Logistics", code: "VEN-0016", email: "billing@meridian.example", phone: "+91 44 5550 1600", gstin: "33AABCM9012G1Z7", status: "Active", onboarding: "Complete", spend: 412600 },
  { name: "Brightline Technology", code: "VEN-0035", email: "ap@brightline.example", phone: "+91 20 5550 3500", gstin: "27AABCB3456J1Z9", status: "Active", onboarding: "In review", spend: 328900 },
  { name: "Cedar & Stone Packaging", code: "VEN-0052", email: "accounts@cedarstone.example", phone: "+91 40 5550 5200", gstin: "36AACCC7890K1Z4", status: "Pending", onboarding: "Documents needed", spend: 95740 },
];
export const purchaseOrders = invoices.slice(0, 6).map((invoice, index) => ({ id: invoice.po, vendor: invoice.vendor, date: `Oct ${24 - index * 2}, 2026`, amount: invoice.amount + ([0, 340, 0, 0, -1250, 0][index] ?? 0), quantity: ([240, 60, 120, 18, 95, 500][index] ?? 0), status: index === 4 ? "Partially received" : "Open" }));
export const receipts = purchaseOrders.slice(0, 5).map((po, index) => ({ id: `GRN-2026-${428 - index}`, po: po.id, vendor: po.vendor, date: `Oct ${23 - index * 3}, 2026`, quantity: po.quantity - (index === 3 ? 4 : 0), status: index === 3 ? "Partial" : "Received" }));
export const activities = [
  { title: "Invoice approved", detail: "INV-2026-0837 · Brightline Technology", time: "12 min ago", kind: "success" },
  { title: "Validation exception flagged", detail: "INV-2026-0835 · PO quantity mismatch", time: "38 min ago", kind: "warning" },
  { title: "Invoice received", detail: "INV-2026-0842 · Apex Industrial Supplies", time: "1 hour ago", kind: "info" },
  { title: "Payment scheduled", detail: "INV-2026-0829 · Northstar Office Systems", time: "2 hours ago", kind: "success" },
];
export const monthlyVolume = [{ month: "May", count: 48, amount: 420 }, { month: "Jun", count: 56, amount: 510 }, { month: "Jul", count: 51, amount: 468 }, { month: "Aug", count: 68, amount: 620 }, { month: "Sep", count: 73, amount: 690 }, { month: "Oct", count: 82, amount: 748 }];
export const formatMoney = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
export const invoiceStatus = (invoice: Invoice) => invoice.approval === "Pending" ? "Pending approval" : invoice.validation === "Exception" ? "Exception" : invoice.payment;
