import { request } from "./client";
import { invoices } from "../data";
export const paymentService = { list: () => request("/api/payments/").catch(() => invoices.filter((invoice) => invoice.payment !== "Unpaid")) };
