-- ============================================================
-- CONEXÕES REAIS E PILOTO (Sprint 10.A) — ADITIVO.
-- Lacunas reais apenas: OAuth state, feature flags, WhatsApp oficial,
-- snapshot oficial de categoria, Truth Pack, criativos e o piloto.
-- Tokens continuam APENAS no vault cifrado do Sprint 09
-- (marketplace_credential) — nada de segredo nestas tabelas.
-- ============================================================

-- estado OAuth: de uso ÚNICO, com expiração — nunca reutilizável
CREATE TABLE IF NOT EXISTS oauth_state (
  id          TEXT PRIMARY KEY,               -- o próprio state (nonce)
  company_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  platform    TEXT NOT NULL,
  connection_id TEXT,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT                             -- preenchido no 1º uso; 2º uso é bloqueado
);

-- feature flags por empresa/conta/usuário — TUDO nasce desligado
CREATE TABLE IF NOT EXISTS feature_flag (
  id          TEXT PRIMARY KEY,
  flag        TEXT NOT NULL,
  company_id  TEXT,
  account_id  TEXT,
  user_id     TEXT,
  enabled     INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT,
  UNIQUE (flag, company_id, account_id, user_id)
);

-- conexão WhatsApp Business OFICIAL (credenciais no vault, nunca aqui)
CREATE TABLE IF NOT EXISTS whatsapp_connection (
  id               TEXT PRIMARY KEY,
  company_id       TEXT NOT NULL,
  phone_number_id  TEXT,
  waba_id          TEXT,
  display_number   TEXT,
  status           TEXT NOT NULL DEFAULT 'WHATSAPP_INBOUND_DISABLED',
  webhook_verified_at TEXT,
  last_inbound_at  TEXT,
  error            TEXT,
  created_at TEXT, updated_at TEXT
);

-- eventos inbound do WhatsApp — deduplicados pelo id oficial da mensagem
CREATE TABLE IF NOT EXISTS whatsapp_event (
  id           TEXT PRIMARY KEY,              -- message id oficial (dedup)
  company_id   TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  from_number  TEXT,
  kind         TEXT,                          -- text|image|other
  text         TEXT,
  occurred_at  TEXT,
  observed_at  TEXT,
  replied      INTEGER NOT NULL DEFAULT 0,
  reply_text   TEXT,
  payload_reference TEXT,
  created_at   TEXT
);

-- snapshot OFICIAL de categoria/atributos (pós-OAuth) — a trava do piloto:
-- categoria PROVISIONAL do rule pack nunca aprova anúncio real
CREATE TABLE IF NOT EXISTS category_snapshot (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  platform      TEXT NOT NULL,
  category_id   TEXT NOT NULL,
  category_path TEXT,
  attributes_json TEXT NOT NULL DEFAULT '[]', -- obrigatórios/opcionais OFICIAIS
  restrictions_json TEXT NOT NULL DEFAULT '{}',
  source        TEXT NOT NULL,                -- OFFICIAL_API | mock nos testes
  source_url    TEXT,
  api_version   TEXT,
  fetched_at    TEXT NOT NULL,
  created_at    TEXT
);

-- Product Truth Pack — retrato IMUTÁVEL do produto para fidelidade
CREATE TABLE IF NOT EXISTS product_truth_pack (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL,
  company_id   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  pack_json    TEXT NOT NULL,                 -- fatos invariantes do produto
  assets_hash  TEXT NOT NULL,
  profile_hash TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

-- criativos gerados/aguardando — nunca uma imagem fake vira "real"
CREATE TABLE IF NOT EXISTS creative_asset (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL,
  company_id     TEXT NOT NULL,
  platform       TEXT NOT NULL,
  creative_type  TEXT NOT NULL,
  truth_pack_id  TEXT NOT NULL,
  source_asset_ids TEXT NOT NULL DEFAULT '[]',
  briefing_json  TEXT NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'CREATIVE_DRAFT',
  provider       TEXT,                        -- null = aguardando provider
  model          TEXT,
  generation_job TEXT,
  image_url      TEXT,
  fidelity_json  TEXT NOT NULL DEFAULT '{}',
  human_review   TEXT,                        -- quem aprovou/reprovou e quando
  draft_id       TEXT,
  created_at TEXT, updated_at TEXT
);

-- o PILOTO: trilha completa de auditoria + idempotência
CREATE TABLE IF NOT EXISTS pilot_run (
  id               TEXT PRIMARY KEY,
  idempotency_key  TEXT NOT NULL UNIQUE,      -- draft+conta+hash → nunca 2 anúncios
  company_id       TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  connection_id    TEXT NOT NULL,
  marketplace_account_id TEXT,
  listing_draft_id TEXT NOT NULL,
  product_id       TEXT NOT NULL,
  creative_asset_ids TEXT NOT NULL DEFAULT '[]',
  truth_pack_id    TEXT,
  category_snapshot_id TEXT,
  payload_json     TEXT NOT NULL,
  payload_hash     TEXT NOT NULL,
  stage            TEXT NOT NULL,             -- DRY_RUN|READY_FOR_PILOT|CONFIRMED|CREATED|FAILED
  confirmation_at  TEXT,
  request_at       TEXT,
  response_at      TEXT,
  external_listing_id TEXT,
  response_json    TEXT,                      -- resposta externa (mascarada)
  error            TEXT,
  rollback_note    TEXT,
  created_at TEXT, updated_at TEXT
);
