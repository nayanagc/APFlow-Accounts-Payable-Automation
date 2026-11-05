# APFlow — Accounts Payable Automation

APFlow is a full-stack Accounts Payable workflow application built with **React + TypeScript**, **Django REST Framework**, and **PostgreSQL**. It covers vendor records, purchase orders, goods receipts, invoice intake and OCR, validation, approval routing, payment-status tracking, reports, and audit history.

> **Development build:** The API currently permits unauthenticated local access (`AllowAny`) so the React demo can work immediately. Do not expose this configuration to the public internet or use it for real financial data. Real bank transfers, bank reconciliation, email inbox ingestion, automated email reminders, and production-grade user/role authentication require provider credentials and further integration work; the payment screens record workflow status only and do not move money.

## Implemented modules

- **Invoice intake and OCR:** upload PDF/JPG/JPEG/PNG/TIF/TIFF, extract text from selectable PDFs, use Tesseract for scanned pages, and extract invoice headers, GSTIN, totals, PO reference, and common invoice line-item rows.
- **Validation:** required fields, vendor GSTIN format and mismatch, vendor/invoice duplicate checks, amount reconciliation, PO/vendor/amount checks, and available GRN quantity checks. Exceptions are stored with the invoice for human review.
- **Procurement:** vendor master, purchase-order register and creation, goods-receipt register and receiving entry.
- **Approval workflow:** amount-based configurable rules, approval levels, role labels, decision/comment recording, and audit events. Pending approval records are initially unassigned; reviewer identity enforcement can be configured by assigning users in Django admin. The current UI is a local workflow demo, not a full identity/SSO implementation.
- **Payments:** create payment requests for approved invoices and track Pending → Processing → Completed/Failed. No bank transfer is initiated.
- **Dashboard and reporting:** live counts and status summaries from the Django API, invoice aging/status views, exception/tax/vendor/payment reporting, CSV export, and audit history.

## Prerequisites (Windows)

Install these before starting:

1. **Python 3.12 or newer** (the backend dependencies support current Django releases; Python 3.14 is also usable when compatible binary wheels are available).
2. **Node.js 20 or newer** (includes npm).
3. **PostgreSQL 15 or newer** and remember the PostgreSQL user/password you set during installation.
4. **Tesseract OCR 5.x**. On Windows, the common executable path is `C:\Program Files\Tesseract-OCR\tesseract.exe`. It is required for scanned image/PDF pages; searchable text PDFs can use their embedded text layer.

## Installation — Windows PowerShell

Unzip this folder somewhere convenient, for example `C:\Projects\APFlow`. Open the folder in VS Code.

### 1. Create the PostgreSQL database

Open **SQL Shell (psql)** or pgAdmin, connect as your PostgreSQL administrator, and run:

```sql
CREATE DATABASE apflow_db;
```

Skip this command if you already created `apflow_db`.

### 2. Configure the Django backend

Open a PowerShell terminal at the APFlow project root and run:

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```

In `backend\.env`, replace `DB_PASSWORD=CHANGE_ME` with your PostgreSQL password. Keep the other defaults for a local installation. Set the Tesseract path if it is not on PATH, for example:

```dotenv
TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe
```

Save the file. Do not share or commit this file.

Create and activate the Python environment, then install dependencies and initialize the database:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo_data
```

The seed command adds clearly fictitious Northstar vendor, PO, GRN, and approval-rule data so you can test invoice matching immediately. Start Django:

```powershell
python manage.py runserver
```

Keep this terminal running. The backend API is at `http://127.0.0.1:8000/api/` and Django admin is at `http://127.0.0.1:8000/admin/`.

Optional: create an admin login in a second backend terminal with the venv active:

```powershell
python manage.py createsuperuser
```

### 3. Start the React frontend

Open a **second** VS Code terminal at the project root (not inside `backend`) and run:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

The root `.env` points the frontend to `http://127.0.0.1:8000`. If you change the backend address, update `VITE_API_BASE_URL` and keep the matching frontend origin in `CORS_ALLOWED_ORIGINS` in `backend/config/settings.py`.

## First end-to-end demo

1. Start PostgreSQL, the Django server, and the React server.
2. Open **Vendors** and confirm the seeded `Northstar Office Supplies Pvt. Ltd.` vendor exists.
3. Open **Upload invoices** and choose that vendor.
4. Select `backend/sample_data/INV_001_clean_invoice.pdf` from the unzipped project folder.
5. Upload. The expected sample extraction is invoice `NS-2026-1042`, invoice date `2026-11-03`, due date `2026-12-03`, GSTIN `29AABCN1234F1Z5`, PO `PO-2026-0081`, two line items, and invoice total ₹7,198. The seeded PO/GRN data is designed to match this fictitious sample.
6. Open **OCR review**, **Approvals**, **Reports**, and **Audit logs** to inspect the saved workflow records.

The sample invoice is fictional test data only; it is not valid for filing or payment.

## API endpoints

| Area | Endpoint | Methods |
|---|---|---|
| Dashboard and report summary | `/api/dashboard/`, `/api/reports/summary/` | GET |
| Vendors | `/api/vendors/`, `/api/vendors/<id>/` | GET, POST, PATCH, DELETE (delete deactivates) |
| Purchase orders | `/api/purchase-orders/` | GET, POST |
| Goods receipts | `/api/goods-receipts/` | GET, POST |
| Invoices | `/api/invoices/`, `/api/invoices/upload/`, `/api/invoices/<id>/` | GET; upload POST; detail GET/PATCH |
| Invoice validation | `/api/invoices/<id>/validate/` | POST |
| Approvals | `/api/approvals/`, `/api/approvals/<id>/decision/` | GET; decision POST |
| Approval rules | `/api/approval-rules/`, `/api/approval-rules/<id>/` | GET, POST, PATCH, DELETE (deactivate) |
| Payments | `/api/payments/`, `/api/payments/<id>/` | GET, POST, PATCH |
| Audit history | `/api/audit-logs/` | GET |

## Database schema

`docs/schema.sql` documents the APFlow PostgreSQL business tables and foreign-key relationships. The Django migration files in `backend/core/migrations/` are the authoritative, executable schema definition; apply them with `python manage.py migrate` rather than manually running the SQL documentation file.

## Tests and checks

Backend unit tests:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py test core.tests
```

Frontend TypeScript check:

```powershell
cd ..
npx tsc --noEmit
```

## Troubleshooting

- **Database connection refused:** ensure the PostgreSQL Windows service is running and `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `backend\.env` are correct.
- **`password authentication failed`:** update only `DB_PASSWORD` in `backend\.env` to the password for the selected PostgreSQL user.
- **Scanned PDF has no extracted words:** install Tesseract OCR and set `TESSERACT_CMD` to its executable path in `backend\.env`.
- **Frontend says Django API is unreachable:** leave `python manage.py runserver` running, verify `http://127.0.0.1:8000/api/vendors/` opens, and confirm the root `.env` has `VITE_API_BASE_URL=http://127.0.0.1:8000`.
- **PowerShell blocks venv activation:** run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once in PowerShell, then activate the venv again.
- **Port already in use:** run Django on another port (for example `python manage.py runserver 8001`) and change `VITE_API_BASE_URL` accordingly.

## Scope and production notes

This is an assignment/demo implementation. Email/EDI ingestion, real banking integration, external payment execution, automated reminder delivery, mobile push notifications, complete identity management/RBAC, production secrets management, deployment hardening, and legally compliant financial controls are not configured. Use fictitious data during demonstrations.
