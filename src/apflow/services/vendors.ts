import { request } from "./client";
import { vendors, type Vendor } from "../data";
export const vendorService = { list: () => request<Vendor[]>("/api/vendors/").catch(() => vendors) };
