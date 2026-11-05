import { request } from "./client";
import { purchaseOrders, receipts } from "../data";
export const procurementService = { purchaseOrders: () => request<typeof purchaseOrders>("/api/purchase-orders/").catch(() => purchaseOrders), receipts: () => request<typeof receipts>("/api/goods-receipts/").catch(() => receipts) };
