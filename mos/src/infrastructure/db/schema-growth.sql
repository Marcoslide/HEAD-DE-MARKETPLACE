-- CRESCIMENTO (Sprint 10.B) — afiliados, promoções, campanhas,
-- jobs internos, aprovações, conflitos de dados e taxas por praça.
-- Regra de ouro: NADA aqui nasce solto — tudo vincula produto, anúncio,
-- marketplace, campanha, origem, venda e margem. Nenhuma escrita externa.

-- ---------------------------------------------------------------------------
-- ESTRUTURAL: papéis, aprovações, jobs, conflitos, taxas
-- ---------------------------------------------------------------------------

-- papéis do Crescimento (o CHECK legado de user.role permanece intocado)
CREATE TABLE IF NOT EXISTS user_role (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user(id),
  company_id   TEXT NOT NULL REFERENCES company(id),
  role         TEXT NOT NULL CHECK (role IN
    ('ADMIN','GESTOR_MARKETPLACE','OPERADOR_CATALOGO','COMERCIAL','FINANCEIRO','LEITURA')),
  granted_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, company_id)
);

-- Approval Flow: edição em massa, promoção, preço, margem mínima,
-- criação de anúncio, publicação futura, pagamento/comissão futura
CREATE TABLE IF NOT EXISTS approval_request (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL REFERENCES company(id),
  kind         TEXT NOT NULL CHECK (kind IN
    ('MASS_EDIT','PROMOTION','PRICE_CHANGE','MIN_MARGIN_CHANGE',
     'LISTING_CREATE','FUTURE_PUBLISH','COMMISSION_PAYOUT')),
  entity       TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  requested_by TEXT,
  status       TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  decided_by   TEXT,
  decided_at   TEXT,
  motive       TEXT,
  detail_json  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- jobs internos: toda ação em massa tem contadores, pausa, cancelamento,
-- relatório, auditoria e rollback interno quando aplicável
CREATE TABLE IF NOT EXISTS internal_job (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES company(id),
  kind          TEXT NOT NULL,
  origin        TEXT NOT NULL CHECK (origin IN
    ('DASHBOARD_MANUAL','WHATSAPP_COMMAND','CHAT_OPERACIONAL','JOB_INTERNO',
     'INTEGRACAO_EXTERNA','IMPORTACAO_MANUAL','SISTEMA')),
  status        TEXT NOT NULL DEFAULT 'AWAITING_CONFIRMATION'
    CHECK (status IN ('AWAITING_CONFIRMATION','QUEUED','RUNNING','PAUSED',
                      'CANCELLED','DONE','FAILED')),
  total         INTEGER NOT NULL DEFAULT 0,
  processed     INTEGER NOT NULL DEFAULT 0,
  succeeded     INTEGER NOT NULL DEFAULT 0,
  blocked       INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  reasons_json  TEXT,
  params_json   TEXT,
  summary_json  TEXT,
  report_json   TEXT,
  rollback_json TEXT,
  requires_confirmation INTEGER NOT NULL DEFAULT 0,
  confirmed_at  TEXT,
  requested_by  TEXT,
  requester_ref TEXT,          -- ex.: número do administrador no WhatsApp
  approval_id   TEXT,
  finished_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT
);

-- conflito manual × sincronização: sync NUNCA apaga edição manual em silêncio
CREATE TABLE IF NOT EXISTS data_conflict (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES company(id),
  entity        TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  field         TEXT NOT NULL,
  manual_value  TEXT,
  sync_value    TEXT,
  manual_source TEXT NOT NULL,
  sync_source   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED'
    CHECK (status IN ('REVIEW_REQUIRED','RESOLVED')),
  resolution    TEXT,
  resolved_by   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at   TEXT
);

-- taxas por praça para cálculo de margem (fonte SEMPRE identificada;
-- INTERNAL_DEFAULT é estimativa interna, nunca tarifa oficial)
CREATE TABLE IF NOT EXISTS marketplace_fee_profile (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES company(id),
  marketplace     TEXT NOT NULL,
  commission_pct  REAL NOT NULL,
  fixed_fee       REAL NOT NULL DEFAULT 0,
  shipping_subsidy REAL NOT NULL DEFAULT 0,
  tax_pct         REAL NOT NULL DEFAULT 0,
  ads_pct_default REAL NOT NULL DEFAULT 0,
  source          TEXT NOT NULL DEFAULT 'INTERNAL_DEFAULT'
    CHECK (source IN ('INTERNAL_DEFAULT','MANUAL','OFFICIAL_API')),
  verified_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT,
  UNIQUE (company_id, marketplace)
);

-- ---------------------------------------------------------------------------
-- LEADS E OPORTUNIDADES
-- ---------------------------------------------------------------------------




CREATE TABLE IF NOT EXISTS conversation (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL,
  channel     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  started_at  TEXT,
  last_message_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);






-- ---------------------------------------------------------------------------
-- AFILIADOS (Affiliate Intelligence)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS affiliate_partner (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL REFERENCES company(id),
  name           TEXT NOT NULL,
  contact        TEXT,
  channel        TEXT,
  commission_pct REAL,
  status         TEXT NOT NULL DEFAULT 'PENDENTE_DE_DADOS' CHECK (status IN
    ('ATIVO','PAUSADO','EM_REVISAO','PENDENTE_DE_DADOS','SEM_ATRIBUICAO_CONFIRMADA')),
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE TABLE IF NOT EXISTS affiliate_code (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  affiliate_id TEXT NOT NULL REFERENCES affiliate_partner(id),
  code         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS affiliate_link (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  affiliate_id TEXT NOT NULL REFERENCES affiliate_partner(id),
  url          TEXT NOT NULL,
  campaign_id  TEXT,
  product_id   TEXT,
  marketplace  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS affiliate_campaign (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  affiliate_id TEXT NOT NULL REFERENCES affiliate_partner(id),
  campaign_id  TEXT,
  name         TEXT NOT NULL,
  starts_at    TEXT,
  ends_at      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- eventos de atribuição: clique NUNCA vira comissão automaticamente
CREATE TABLE IF NOT EXISTS affiliate_attribution_event (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  affiliate_id TEXT NOT NULL REFERENCES affiliate_partner(id),
  kind         TEXT NOT NULL CHECK (kind IN ('click','sale')),
  order_ref    TEXT,
  product_id   TEXT,
  marketplace  TEXT,
  rule         TEXT,              -- regra de atribuição aplicada
  window_days  INTEGER,           -- janela de atribuição
  confidence   TEXT NOT NULL DEFAULT 'DESCONHECIDA'
    CHECK (confidence IN ('CONFIRMADA','ESTIMADA','DESCONHECIDA')),
  source       TEXT NOT NULL,
  occurred_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- uma venda pertence a UM afiliado: order_ref é único por empresa
CREATE TABLE IF NOT EXISTS affiliate_conversion (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL,
  affiliate_id TEXT NOT NULL REFERENCES affiliate_partner(id),
  order_ref    TEXT NOT NULL,
  amount       REAL NOT NULL,
  marketplace  TEXT,
  product_id   TEXT,
  status       TEXT NOT NULL DEFAULT 'APROVADA'
    CHECK (status IN ('APROVADA','CANCELADA','DEVOLVIDA')),
  confidence   TEXT NOT NULL DEFAULT 'DESCONHECIDA'
    CHECK (confidence IN ('CONFIRMADA','ESTIMADA','DESCONHECIDA')),
  source       TEXT NOT NULL,
  occurred_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, order_ref)
);

-- comissões nascem ESTIMADAS — nunca viram pagamento real automaticamente
CREATE TABLE IF NOT EXISTS affiliate_commission (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL,
  affiliate_id  TEXT NOT NULL REFERENCES affiliate_partner(id),
  conversion_id TEXT REFERENCES affiliate_conversion(id),
  amount        REAL NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ESTIMADA'
    CHECK (status IN ('ESTIMADA','APROVADA','PENDENTE','CANCELADA')),
  payout_batch_id TEXT,
  source        TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS affiliate_payout_batch (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL,
  period      TEXT NOT NULL,
  total       REAL NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'RASCUNHO'
    CHECK (status IN ('RASCUNHO','EM_REVISAO')),  -- pagamento real: fluxo futuro
  approval_id TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT
);

-- ---------------------------------------------------------------------------
-- PROMOÇÕES E CAMPANHAS (entidade COMPARTILHADA Catálogo ↔ Crescimento)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS promotion (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL REFERENCES company(id),
  name           TEXT NOT NULL,
  objective      TEXT,
  marketplace    TEXT NOT NULL,
  discount_type  TEXT NOT NULL DEFAULT 'PCT' CHECK (discount_type IN ('PCT','PRECO')),
  discount_value REAL NOT NULL,
  starts_at      TEXT,
  ends_at        TEXT,
  status         TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN
    ('RASCUNHO','EM_REVISAO','APROVADA_INTERNAMENTE','AGUARDANDO_CONEXAO',
     'AGUARDANDO_AUTORIZACAO_DE_ESCRITA','ATIVA_EXTERNAMENTE','PAUSADA',
     'ENCERRADA','CANCELADA')),
  review_reason  TEXT,
  campaign_id    TEXT,
  affiliate_id   TEXT,
  origin         TEXT NOT NULL,
  created_by     TEXT,
  approval_id    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE TABLE IF NOT EXISTS promotion_target (
  id           TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL REFERENCES promotion(id),
  company_id   TEXT NOT NULL,
  product_id   TEXT NOT NULL,
  listing_id   TEXT,
  marketplace  TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS promotion_marketplace_profile (
  id           TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL REFERENCES promotion(id),
  marketplace  TEXT NOT NULL,
  params_json  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS promotion_eligibility (
  id           TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL REFERENCES promotion(id),
  product_id   TEXT NOT NULL,
  eligible     INTEGER NOT NULL DEFAULT 0,
  reasons_json TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS promotion_margin_simulation (
  id            TEXT PRIMARY KEY,
  promotion_id  TEXT NOT NULL REFERENCES promotion(id),
  product_id    TEXT NOT NULL,
  marketplace   TEXT NOT NULL,
  breakdown_json TEXT,
  margin_pct    REAL,
  min_price     REAL,
  stock_risk    TEXT,
  computable    INTEGER NOT NULL DEFAULT 0,
  reason        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS promotion_inventory_cap (
  id           TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL REFERENCES promotion(id),
  product_id   TEXT NOT NULL,
  cap_units    INTEGER,
  committed    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaign (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES company(id),
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'INTERNA',
  objective   TEXT,
  starts_at   TEXT,
  ends_at     TEXT,
  status      TEXT NOT NULL DEFAULT 'RASCUNHO',
  origin      TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS campaign_target (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaign(id),
  company_id  TEXT NOT NULL,
  kind        TEXT NOT NULL,      -- product | listing | promotion | affiliate
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaign_performance_snapshot (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaign(id),
  company_id   TEXT NOT NULL,
  period       TEXT NOT NULL,
  metrics_json TEXT,
  source       TEXT NOT NULL,
  captured_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_aff_conv_company ON affiliate_conversion(company_id, affiliate_id);
CREATE INDEX IF NOT EXISTS idx_promo_company ON promotion(company_id, status);
CREATE INDEX IF NOT EXISTS idx_job_company ON internal_job(company_id, status);

-- ---------------------------------------------------------------------------
-- CRIAÇÃO PELA CONVERSA + DATA COMPLETION (complementos do Sprint 10.B)
-- ---------------------------------------------------------------------------

-- entrada provisória de produto: NUNCA vira Product Master sem revisão
CREATE TABLE IF NOT EXISTS product_intake (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES company(id),
  status        TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN
    ('NEW','AWAITING_PRODUCT_DATA','AWAITING_IMAGES','AWAITING_MEASUREMENTS',
     'AWAITING_COST','AWAITING_MARKETPLACE','READY_TO_CREATE_PRODUCT_MASTER',
     'REJECTED_DUPLICATE','ARCHIVED')),
  provisional_name TEXT,
  sku           TEXT,
  data_json     TEXT,            -- material, medidas, peso, custo, preço, estoque, prazo…
  marketplaces_json TEXT,
  origin        TEXT NOT NULL,
  message_id    TEXT,
  link_id       TEXT,
  product_id    TEXT,            -- preenchido se casar com produto existente
  duplicate_of  TEXT,
  responsible   TEXT,
  notes         TEXT,
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT
);

-- upload vindo da conversa: origem, hash, tipo e uso permitido SEMPRE gravados
CREATE TABLE IF NOT EXISTS intake_asset (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL,
  intake_id     TEXT,
  product_id    TEXT,
  kind          TEXT NOT NULL CHECK (kind IN ('OFFICIAL','REFERENCE','CREATIVE_REF','UNCLASSIFIED')),
  asset_type    TEXT NOT NULL DEFAULT 'image',
  url           TEXT,
  hash          TEXT NOT NULL,
  origin        TEXT NOT NULL,
  uploaded_by   TEXT,
  message_id    TEXT,
  review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  allowed_use   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- link colado na conversa: registrado como referência — NUNCA copiado
CREATE TABLE IF NOT EXISTS source_reference (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL,
  url           TEXT NOT NULL,
  domain        TEXT,
  link_kind     TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (link_kind IN
    ('OWN_LISTING','OWN_PRODUCT','SUPPLIER','REFERENCE','COMPETITOR','MARKETPLACE','EXTERNAL_CATALOG','UNKNOWN')),
  purpose       TEXT,            -- confirmado pelo usuário; sem confirmação = referência
  intake_id     TEXT,
  product_id    TEXT,
  content_copied INTEGER NOT NULL DEFAULT 0,   -- SEMPRE 0: nunca copiamos conteúdo de terceiros
  insights_json TEXT,
  registered_by TEXT,
  origin        TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Data Completion Engine: pendência de dado vira pergunta, não alerta parado
CREATE TABLE IF NOT EXISTS data_request (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES company(id),
  product_id    TEXT,
  variation_id  TEXT,
  listing_draft_id TEXT,
  marketplace   TEXT,
  field         TEXT NOT NULL,
  label         TEXT NOT NULL,
  motive        TEXT,
  criticality   TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (criticality IN ('BLOCKER','HIGH','MEDIUM','LOW')),
  rule_source   TEXT,
  rule_pack     TEXT,
  status        TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN
    ('OPEN','ASKED','ANSWERED','NEEDS_CONFIRMATION','RESOLVED','EXPIRED','CANCELLED','SUPERSEDED')),
  responsible_role TEXT,
  responsible_user TEXT,
  responsible_ref  TEXT,          -- telefone allowlisted quando canal = whatsapp
  unassigned    INTEGER NOT NULL DEFAULT 0,
  channel       TEXT,
  question_text TEXT,
  expected_format TEXT,
  answer_raw    TEXT,
  answer_normalized TEXT,
  previous_value TEXT,
  confidence    TEXT,
  source        TEXT,
  answered_by   TEXT,
  audit_json    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  asked_at      TEXT,
  answered_at   TEXT,
  resolved_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_datareq ON data_request(company_id, status, product_id);
