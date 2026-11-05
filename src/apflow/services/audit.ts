import { request } from "./client";
import { activities } from "../data";
export const auditService = { list: () => request("/api/audit-logs/").catch(() => activities) };
