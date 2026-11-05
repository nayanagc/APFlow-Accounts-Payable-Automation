# APFlow frontend

## What will be built
- Replace the starter screen with a responsive APFlow accounts-payable workspace and dashboard.
- Add working navigation for invoices, invoice upload/review, vendors, purchase orders, goods receipts, approvals, payments, reports, audit logs, and settings.
- Use fictional, clearly labeled demo data; implement practical search, filters, CSV export, file selection, detail views, and simulated approval actions.
- Keep Django REST API communication in a configurable frontend service layer, with demo data kept separate and no required hosted backend.

## Technical approach
- Build on the existing TanStack Start and shadcn/Tailwind setup; do not introduce React Router or backend services.
- Define APFlow semantic colors and typography in the global stylesheet, and use existing UI primitives for controls.
- Create focused APFlow app, data, and API service modules; keep `/` as the working entry screen and provide its own metadata.
- Validate the home route, responsive interactions, and latest preview build diagnostics.
