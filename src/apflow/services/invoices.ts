import { request } from "./client";
import { invoices, type Invoice } from "../data";
export const invoiceService = { list: () => request<Invoice[]>("/api/invoices/").catch(() => invoices), get: (id: string) => request<Invoice>(`/api/invoices/${id}/`).catch(() => invoices.find((item) => item.id === id)) };
