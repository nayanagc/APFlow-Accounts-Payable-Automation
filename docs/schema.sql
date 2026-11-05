-- APFlow business schema (PostgreSQL reference DDL)
-- Django migrations in backend/core/migrations are authoritative.
-- Run `python manage.py migrate` to create/manage these tables.

CREATE TABLE core_vendor (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    vendor_code VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(254),
    phone VARCHAR(20) NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    gst_number VARCHAR(20) NOT NULL DEFAULT '',
    pan_number VARCHAR(10) NOT NULL DEFAULT '',
    bank_account_number VARCHAR(50) NOT NULL DEFAULT '',
    ifsc_code VARCHAR(15) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE core_purchaseorder (
    id BIGSERIAL PRIMARY KEY,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    vendor_id BIGINT NOT NULL REFERENCES core_vendor(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    total_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE core_purchaseorderitem (
    id BIGSERIAL PRIMARY KEY,
    purchase_order_id BIGINT NOT NULL REFERENCES core_purchaseorder(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    amount NUMERIC(12,2) NOT NULL
);

CREATE TABLE core_goodsreceipt (
    id BIGSERIAL PRIMARY KEY,
    grn_number VARCHAR(50) NOT NULL UNIQUE,
    purchase_order_id BIGINT NOT NULL REFERENCES core_purchaseorder(id) ON DELETE RESTRICT,
    received_date DATE NOT NULL,
    received_by VARCHAR(150) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE core_goodsreceiptitem (
    id BIGSERIAL PRIMARY KEY,
    goods_receipt_id BIGINT NOT NULL REFERENCES core_goodsreceipt(id) ON DELETE CASCADE,
    purchase_order_item_id BIGINT NOT NULL REFERENCES core_purchaseorderitem(id) ON DELETE RESTRICT,
    received_quantity NUMERIC(12,2) NOT NULL
);

CREATE TABLE core_invoice (
    id BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(100),
    vendor_id BIGINT NOT NULL REFERENCES core_vendor(id) ON DELETE RESTRICT,
    purchase_order_id BIGINT REFERENCES core_purchaseorder(id) ON DELETE SET NULL,
    invoice_file VARCHAR(100),
    invoice_date DATE,
    due_date DATE,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL,
    extracted_text TEXT NOT NULL DEFAULT '',
    extracted_gst_number VARCHAR(20) NOT NULL DEFAULT '',
    ocr_confidence DOUBLE PRECISION,
    status VARCHAR(25) NOT NULL DEFAULT 'UPLOADED',
    validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE core_invoiceitem (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES core_invoice(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount NUMERIC(12,2) NOT NULL
);

CREATE TABLE core_approvalrule (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    min_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    max_amount NUMERIC(12,2),
    approval_levels INTEGER NOT NULL DEFAULT 1,
    approver_role VARCHAR(80) NOT NULL DEFAULT 'Manager',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE core_approval (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES core_invoice(id) ON DELETE CASCADE,
    approver_id BIGINT REFERENCES auth_user(id) ON DELETE SET NULL,
    approval_level INTEGER NOT NULL DEFAULT 1,
    approver_role VARCHAR(80) NOT NULL DEFAULT 'Manager',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    comments TEXT NOT NULL DEFAULT '',
    action_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE core_payment (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES core_invoice(id) ON DELETE RESTRICT,
    payment_reference VARCHAR(100) NOT NULL UNIQUE,
    amount NUMERIC(12,2) NOT NULL,
    payment_date DATE,
    payment_method VARCHAR(50) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE core_auditlog (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES auth_user(id) ON DELETE SET NULL,
    invoice_id BIGINT REFERENCES core_invoice(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    timestamp TIMESTAMPTZ NOT NULL
);

-- auth_user is created by Django's built-in auth migrations.
