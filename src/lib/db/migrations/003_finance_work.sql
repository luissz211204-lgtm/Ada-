-- ============================================================================
-- E.V. — Migración 003: finanzas personales y trabajo/negocio
-- Los importes se guardan en centavos (INTEGER) para evitar errores flotantes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  currency      TEXT NOT NULL DEFAULT 'MXN',
  category      TEXT NOT NULL DEFAULT 'general',
  description   TEXT NOT NULL DEFAULT '',
  txn_date      TEXT NOT NULL,
  debt_id       TEXT REFERENCES debts(id) ON DELETE SET NULL,
  project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
  is_business   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_month ON transactions(user_id, txn_date, type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(user_id, category);

CREATE TABLE IF NOT EXISTS budgets (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  month         TEXT NOT NULL, -- 'YYYY-MM'
  amount_cents  INTEGER NOT NULL CHECK (amount_cents >= 0),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_unique ON budgets(user_id, category, month);

CREATE TABLE IF NOT EXISTS debts (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  creditor        TEXT NOT NULL DEFAULT '',
  total_cents     INTEGER NOT NULL CHECK (total_cents > 0),
  remaining_cents INTEGER NOT NULL CHECK (remaining_cents >= 0),
  due_day         INTEGER CHECK (due_day BETWEEN 1 AND 31),
  interest_notes  TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_debts_user ON debts(user_id, status);

CREATE TABLE IF NOT EXISTS savings_goals (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  target_cents    INTEGER NOT NULL CHECK (target_cents > 0),
  saved_cents     INTEGER NOT NULL DEFAULT 0 CHECK (saved_cents >= 0),
  target_date     TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','cancelled')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_savings_user ON savings_goals(user_id, status);

-- ---------- Trabajo y negocio (aislado con is_business / categorías) ----------

CREATE TABLE IF NOT EXISTS clients (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS work_orders (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id      TEXT REFERENCES clients(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('quoted','accepted','in_progress','delivered','cancelled')),
  quote_cents    INTEGER,
  due_date       TEXT,
  delivered_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_work_orders_user ON work_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_client ON work_orders(client_id);

CREATE TABLE IF NOT EXISTS work_order_items (
  id            TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  quantity      TEXT NOT NULL DEFAULT '',
  unit_price_cents INTEGER,
  position      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_work_order_items ON work_order_items(work_order_id, position);

CREATE TABLE IF NOT EXISTS inventory_items (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  quantity      REAL NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT 'pz',
  min_quantity  REAL NOT NULL DEFAULT 0,
  notes         TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory_items(user_id, name);
