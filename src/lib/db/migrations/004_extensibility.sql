-- ============================================================================
-- E.V. — Migración 004: documentos, integraciones, dispositivos, automatizaciones
-- y uso de IA (control de costes).
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL CHECK (size_bytes >= 0),
  storage_path   TEXT NOT NULL,
  folder         TEXT NOT NULL DEFAULT '/',
  project_id     TEXT REFERENCES projects(id) ON DELETE SET NULL,
  extracted_text TEXT,
  summary        TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);

CREATE TABLE IF NOT EXISTS document_chunks (
  id          TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id, chunk_index);

CREATE TABLE IF NOT EXISTS integrations (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL
                CHECK (provider IN ('ai','email','whatsapp','voice','google_calendar','telegram')),
  status        TEXT NOT NULL DEFAULT 'disconnected'
                CHECK (status IN ('disconnected','configured','connected')),
  config        TEXT NOT NULL DEFAULT '{}',
  -- Cifrado con ENCRYPTION_KEY (AES-256-GCM); nunca se envía al cliente.
  secret_cipher TEXT,
  secret_iv     TEXT,
  secret_tag    TEXT,
  last_error    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_unique ON integrations(user_id, provider);

CREATE TABLE IF NOT EXISTS connected_devices (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  device_type           TEXT NOT NULL DEFAULT 'web'
                        CHECK (device_type IN ('web','mobile','desktop','home_speaker','other')),
  platform              TEXT NOT NULL DEFAULT '',
  push_endpoint         TEXT,
  push_p256dh           TEXT,
  push_auth             TEXT,
  notifications_enabled INTEGER NOT NULL DEFAULT 0,
  last_seen_at          TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON connected_devices(user_id);

CREATE TABLE IF NOT EXISTS automation_rules (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  trigger_type   TEXT NOT NULL
                 CHECK (trigger_type IN ('daily_summary','budget_alert','overdue_tasks','habit_reminder','custom')),
  trigger_config TEXT NOT NULL DEFAULT '{}',
  enabled        INTEGER NOT NULL DEFAULT 1,
  last_run_at    TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_automation_rules_user ON automation_rules(user_id, enabled);

CREATE TABLE IF NOT EXISTS automation_runs (
  id          TEXT PRIMARY KEY,
  rule_id     TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','error','skipped')),
  detail      TEXT NOT NULL DEFAULT '',
  error       TEXT,
  started_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_automation_runs ON automation_runs(rule_id, started_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cents        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_month ON ai_usage_logs(user_id, created_at);
