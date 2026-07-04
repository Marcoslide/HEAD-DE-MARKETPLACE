-- HEAD INTELLIGENCE OS (Sprint 10.C) — evolução do RID existente.
-- Nada aqui substitui memória, jobs, missões, aprovações ou auditoria:
-- estas tabelas REGISTRAM o raciocínio (radar → diagnóstico → diálogo →
-- plano → intervenção → aprendizado → relatório) sobre a base do 10.B.

CREATE TABLE IF NOT EXISTS radar_signal (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES company(id),
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  detail_json TEXT,
  score_json  TEXT,             -- impacto, urgência, risco, tendência, confiança…
  score       REAL NOT NULL DEFAULT 0,
  level       TEXT NOT NULL CHECK (level IN ('SILENCE','MONITOR','ALERT','DIALOGUE','PLAN')),
  status      TEXT NOT NULL DEFAULT 'OPEN',
  entity      TEXT, entity_id TEXT, marketplace TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS strategic_dialogue (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES company(id),
  status          TEXT NOT NULL DEFAULT 'DETECTED' CHECK (status IN
    ('DETECTED','AWAITING_OWNER_DIRECTION','OWNER_APPROVED_RID_DIRECTION',
     'OWNER_KEPT_PREVIOUS_DIRECTION','OWNER_REQUESTED_TEST',
     'OWNER_REQUESTED_MORE_ANALYSIS','OWNER_POSTPONED_DECISION','CLOSED','SUPERSEDED')),
  subject         TEXT NOT NULL,
  context         TEXT,
  previous_decision TEXT NOT NULL,     -- a direção anterior do dono NUNCA é ignorada
  source_decision_id TEXT,
  previous_source TEXT,
  new_evidence_json TEXT,
  conflict        TEXT,
  alternatives_json TEXT,
  rid_recommendation TEXT,
  impact_json     TEXT,
  risks_json      TEXT,
  cost_estimate   TEXT,
  confidence      TEXT,
  owner_question  TEXT,
  owner_response  TEXT,
  final_decision  TEXT,
  approved_direction TEXT,
  action_plan_id  TEXT,
  audit_json      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  answered_at     TEXT,
  closed_at       TEXT
);

CREATE TABLE IF NOT EXISTS intelligence_action_plan (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES company(id),
  title         TEXT NOT NULL,
  problem       TEXT, opportunity TEXT, objective TEXT,
  facts_json    TEXT, hypotheses_json TEXT, evidence_json TEXT,
  confidence    TEXT,
  impact_json   TEXT, risk TEXT, priority TEXT,
  product_ids_json TEXT, marketplace_ids_json TEXT,
  responsible_json TEXT, actions_json TEXT,
  deadline      TEXT, cost_estimate TEXT,
  success_metric TEXT, baseline_json TEXT, observation_period_days INTEGER,
  status        TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN
    ('DRAFT','RECOMMENDED','AWAITING_APPROVAL','APPROVED','IN_EXECUTION',
     'WAITING_FOR_DATA','MONITORING','SUCCESSFUL','UNSUCCESSFUL','INCONCLUSIVE','CANCELLED')),
  origin        TEXT NOT NULL,
  dialogue_id   TEXT, approval_id TEXT, mission_id TEXT,
  result_json   TEXT, final_learning TEXT,
  audit_json    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS intelligence_microtask (
  id          TEXT PRIMARY KEY,
  plan_id     TEXT NOT NULL REFERENCES intelligence_action_plan(id),
  company_id  TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  title       TEXT NOT NULL,
  responsible TEXT,
  due_at      TEXT,
  status      TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','DONE','BLOCKED')),
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS operational_intervention (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL REFERENCES company(id),
  action_plan_id TEXT,
  product_ids_json TEXT, marketplace_ids_json TEXT,
  description    TEXT NOT NULL,
  kind           TEXT,
  before_json    TEXT,           -- linha de base ANTES da mudança
  change_applied TEXT,
  responsible    TEXT,
  started_at     TEXT,
  monitoring_days INTEGER,
  metrics_json   TEXT,
  baseline_json  TEXT,
  cost           TEXT,
  evidence_json  TEXT,
  result         TEXT NOT NULL DEFAULT 'NOT_ENOUGH_DATA' CHECK (result IN
    ('NOT_ENOUGH_DATA','IMPROVING','NO_EFFECT','WORSENING','SUCCESSFUL','INCONCLUSIVE')),
  conclusion     TEXT,
  confidence     TEXT,
  learning       TEXT,
  reusable       INTEGER NOT NULL DEFAULT 0,
  audit_json     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE TABLE IF NOT EXISTS user_leadership_profile (
  id                 TEXT PRIMARY KEY,
  company_id         TEXT NOT NULL REFERENCES company(id),
  user_id            TEXT NOT NULL,
  preferred_name     TEXT,
  communication_tone TEXT DEFAULT 'direto',
  detail_level       TEXT DEFAULT 'resumo',
  decision_style     TEXT,
  interruption_preference TEXT,
  execution_support_style TEXT,
  focus_windows_json TEXT,
  strategic_priorities_json TEXT,
  approval_boundaries_json TEXT,
  humor_preference   TEXT,
  language_patterns_json TEXT,
  recurring_goals_json TEXT,
  anti_preferences_json TEXT,
  confidence         TEXT DEFAULT 'LOW',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT,
  UNIQUE (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS intelligence_report (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL REFERENCES company(id),
  kind         TEXT NOT NULL CHECK (kind IN
    ('DAILY_BRIEF','WEEKLY_REVIEW','CRITICAL_ALERT','INTERVENTION','RISK',
     'OPPORTUNITY','COMMERCIAL_EFFICIENCY')),
  period       TEXT NOT NULL,
  dedup_key    TEXT NOT NULL,    -- anti-spam: 1 relatório por tipo/período
  body_json    TEXT,
  text         TEXT,
  data_kinds_json TEXT,          -- REAL / IMPORTADO / DEMONSTRATIVO por bloco
  coverage     TEXT,
  confidence   TEXT,
  delivered_json TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, dedup_key)
);
