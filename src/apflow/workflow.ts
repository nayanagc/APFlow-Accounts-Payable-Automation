import type { Invoice } from "./data";

export type ApprovalAction = "Approve" | "Request changes" | "Reject";

export function applyApprovalDecision(invoice: Invoice, action: ApprovalAction): Invoice {
  const approval = action === "Approve" ? "Approved" : action === "Reject" ? "Rejected" : "Changes requested";
  return { ...invoice, approval };
}