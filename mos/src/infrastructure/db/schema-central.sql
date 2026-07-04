-- ============================================================
-- CENTRAL DE MARKETPLACE (Sprint 09) — migração ESTRITAMENTE ADITIVA.
-- Nenhuma tabela existente é alterada aqui (colunas novas de
-- marketplace_connection entram por migração de runtime em database.js,
-- verificando existência antes do ALTER). Nada é apagado ou duplicado:
-- anúncios continuam normalizando para `listing` via external_id;
-- estas tabelas cobrem apenas o que NÃO existia (auditoria da Fase 1).
-- ============================================================

-- Credenciais OAuth da loja — CIFRADAS (AES-256-GCM), somente backend.
-- Regra preservada do schema original: credencial NUNCA em settings_json.
CREATE TABLE IF NOT EXISTS marketplace_credential (
  id                TEXT PRIMARY KEY,
  connection_id     TEXT NOT NULL UNIQUE REFERENCES marketplace_connection(id) ON DELETE CASCADE,
  access_token_enc  TEXT NOT NULL,               -- cifrado; nunca em log/frontend/Git
  refresh_token_enc TEXT,                        -- cifrado; separado do access
  token_type        TEXT NOT NULL DEFAULT 'bearer',
  scope             TEXT,
  expires_at        TEXT,
  rotated_at        TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- Estado de sincronização por (conexão × recurso): watermark e contadores.
CREATE TABLE IF NOT EXISTS marketplace_sync_state (
  id               TEXT PRIMARY KEY,
  company_id       TEXT NOT NULL,
  connection_id    TEXT NOT NULL REFERENCES marketplace_connection(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL,
  account_id       TEXT,
  store_id         TEXT,
  resource         TEXT NOT NULL,                -- listings|orders|inventory|prices|metrics
  watermark        TEXT,                         -- último occurredAt processado
  last_attempt_at  TEXT,
  last_success_at  TEXT,
  status           TEXT NOT NULL DEFAULT 'idle', -- idle|running|ok|error
  records_read     INTEGER NOT NULL DEFAULT 0,
  records_created  INTEGER NOT NULL DEFAULT 0,
  records_updated  INTEGER NOT NULL DEFAULT 0,
  records_ignored  INTEGER NOT NULL DEFAULT 0,
  error            TEXT,
  UNIQUE (connection_id, resource)
);

-- Resposta BRUTA preservada para auditoria (o dado como veio da praça).
CREATE TABLE IF NOT EXISTS raw_marketplace_payload (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL,
  connection_id TEXT NOT NULL REFERENCES marketplace_connection(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL,
  resource      TEXT NOT NULL,
  external_id   TEXT,
  payload_json  TEXT NOT NULL,
  fetched_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_raw_conn ON raw_marketplace_payload(connection_id, resource);

-- Pedidos normalizados (não existiam em lugar nenhum — auditoria item 16).
CREATE TABLE IF NOT EXISTS marketplace_order (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL,
  connection_id   TEXT NOT NULL REFERENCES marketplace_connection(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  account_id      TEXT,
  store_id        TEXT,
  external_id     TEXT NOT NULL,
  status          TEXT,
  total           REAL,
  currency        TEXT NOT NULL DEFAULT 'BRL',
  buyer_ref       TEXT,                          -- referência anônima do comprador
  is_custom       INTEGER NOT NULL DEFAULT 0,    -- personalizado (capacidade de produção)
  deadline_at     TEXT,                          -- prazo de expedição/coleta
  occurred_at     TEXT,
  observed_at     TEXT,
  synchronized_at TEXT,
  raw_reference   TEXT,                          -- id em raw_marketplace_payload
  UNIQUE (connection_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_morder_company ON marketplace_order(company_id, platform);

CREATE TABLE IF NOT EXISTS marketplace_order_item (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL REFERENCES marketplace_order(id) ON DELETE CASCADE,
  external_listing_id TEXT,
  sku                 TEXT,
  title               TEXT,
  quantity            INTEGER NOT NULL DEFAULT 1,
  unit_price          REAL
);
CREATE INDEX IF NOT EXISTS idx_morder_item ON marketplace_order_item(order_id);

-- Estoque observado por anúncio/SKU (snapshot auditável por sync).
CREATE TABLE IF NOT EXISTS marketplace_inventory (
  id                  TEXT PRIMARY KEY,
  company_id          TEXT NOT NULL,
  connection_id       TEXT NOT NULL REFERENCES marketplace_connection(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL,
  external_listing_id TEXT NOT NULL,
  sku                 TEXT,
  available           INTEGER,
  reserved            INTEGER,
  occurred_at         TEXT,
  observed_at         TEXT,
  synchronized_at     TEXT,
  raw_reference       TEXT
);
CREATE INDEX IF NOT EXISTS idx_minv_company ON marketplace_inventory(company_id, external_listing_id);

-- Preço observado por anúncio (snapshot auditável por sync).
CREATE TABLE IF NOT EXISTS marketplace_price (
  id                  TEXT PRIMARY KEY,
  company_id          TEXT NOT NULL,
  connection_id       TEXT NOT NULL REFERENCES marketplace_connection(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL,
  external_listing_id TEXT NOT NULL,
  price               REAL,
  original_price      REAL,
  currency            TEXT NOT NULL DEFAULT 'BRL',
  margin_pct          REAL,
  occurred_at         TEXT,
  observed_at         TEXT,
  synchronized_at     TEXT,
  raw_reference       TEXT
);
CREATE INDEX IF NOT EXISTS idx_mprice_company ON marketplace_price(company_id, external_listing_id);

-- Métricas de performance (views, CTR, conversão, vídeo etc.).
CREATE TABLE IF NOT EXISTS marketplace_metric_snapshot (
  id                  TEXT PRIMARY KEY,
  company_id          TEXT NOT NULL,
  connection_id       TEXT NOT NULL REFERENCES marketplace_connection(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL,
  external_listing_id TEXT,
  metric              TEXT NOT NULL,
  value               REAL,
  period              TEXT,
  occurred_at         TEXT,
  observed_at         TEXT,
  synchronized_at     TEXT,
  raw_reference       TEXT
);

-- Log de cada execução de sincronização (histórico auditável).
CREATE TABLE IF NOT EXISTS marketplace_sync_log (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL,
  connection_id   TEXT NOT NULL,
  platform        TEXT NOT NULL,
  resource        TEXT NOT NULL,
  status          TEXT NOT NULL,                 -- ok|error
  started_at      TEXT,
  finished_at     TEXT,
  records_read    INTEGER NOT NULL DEFAULT 0,
  records_created INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  records_ignored INTEGER NOT NULL DEFAULT 0,
  error           TEXT
);

-- Eventos de integração — o id É a chave de idempotência
-- (platform + accountId + eventType + externalEntityId + occurredAt).
-- payload_json é SEMPRE normalizado; o bruto fica em raw_marketplace_payload.
CREATE TABLE IF NOT EXISTS integration_event (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL,
  platform        TEXT NOT NULL,
  account_id      TEXT,
  store_id        TEXT,
  event_type      TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT,
  occurred_at     TEXT,
  observed_at     TEXT,
  synchronized_at TEXT,
  severity        TEXT NOT NULL DEFAULT 'INFO',
  confidence      REAL NOT NULL DEFAULT 1,
  payload_json    TEXT NOT NULL DEFAULT '{}',
  raw_reference   TEXT,
  metadata_json   TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_ievent_company ON integration_event(company_id, event_type);

-- Pesquisa PÚBLICA de mercado — fonte SEPARADA da conta autenticada.
-- Nunca usa token; evidência simples e rastreável (URL + achados).
CREATE TABLE IF NOT EXISTS public_research_evidence (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL,
  source_type   TEXT NOT NULL DEFAULT 'PUBLIC_RESEARCH',
  source_url    TEXT,
  platform      TEXT,
  subject       TEXT,
  findings_json TEXT NOT NULL DEFAULT '{}',
  confidence    REAL,
  observed_at   TEXT NOT NULL
);
