-- MARKETPLACE KNOWLEDGE & COMPLIANCE FOUNDATION (Sprint 10.K).
-- Base VIVA: consciência técnica, não polícia. Bloqueio só de ação externa.

CREATE TABLE IF NOT EXISTS marketplace_knowledge_source (
  id TEXT PRIMARY KEY, marketplace TEXT NOT NULL, source_type TEXT NOT NULL,
  title TEXT NOT NULL, source_url TEXT, source_document_id TEXT,
  source_version TEXT, published_at TEXT, fetched_at TEXT, expires_at TEXT,
  language TEXT DEFAULT 'pt-BR', official INTEGER NOT NULL DEFAULT 0,
  checksum TEXT, content_hash TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE',
  audit_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS marketplace_knowledge_record (
  id TEXT PRIMARY KEY, company_id TEXT, marketplace TEXT NOT NULL,
  domain TEXT NOT NULL, subdomain TEXT, title TEXT NOT NULL, summary TEXT,
  detailed_content TEXT, source_id TEXT, knowledge_type TEXT NOT NULL,
  confidence_status TEXT NOT NULL CHECK (confidence_status IN
    ('VERIFIED_OFFICIAL','VERIFIED_ACCOUNT','VERIFIED_INTERNAL',
     'SUPPORTED_BY_EVIDENCE','PROVISIONAL','STALE','CONFLICTING','UNKNOWN','RETIRED')),
  effective_from TEXT, effective_until TEXT, last_verified_at TEXT,
  review_required_at TEXT, applies_to_category_id TEXT, applies_to_account_id TEXT,
  applies_to_product_type TEXT, applies_to_region TEXT, applies_to_operation TEXT,
  severity TEXT, consequences TEXT, recommended_action TEXT, alternatives_json TEXT,
  tags_json TEXT, related_rule_pack_id TEXT, raw_evidence TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', audit_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT
);
CREATE TABLE IF NOT EXISTS marketplace_risk_rule (
  id TEXT PRIMARY KEY, company_id TEXT, marketplace TEXT NOT NULL,
  domain TEXT NOT NULL, trigger_condition TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW','MODERATE','HIGH','CRITICAL')),
  action_mode TEXT NOT NULL CHECK (action_mode IN
    ('INFO','SUGGEST','WARN','ASK_CONFIRMATION','REQUIRE_REVIEW','BLOCK_EXTERNAL_ACTION')),
  warning_text TEXT NOT NULL, consequence_text TEXT,
  recommended_alternative TEXT, requires_human_confirmation INTEGER DEFAULT 0,
  blocks_internal_draft INTEGER NOT NULL DEFAULT 0,
  blocks_external_write INTEGER NOT NULL DEFAULT 0,
  related_knowledge_record_id TEXT, source TEXT, confidence_status TEXT,
  resolution_path TEXT, audit_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS marketplace_knowledge_conflict (
  id TEXT PRIMARY KEY, marketplace TEXT NOT NULL, subject TEXT NOT NULL,
  conflicting_record_ids_json TEXT, conflict_description TEXT,
  recommended_resolution TEXT, status TEXT NOT NULL DEFAULT 'OPEN',
  owner_decision TEXT, resolved_by TEXT, resolved_at TEXT, audit_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS marketplace_knowledge_review (
  id TEXT PRIMARY KEY, marketplace TEXT NOT NULL, record_id TEXT,
  reason TEXT NOT NULL, priority TEXT DEFAULT 'MEDIUM', detected_at TEXT,
  assigned_to TEXT, status TEXT NOT NULL DEFAULT 'OPEN', review_notes TEXT,
  resolved_at TEXT, audit_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
