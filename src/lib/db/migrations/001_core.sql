-- ============================================================================
-- E.V. — Migración 001: núcleo del sistema
-- Usuarios, configuración, sesiones, auditoría, asistente, memoria, tareas,
-- proyectos, calendario, recordatorios, notificaciones y aprobaciones.
-- Dialecto: SQLite (compatible con la traducción a PostgreSQL documentada en
-- docs/DATABASE.md).
-- ============================================================================

-- ---------- Identidad y sesiones ----------

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id                   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone                  TEXT NOT NULL DEFAULT 'America/Monterrey',
  theme                     TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
  assistant_name            TEXT NOT NULL DEFAULT 'E.V.',
  assistant_style           TEXT NOT NULL DEFAULT 'natural'
                            CHECK (assistant_style IN ('natural','formal','direct','friendly')),
  response_length           TEXT NOT NULL DEFAULT 'medium'
                            CHECK (response_length IN ('short','medium','long')),
  formality                 INTEGER NOT NULL DEFAULT 1 CHECK (formality BETWEEN 0 AND 2),
  proactivity               TEXT NOT NULL DEFAULT 'normal'
                            CHECK (proactivity IN ('off','normal','high')),
  quiet_hours_start         TEXT,
  quiet_hours_end           TEXT,
  notification_channels     TEXT NOT NULL DEFAULT '["web"]',
  memory_categories         TEXT NOT NULL DEFAULT '["perfil","notas","proyectos","aprendizajes"]',
  voice_enabled             INTEGER NOT NULL DEFAULT 0,
  ai_provider               TEXT,
  ai_model                  TEXT,
  ai_monthly_budget_cents   INTEGER NOT NULL DEFAULT 500,
  onboarded                 INTEGER NOT NULL DEFAULT 0,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  user_agent  TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  detail     TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);

-- ---------- Asistente: conversaciones y ejecuciones ----------

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Nueva conversación',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content         TEXT NOT NULL,
  tool_runs       TEXT,
  meta            TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS assistant_tool_runs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  tool_name       TEXT NOT NULL,
  risk_level      INTEGER NOT NULL CHECK (risk_level BETWEEN 1 AND 4),
  input           TEXT NOT NULL,
  output          TEXT,
  status          TEXT NOT NULL
                  CHECK (status IN ('success','error','denied','awaiting_approval','rejected')),
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_tool_runs_user ON assistant_tool_runs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS approvals (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_run_id  TEXT NOT NULL REFERENCES assistant_tool_runs(id) ON DELETE CASCADE,
  tool_name    TEXT NOT NULL,
  summary      TEXT NOT NULL,
  input        TEXT NOT NULL,
  risk_level   INTEGER NOT NULL CHECK (risk_level BETWEEN 1 AND 4),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected','expired')),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  decided_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_approvals_user_status ON approvals(user_id, status, requested_at DESC);

-- ---------- Memoria y segundo cerebro ----------

CREATE TABLE IF NOT EXISTS memories (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'notas'
             CHECK (category IN ('perfil','notas','proyectos','objetivos','referencia','aprendizajes','conversaciones')),
  source     TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user','assistant')),
  confirmed  INTEGER NOT NULL DEFAULT 0,
  tags       TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(user_id, category);

CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT 'idea'
             CHECK (category IN ('idea','reflexion','decision','aprendizaje','pendiente','referencia')),
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  pinned     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);

CREATE TABLE IF NOT EXISTS inbox_items (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content          TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('manual','assistant','whatsapp','email')),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','converted','discarded')),
  converted_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_items(user_id, status, created_at DESC);

-- ---------- Tareas y organización ----------

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'personal'
              CHECK (category IN ('personal','universidad','trabajo','negocio','salud','otro')),
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('planning','active','paused','done','archived')),
  goal        TEXT NOT NULL DEFAULT '',
  start_date  TEXT,
  due_date    TEXT,
  progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, status);

CREATE TABLE IF NOT EXISTS project_milestones (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  due_date   TEXT,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','done')),
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON project_milestones(project_id, position);

CREATE TABLE IF NOT EXISTS project_decisions (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_decisions_project ON project_decisions(project_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  category            TEXT NOT NULL DEFAULT 'general',
  priority            INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4), -- 1 crítica … 4 baja
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','in_progress','done','cancelled')),
  due_date            TEXT,
  due_time            TEXT,
  duration_minutes    INTEGER,
  project_id          TEXT REFERENCES projects(id) ON DELETE SET NULL,
  parent_task_id      TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  recurrence          TEXT,
  reminder_lead_minutes INTEGER,
  position            INTEGER NOT NULL DEFAULT 0,
  completed_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(user_id, due_date, due_time);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id <> depends_on_id)
);

CREATE TABLE IF NOT EXISTS task_activity (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_task_activity ON task_activity(task_id, created_at DESC);

-- ---------- Calendario, recordatorios y notificaciones ----------

CREATE TABLE IF NOT EXISTS calendar_events (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  starts_at   TEXT NOT NULL,
  ends_at     TEXT NOT NULL,
  all_day     INTEGER NOT NULL DEFAULT 0,
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  task_id     TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  recurrence  TEXT,
  color       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS idx_events_user_time ON calendar_events(user_id, starts_at);

CREATE TABLE IF NOT EXISTS reminders (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  message        TEXT NOT NULL DEFAULT '',
  remind_at      TEXT NOT NULL,
  timezone       TEXT NOT NULL DEFAULT 'America/Monterrey',
  lead_minutes   INTEGER NOT NULL DEFAULT 0,
  recurrence     TEXT,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','snoozed','sent','dismissed','cancelled')),
  snoozed_until  TEXT,
  channels       TEXT NOT NULL DEFAULT '["web"]',
  priority       INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4),
  related_type   TEXT,
  related_id     TEXT,
  last_sent_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id, remind_at);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_id   TEXT REFERENCES reminders(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL CHECK (channel IN ('web','email','whatsapp','voice')),
  priority      INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  scheduled_for TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','delivered','failed','skipped')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  dedupe_key    TEXT,
  delivered_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_dedupe ON notification_deliveries(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_pending ON notification_deliveries(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_deliveries_user ON notification_deliveries(user_id, created_at DESC);
