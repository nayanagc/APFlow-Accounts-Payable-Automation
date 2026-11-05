import type { ReactNode } from "react";
import { AppShell } from "../apflow/app-shell";

export function ApFlowPage({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
