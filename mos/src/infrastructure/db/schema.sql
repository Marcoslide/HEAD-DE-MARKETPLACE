-- ============================================================
-- Marketplace Operating System — Modelagem definitiva (Bloco 03)
-- SQLite (node:sqlite). Relacionamentos documentados em mos/README.md.
-- Convenções: ids textuais prefixados (ws_, prd_, lst_...), timestamps
-- ISO-8601 TEXT, JSON em colunas *_json, FKs com ON DELETE explícito.
-- ============================================================
PRAGMA foreign_keys = ON;

-- ---------- Identidade e organização ----------
CREATE TABLE IF NOT EXISTS workspace (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  role         TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','operator','viewer')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS company (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  objectives_json TEXT NOT NULL DEFAULT '[]',   -- Art. 4: objetivos declarados
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS marketplace_connection (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('mercado_livre','shopee','amazon','magalu','tiktok')),
  status      TEXT NOT NULL DEFAULT 'simulated' CHECK (status IN ('simulated','connected','error','revoked')),
  settings_json TEXT NOT NULL DEFAULT '{}',     -- nunca credenciais nesta fase
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Catálogo ----------
CREATE TABLE IF NOT EXISTS product (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sku         TEXT,
  cost        REAL,
  attributes_json TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_product_company ON product(company_id);

CREATE TABLE IF NOT EXISTS listing (
  id            TEXT PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL REFERENCES marketplace_connection(id) ON DELETE CASCADE,
  external_id   TEXT,                            -- id no marketplace (futuro)
  title         TEXT NOT NULL,
  price         REAL NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','active','paused','taken_down','archived')),
  health_score  INTEGER,                         -- 0-100 (julgamento do MIE)
  ranking       INTEGER,
  active_version_id TEXT,                        -- FK lógica p/ listing_version
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_listing_product ON listing(product_id);
CREATE INDEX IF NOT EXISTS idx_listing_connection ON listing(connection_id);
CREATE INDEX IF NOT EXISTS idx_listing_status ON listing(status);

CREATE TABLE IF NOT EXISTS listing_version (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,                  -- v1, v2, ...
  title       TEXT NOT NULL,
  description TEXT,
  images_json TEXT NOT NULL DEFAULT '[]',
  price       REAL NOT NULL,
  author      TEXT NOT NULL DEFAULT 'head' CHECK (author IN ('head','user')),
  reason      TEXT,                              -- por que esta versão existe
  result_json TEXT,                              -- efeito medido (Fluxo 010)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (listing_id, number)
);
CREATE INDEX IF NOT EXISTS idx_version_listing ON listing_version(listing_id);

-- ---------- Cognição (espelho persistente do MIE) ----------
CREATE TABLE IF NOT EXISTS investigation (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  product_id  TEXT REFERENCES product(id) ON DELETE SET NULL,
  anomaly_kind TEXT NOT NULL,
  playbook    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','diagnosed','closed')),
  steps_json  TEXT NOT NULL DEFAULT '[]',        -- diário de bordo (Art. 12)
  diagnosis_json TEXT,
  confidence  REAL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_investigation_company ON investigation(company_id, status);

CREATE TABLE IF NOT EXISTS decision (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  investigation_id TEXT REFERENCES investigation(id) ON DELETE SET NULL,
  product_id    TEXT REFERENCES product(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  discovery     TEXT NOT NULL,                   -- estrutura fixa do Card de Decisão
  probable_cause TEXT,
  proposal_json TEXT NOT NULL,
  impact_min    REAL, impact_max REAL,           -- R$/mês
  confidence    TEXT CHECK (confidence IN ('alta','média','baixa')),
  reversibility TEXT,
  class         TEXT NOT NULL DEFAULT 'C' CHECK (class IN ('A','B','C')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','adjusted','refused','expired')),
  refusal_motive TEXT,                           -- Art. 18: recusas ensinam
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_decision_pending ON decision(company_id, status);

CREATE TABLE IF NOT EXISTS mission (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  product_id  TEXT REFERENCES product(id) ON DELETE SET NULL,
  decision_id TEXT REFERENCES decision(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL,                     -- investigando/criando/executando/...
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','waiting_user','done','cancelled')),
  origin      TEXT NOT NULL,                     -- quem pediu / por que iniciei
  log_json    TEXT NOT NULL DEFAULT '[]',        -- diário narrado
  result      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_mission_active ON mission(company_id, status);

CREATE TABLE IF NOT EXISTS opportunity (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  product_id  TEXT REFERENCES product(id) ON DELETE SET NULL,
  radar       TEXT NOT NULL,                     -- qual radar do MIF Parte 4
  description TEXT NOT NULL,
  impact_monthly REAL,
  window_expires TEXT,
  status      TEXT NOT NULL DEFAULT 'watching' CHECK (status IN ('watching','validated','promoted','discarded')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS execution_plan (
  id           TEXT PRIMARY KEY,
  decision_id  TEXT REFERENCES decision(id) ON DELETE SET NULL,
  company_id   TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  product_id   TEXT REFERENCES product(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  type         TEXT NOT NULL,
  steps_json   TEXT NOT NULL DEFAULT '[]',
  prediction_json TEXT,                          -- Art. 15: previsão ANTES
  result_json  TEXT,
  status       TEXT NOT NULL DEFAULT 'executing' CHECK (status IN ('planned','executing','measured','reverted')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS publication_history (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  version_id  TEXT REFERENCES listing_version(id) ON DELETE SET NULL,
  action      TEXT NOT NULL CHECK (action IN ('create','update','pause','resume','takedown_appeal','simulated_publish','rollback')),
  simulated   INTEGER NOT NULL DEFAULT 1,        -- nesta fase, sempre 1
  payload_json TEXT NOT NULL DEFAULT '{}',
  outcome     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pub_listing ON publication_history(listing_id);

-- ---------- Mundo externo observado ----------
CREATE TABLE IF NOT EXISTS competitor (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  external_ref TEXT,
  weakness    TEXT,
  first_seen  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS competitor_snapshot (
  id            TEXT PRIMARY KEY,
  competitor_id TEXT NOT NULL REFERENCES competitor(id) ON DELETE CASCADE,
  day           INTEGER NOT NULL,
  price         REAL,
  rating        REAL,
  ranking       INTEGER,
  creative      TEXT,
  data_json     TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_snapshot_competitor ON competitor_snapshot(competitor_id, day);

CREATE TABLE IF NOT EXISTS review (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  text        TEXT,
  answered    INTEGER NOT NULL DEFAULT 0,
  answer      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_review_listing ON review(listing_id);

CREATE TABLE IF NOT EXISTS question (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  answered    INTEGER NOT NULL DEFAULT 0,
  answer      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS keyword (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  product_id  TEXT REFERENCES product(id) ON DELETE SET NULL,
  term        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','testing','proven','retired')),
  effect_json TEXT,                              -- efeito medido quando testada
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS keyword_trend (
  id          TEXT PRIMARY KEY,
  keyword_id  TEXT NOT NULL REFERENCES keyword(id) ON DELETE CASCADE,
  day         INTEGER NOT NULL,
  volume_index REAL NOT NULL,                    -- índice relativo de busca
  source      TEXT NOT NULL DEFAULT 'simulated',
  UNIQUE (keyword_id, day)
);

-- ---------- Experimentação ----------
CREATE TABLE IF NOT EXISTS experiment (
  id           TEXT PRIMARY KEY,
  listing_id   TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  hypothesis   TEXT NOT NULL,                    -- "acredito que X porque Y"
  variable     TEXT NOT NULL,                    -- UMA variável por vez (MIF 6.1)
  baseline_version_id TEXT REFERENCES listing_version(id) ON DELETE SET NULL,
  variant_version_id  TEXT REFERENCES listing_version(id) ON DELETE SET NULL,
  metric       TEXT NOT NULL,
  success_criteria_json TEXT NOT NULL,           -- definido ANTES (MIF 6.2)
  window_days  INTEGER NOT NULL DEFAULT 7,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','stopped_early','concluded','rolled_back')),
  result_json  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  concluded_at TEXT
);

-- ---------- Memória e aprendizado (Arts. 15-18) ----------
CREATE TABLE IF NOT EXISTS memory (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,                     -- dedupe da descoberta
  kind        TEXT NOT NULL CHECK (kind IN ('pattern','strategy','keyword','creative','preference','baseline')),
  discovery   TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  strength    INTEGER NOT NULL DEFAULT 1 CHECK (strength BETWEEN 1 AND 3),
  needs_revalidation INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, key)
);
CREATE INDEX IF NOT EXISTS idx_memory_kind ON memory(company_id, kind, strength);

CREATE TABLE IF NOT EXISTS learning (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  plan_id     TEXT REFERENCES execution_plan(id) ON DELETE SET NULL,
  strategy_type TEXT NOT NULL,
  predicted_json TEXT NOT NULL,
  actual      REAL,
  hit         INTEGER,
  autopsy     TEXT,                              -- Art. 18: autópsia curta
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Auditoria (a caixa-preta) ----------
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT, -- append-only
  company_id  TEXT,
  actor       TEXT NOT NULL,                     -- engine/serviço/usuário
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
