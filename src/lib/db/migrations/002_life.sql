-- ============================================================================
-- E.V. — Migración 002: vida personal (objetivos, hábitos, salud, alimentación)
-- ============================================================================

CREATE TABLE IF NOT EXISTS goals (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  motivation         TEXT NOT NULL DEFAULT '',
  category           TEXT NOT NULL DEFAULT 'personal'
                     CHECK (category IN ('personal','salud','finanzas','trabajo','estudios','otro')),
  target_date        TEXT,
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','paused','done','cancelled')),
  progress           INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  indicators         TEXT,
  target_amount_cents INTEGER,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id, status);

CREATE TABLE IF NOT EXISTS goal_milestones (
  id         TEXT PRIMARY KEY,
  goal_id    TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  due_date   TEXT,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_goal_milestones ON goal_milestones(goal_id);

CREATE TABLE IF NOT EXISTS goal_progress_logs (
  id         TEXT PRIMARY KEY,
  goal_id    TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note       TEXT NOT NULL,
  progress   INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_goal_progress ON goal_progress_logs(goal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS habits (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'general',
  frequency       TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  target_per_week INTEGER NOT NULL DEFAULT 7 CHECK (target_per_week BETWEEN 1 AND 7),
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, active);

CREATE TABLE IF NOT EXISTS habit_logs (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date   TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 1,
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_logs_unique ON habit_logs(habit_id, log_date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user ON habit_logs(user_id, log_date);

-- ---------- Entrenamiento ----------

CREATE TABLE IF NOT EXISTS workouts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id, active);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id            TEXT PRIMARY KEY,
  workout_id    TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sets          INTEGER,
  reps          TEXT,
  weight        TEXT,
  rest_seconds  INTEGER,
  position      INTEGER NOT NULL DEFAULT 0,
  notes         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_workout_exercises ON workout_exercises(workout_id, position);

CREATE TABLE IF NOT EXISTS workout_logs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id   TEXT REFERENCES workouts(id) ON DELETE SET NULL,
  workout_name TEXT NOT NULL,
  performed_at TEXT NOT NULL,
  duration_minutes INTEGER,
  notes        TEXT NOT NULL DEFAULT '',
  entries      TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user ON workout_logs(user_id, performed_at DESC);

CREATE TABLE IF NOT EXISTS body_measurements (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measured_at  TEXT NOT NULL,
  weight_kg    REAL,
  waist_cm     REAL,
  chest_cm     REAL,
  arm_cm       REAL,
  hip_cm       REAL,
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_measurements_user ON body_measurements(user_id, measured_at DESC);

-- ---------- Alimentación ----------

CREATE TABLE IF NOT EXISTS recipes (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  ingredients  TEXT NOT NULL DEFAULT '[]',
  instructions TEXT NOT NULL DEFAULT '',
  prep_minutes INTEGER,
  servings     INTEGER,
  tags         TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS meals (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_date     TEXT NOT NULL,
  meal_type     TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  name          TEXT NOT NULL,
  notes         TEXT NOT NULL DEFAULT '',
  recipe_id     TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  quantity      TEXT,
  calories_estimate INTEGER,
  calories_is_estimate INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, meal_date);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user ON shopping_lists(user_id, status);

CREATE TABLE IF NOT EXISTS shopping_items (
  id           TEXT PRIMARY KEY,
  list_id      TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  quantity     TEXT NOT NULL DEFAULT '',
  checked      INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_shopping_items ON shopping_items(list_id, position);
