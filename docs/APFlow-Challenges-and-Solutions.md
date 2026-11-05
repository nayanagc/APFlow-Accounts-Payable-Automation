# APFlow – Challenges and Solutions

## 1. Connecting React, Django, and PostgreSQL
**Challenge:** The React application initially displayed a “Failed to fetch” message when requesting data from the Django API. The frontend was served on a different local port from the one allowed by Django's CORS configuration. PostgreSQL authentication also failed when the password in the backend environment configuration did not match the PostgreSQL user's password.

**Solution:** I configured Django's allowed CORS origins to include the frontend's local development address, checked that the frontend API base URL pointed to Django, and corrected the backend `.env` database settings. I verified the connection by opening the vendor API endpoint and confirming that it returned HTTP 200 with vendor records.

## 2. Extracting invoice information using OCR
**Challenge:** Invoice documents can contain selectable PDF text or scanned page images, and invoice labels and layouts may vary. The initial extraction did not correctly identify the invoice number and dates; an early regular-expression issue also caused a `no such group` error.

**Solution:** I used PyMuPDF to read text directly from PDF pages and Tesseract OCR as a fallback for pages without extractable text. I refined the field-matching patterns and date normalization, then tested the extraction against the supplied sample invoice. The tested sample returned the expected invoice number, invoice date, due date, GSTIN, and total amount. OCR results still require review because accuracy can vary with document quality and layout.

## 3. Maintaining invoice and procurement data relationships
**Challenge:** An accounts-payable workflow needs invoices to reference vendors and, where applicable, purchase orders and goods receipts. It also needs related line items, approvals, payments, and audit records to remain connected consistently.

**Solution:** I represented these entities using Django models and PostgreSQL relationships, added database migrations for schema changes, and provided demo data for a vendor, purchase order, goods receipt, and approval rules. The sample invoice flow was tested against the seeded purchase order, including saving extracted line items and creating an approval step.

## 4. Validating invoices and preventing duplicate processing
**Challenge:** Processing the same invoice more than once, or accepting incomplete or inconsistent information, can cause incorrect accounts-payable records.

**Solution:** I added server-side checks during invoice upload, including file-type checks and duplicate detection using the vendor and invoice number. Validation results and processing activity are recorded with the invoice and audit information so exceptions can be reviewed rather than silently accepted.

## 5. Publishing the project safely to GitHub
**Challenge:** The local project and the GitHub repository had separate commit histories, and the first push encountered an authentication/permission mismatch. A README conflict occurred when the histories were combined.

**Solution:** I authenticated with the repository-owning GitHub account, fetched the remote history, merged the unrelated histories, resolved the README conflict by retaining the project README, and pushed the resulting `main` branch. I used `.gitignore` rules to keep local environment files, virtual environments, uploaded media, and installed dependencies out of version control.

## 6. Current limitations and future improvements
The current project provides invoice processing, vendor and procurement records, approval workflow, payment-status tracking, reports, and audit records. Actual bank transfers, production banking-provider integration, automatic email inbox ingestion, and automated email reminders require external services, credentials, and additional deployment configuration; they are not represented as completed integrations. Before production use, the application would also need deployment hardening, stronger authentication and authorization, secure secrets management, and broader testing with invoices from multiple vendors and layouts.
