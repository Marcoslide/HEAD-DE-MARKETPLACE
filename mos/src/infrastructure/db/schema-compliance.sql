-- ============================================================
-- CATALOG, RULE & COMPLIANCE ENGINE (Sprint 10) — ADITIVO.
-- Lacunas REAIS apenas (auditoria): `product` segue sendo o Product
-- Master; `listing`/`listing_version` seguem sendo a representação por
-- praça. Nascem: perfis do produto, assets, projeção por marketplace,
-- rascunho interno rico e a trilha de validação (append-only).
-- Nenhuma publicação externa: tudo aqui é leitura/validação/rascunho.
-- ============================================================

-- perfis do Product Master: embalagem, produção, fiscal (1:1 com product)
CREATE TABLE IF NOT EXISTS product_profile (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL UNIQUE REFERENCES product(id) ON DELETE CASCADE,
  company_id      TEXT NOT NULL,
  brand           TEXT,
  product_type    TEXT,                       -- quadro|kit|espelho|personalizado...
  condition       TEXT,                       -- novo|usado
  description     TEXT,
  tech_sheet_json TEXT NOT NULL DEFAULT '{}', -- ficha técnica estruturada
  -- Packaging Profile
  weight_g          INTEGER,
  packed_weight_g   INTEGER,
  height_cm REAL, width_cm REAL, depth_cm REAL,
  packed_dims_json  TEXT,
  fragile           INTEGER NOT NULL DEFAULT 0,
  special_packaging TEXT,
  -- Production Profile
  production_days      INTEGER,
  personalization_days INTEGER,
  made_to_order        INTEGER NOT NULL DEFAULT 0,
  personalization_json TEXT,                  -- campos, arte, aprovação, limites
  daily_capacity       INTEGER,
  -- comercial / fiscal
  base_price REAL, cost REAL, min_margin_pct REAL,
  ean TEXT, origin TEXT, warranty TEXT,
  fiscal_json TEXT NOT NULL DEFAULT '{}',
  return_policy TEXT,
  notes TEXT,
  updated_at TEXT
);

-- assets do produto: imagens, vídeo, documentos (metadados p/ validação)
CREATE TABLE IF NOT EXISTS product_asset (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  company_id  TEXT NOT NULL,
  kind        TEXT NOT NULL,                  -- image|video|document
  role        TEXT,                           -- main|gallery|technical|art
  url         TEXT,
  width INTEGER, height INTEGER,
  format      TEXT,
  size_kb     INTEGER,
  has_watermark INTEGER DEFAULT 0,
  has_text_overlay INTEGER DEFAULT 0,
  position    INTEGER DEFAULT 0,
  created_at  TEXT
);

-- projeção do produto para UMA praça (Marketplace Profile)
CREATE TABLE IF NOT EXISTS marketplace_product_profile (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  company_id   TEXT NOT NULL,
  platform     TEXT NOT NULL,
  title        TEXT,
  category_id  TEXT,                          -- código REAL confirmado (nunca inventado)
  category_status TEXT,                       -- MATCHED|LOW_CONFIDENCE|REVIEW_REQUIRED|NO_MATCH|CONFIRMED
  attributes_json TEXT NOT NULL DEFAULT '{}',
  price REAL, stock INTEGER,
  shipping_json TEXT,
  content_json  TEXT,                         -- TikTok: vídeo/criativo etc.
  updated_at TEXT,
  UNIQUE (product_id, platform)
);

-- rascunho INTERNO de anúncio (nunca publicado neste sprint)
CREATE TABLE IF NOT EXISTS listing_draft (
  id            TEXT PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  company_id    TEXT NOT NULL,
  platform      TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','INCOMPLETE','READY_FOR_REVIEW','BLOCKED','APPROVED_FOR_FUTURE_PUBLISH','ARCHIVED')),
  payload_json  TEXT NOT NULL DEFAULT '{}',   -- título, categoria, atributos, preço...
  findings_json TEXT NOT NULL DEFAULT '[]',
  checklist_json TEXT NOT NULL DEFAULT '[]',
  suggestions_source TEXT,                    -- origem das sugestões (rule pack/versão)
  human_review  TEXT,                         -- campo de revisão humana
  validation_run_id TEXT,
  created_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_draft_company ON listing_draft(company_id, platform, status);

-- trilha de auditoria da validação — APPEND-ONLY, nunca sobrescrita
CREATE TABLE IF NOT EXISTS validation_run (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL,
  product_id     TEXT,
  listing_id     TEXT,
  draft_id       TEXT,
  platform       TEXT NOT NULL,
  category_id    TEXT,
  rule_pack_version TEXT NOT NULL,
  data_source    TEXT NOT NULL,               -- DEMO_RULE_FIXTURE | OFFICIAL_* ...
  executed_at    TEXT NOT NULL,
  executed_by    TEXT NOT NULL DEFAULT 'compliance-engine',
  status         TEXT NOT NULL,               -- READY|READY_WITH_WARNINGS|REVIEW_REQUIRED|BLOCKED|INSUFFICIENT_DATA|NOT_SUPPORTED
  findings_json  TEXT NOT NULL DEFAULT '[]',
  evidence_json  TEXT NOT NULL DEFAULT '{}',
  payload_reference TEXT,
  created_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_vrun_product ON validation_run(product_id, platform, executed_at);
