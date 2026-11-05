import { request } from "./client";
import { invoices } from "../data";
export const approvalService = { list: () => request("/api/approvals/").catch(() => invoices.filter((invoice) => invoice.approval === "Pending")), decide: (id: string, action: string, comment: string) => request(`/api/approvals/${id}/decision/`, { method: "POST", body: JSON.stringify({ action, comment }) }) };
