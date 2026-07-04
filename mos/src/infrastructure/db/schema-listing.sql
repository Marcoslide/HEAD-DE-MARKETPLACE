-- UNIVERSAL MARKETPLACE LISTING SCHEMA ENGINE (complemento 10.C).
-- UM motor só: cada praça tem adapter/rule pack, o núcleo é único.

CREATE TABLE IF NOT EXISTS marketplace_category_tree (
  id TEXT PRIMARY KEY, company_id TEXT, marketplace TEXT NOT NULL,
  account_id TEXT, category_id TEXT NOT NULL, parent_category_id TEXT,
  root_category_id TEXT, name TEXT NOT NULL, path TEXT,
  is_leaf INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
  is_allowed INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL, source_version TEXT, fetched_at TEXT, expires_at TEXT,
  raw_reference TEXT, confidence TEXT, audit_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (marketplace, category_id, source)
);
CREATE TABLE IF NOT EXISTS marketplace_category_mapping (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL, company_id TEXT NOT NULL,
  marketplace TEXT NOT NULL, account_id TEXT, internal_category_id TEXT,
  root_category_id TEXT, category_id TEXT, category_path TEXT,
  mapping_status TEXT NOT NULL DEFAULT 'SUGGESTED' CHECK (mapping_status IN
    ('SUGGESTED','AWAITING_CONFIRMATION','CONFIRMED','REJECTED')),
  confidence REAL, suggested_by TEXT, confirmed_by TEXT, confirmed_at TEXT,
  source TEXT, notes TEXT, audit_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT
);
CREATE TABLE IF NOT EXISTS marketplace_listing_schema (
  id TEXT PRIMARY KEY, company_id TEXT, marketplace TEXT NOT NULL,
  account_id TEXT, category_id TEXT NOT NULL, category_version TEXT,
  schema_status TEXT NOT NULL CHECK (schema_status IN
    ('VERIFIED_OFFICIAL','VERIFIED_ACCOUNT','PROVISIONAL_INTERNAL','STALE','UNKNOWN','ERROR')),
  source TEXT NOT NULL, source_version TEXT, fetched_at TEXT, expires_at TEXT,
  fields_json TEXT, variation_rules_json TEXT, logistics_rules_json TEXT,
  fiscal_rules_json TEXT, media_rules_json TEXT, validation_rules_json TEXT,
  raw_reference TEXT, audit_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS marketplace_schema_field (
  id TEXT PRIMARY KEY, listing_schema_id TEXT NOT NULL,
  field_key TEXT NOT NULL, label TEXT, field_group TEXT, data_type TEXT,
  required INTEGER NOT NULL DEFAULT 0, conditional_required INTEGER NOT NULL DEFAULT 0,
  condition_expression TEXT, allowed_values_json TEXT, unit TEXT,
  min_value REAL, max_value REAL, pattern TEXT, help_text TEXT,
  source TEXT NOT NULL, sort_order INTEGER DEFAULT 0, visible_when TEXT,
  editable INTEGER NOT NULL DEFAULT 1, status TEXT DEFAULT 'READY',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS marketplace_listing_field_value (
  id TEXT PRIMARY KEY, listing_draft_id TEXT NOT NULL, variation_id TEXT,
  field_key TEXT NOT NULL, value TEXT, normalized_value TEXT,
  source TEXT NOT NULL, confidence TEXT,
  status TEXT NOT NULL DEFAULT 'MISSING' CHECK (status IN
    ('READY','MISSING','INVALID','AWAITING_CONFIRMATION','NOT_APPLICABLE',
     'BLOCKED','DERIVED','OVERRIDDEN')),
  last_validated_at TEXT, audit_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT
);
CREATE TABLE IF NOT EXISTS product_operational_profile (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL UNIQUE, company_id TEXT NOT NULL,
  product_type TEXT, is_personalized INTEGER NOT NULL DEFAULT 0,
  production_mode TEXT NOT NULL DEFAULT 'READY_STOCK' CHECK (production_mode IN
    ('READY_STOCK','MADE_TO_ORDER','PERSONALIZED')),
  production_lead_time_days INTEGER, preparation_time_days INTEGER,
  cutoff_time TEXT, dispatch_policy TEXT, operational_capacity_per_day INTEGER,
  requires_proof_approval INTEGER NOT NULL DEFAULT 0,
  requires_special_packaging INTEGER NOT NULL DEFAULT 0, packaging_profile_id TEXT,
  fragile INTEGER NOT NULL DEFAULT 0, ready_stock_policy TEXT,
  internal_logistics_restrictions_json TEXT, notes TEXT, audit_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT
);
CREATE TABLE IF NOT EXISTS marketplace_shipping_eligibility (
  id TEXT PRIMARY KEY, listing_draft_id TEXT, product_id TEXT,
  variation_id TEXT, company_id TEXT NOT NULL, marketplace TEXT NOT NULL,
  shipping_method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN
    ('ELIGIBLE','NOT_ELIGIBLE','BLOCKED_BY_PRODUCT_TYPE','BLOCKED_BY_PERSONALIZATION',
     'BLOCKED_BY_LEAD_TIME','BLOCKED_BY_STOCK_POLICY','BLOCKED_BY_DIMENSIONS',
     'BLOCKED_BY_WEIGHT','BLOCKED_BY_FRAGILITY','BLOCKED_BY_PACKAGING',
     'BLOCKED_BY_OPERATION','BLOCKED_BY_ACCOUNT','BLOCKED_BY_MARKETPLACE_RULE',
     'AWAITING_DATA','AWAITING_ACCOUNT_CONFIRMATION','UNKNOWN')),
  reasons_json TEXT, derived_from TEXT, requires_confirmation INTEGER NOT NULL DEFAULT 1,
  checked_at TEXT, source TEXT, account_eligibility TEXT, audit_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
