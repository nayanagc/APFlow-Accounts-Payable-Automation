import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ClipboardCheck, CreditCard, FileClock, FileText, LayoutDashboard, PackageCheck, PackageSearch, ScanLine, Settings, Truck, Users, UploadCloud } from "lucide-react";

const navigation = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Invoices", to: "/invoices", icon: FileText },
  { label: "Upload invoices", to: "/upload", icon: UploadCloud },
  { label: "OCR review", to: "/review", icon: ScanLine },
  { label: "Vendors", to: "/vendors", icon: Users },
  { label: "Purchase orders", to: "/purchase-orders", icon: PackageSearch },
  { label: "Goods receipts", to: "/goods-receipts", icon: PackageCheck },
  { label: "Approvals", to: "/approvals", icon: ClipboardCheck },
  { label: "Payments", to: "/payments", icon: CreditCard },
  { label: "Reports", to: "/reports", icon: FileClock },
  { label: "Audit logs", to: "/audit-logs", icon: Activity },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  return <nav aria-label="Main navigation" className={mobile ? "flex min-w-max gap-1 px-3 py-2" : "space-y-1"}>
    {navigation.map(({ label, to, icon: Icon }) => <Link key={to} to={to} activeOptions={{ exact: to === "/" }} activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }} inactiveProps={{ className: "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground" }} className={`apflow-nav-item flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium ${mobile ? "whitespace-nowrap" : "w-full"}`}>
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
    </Link>)}
  </nav>;
}

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="apflow-shell bg-background text-foreground lg:flex">
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <Link to="/" className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <span className="grid size-9 place-items-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground"><FileText className="size-5" /></span>
        <span><span className="block font-display text-lg font-bold">APFlow</span><span className="block text-[10px] uppercase tracking-wide text-sidebar-foreground/60">Payables workspace</span></span>
      </Link>
      <div className="flex-1 overflow-y-auto px-3 py-5 apflow-scrollbar"><p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">Workspace</p><NavigationLinks /></div>
      <div className="border-t border-sidebar-border px-5 py-4"><p className="text-xs font-medium">Northwind Manufacturing</p><p className="mt-1 text-[10px] text-sidebar-foreground/60">Sarah Chen · Manager</p></div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-base font-bold lg:hidden"><FileText className="size-5 text-primary" />APFlow</Link>
        <span className="hidden text-sm font-medium text-muted-foreground lg:block">Accounts payable workspace</span>
        <span className="rounded-sm border border-success/30 bg-success/10 px-2 py-1 text-[10px] font-semibold tracking-wide text-success">LIVE DATABASE</span>
      </header>
      <div className="border-b border-border bg-card lg:hidden"><NavigationLinks mobile /></div>
      <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}

export function apflowHead(title: string, description: string) {
  return { meta: [
    { title: `${title} | APFlow` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} | APFlow` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] };
}
