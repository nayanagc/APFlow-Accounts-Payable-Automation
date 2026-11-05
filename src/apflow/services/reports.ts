import { request } from "./client";
import { invoices } from "../data";
export const reportService = { summary: () => request("/api/reports/summary/").catch(() => invoices) };
