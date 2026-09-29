import type { Migration } from './types';

/**
 * Schema iniziale.
 * Convenzioni:
 * - id TEXT (UUID generato sul dispositivo)
 * - timestamp INTEGER in millisecondi epoch UTC (range query veloci e senza ambiguità di fuso)
 * - colonne JSON come TEXT
 * - `source` generico (es. "apple_health", "health_connect", "manual", "withings"…) e
 *   UNIQUE(source, source_id) per la deduplicazione durante le sincronizzazioni incrementali.
 */
export const migration001: Migration = {
  version: 1,
  name: 'initial_schema',
  up: `
CREATE TABLE metrics (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (source, source_id)
);
CREATE INDEX idx_metrics_type_start ON metrics (type, start_at);

CREATE TABLE workouts (
  id TEXT PRIMARY KEY NOT NULL,
  activity_type TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  duration_s REAL,
  energy_kcal REAL,
  distance_m REAL,
  avg_hr REAL,
  max_hr REAL,
  source TEXT NOT NULL,
  source_id TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (source, source_id)
);
CREATE INDEX idx_workouts_start ON workouts (start_at);

CREATE TABLE sleep_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  in_bed_s REAL,
  asleep_s REAL,
  stages TEXT,
  source TEXT NOT NULL,
  source_id TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (source, source_id)
);
CREATE INDEX idx_sleep_start ON sleep_sessions (start_at);

CREATE TABLE nutrition_entries (
  id TEXT PRIMARY KEY NOT NULL,
  consumed_at INTEGER NOT NULL,
  meal_type TEXT,
  name TEXT,
  energy_kcal REAL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  fiber_g REAL,
  sugar_g REAL,
  water_ml REAL,
  caffeine_mg REAL,
  source TEXT NOT NULL,
  source_id TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  UNIQUE (source, source_id)
);
CREATE INDEX idx_nutrition_consumed ON nutrition_entries (consumed_at);

CREATE TABLE profile (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  sex TEXT,
  birth_date TEXT,
  height_cm REAL,
  weight_kg REAL,
  goals TEXT,
  notes TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE conditions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  diagnosed_at TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE medications (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'medication' CHECK (kind IN ('medication', 'supplement')),
  dosage TEXT,
  frequency TEXT,
  started_at TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE allergies (
  id TEXT PRIMARY KEY NOT NULL,
  substance TEXT NOT NULL,
  reaction TEXT,
  severity TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE lab_reports (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  report_date TEXT,
  lab_name TEXT,
  notes TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'none'
    CHECK (extraction_status IN ('none', 'pending', 'extracted', 'confirmed', 'failed')),
  created_at INTEGER NOT NULL
);

-- Il file originale vive dentro il DB cifrato (SQLCipher): nessun file in chiaro su disco.
CREATE TABLE lab_report_files (
  report_id TEXT PRIMARY KEY NOT NULL REFERENCES lab_reports (id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  file_name TEXT,
  size_bytes INTEGER NOT NULL,
  data BLOB NOT NULL
);

CREATE TABLE lab_results (
  id TEXT PRIMARY KEY NOT NULL,
  report_id TEXT REFERENCES lab_reports (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  value REAL,
  value_text TEXT,
  unit TEXT,
  ref_low REAL,
  ref_high REAL,
  ref_text TEXT,
  measured_at TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_lab_results_name_date ON lab_results (normalized_name, measured_at);

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  entry_at INTEGER NOT NULL,
  text TEXT,
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  symptoms TEXT,
  tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_journal_entry_at ON journal_entries (entry_at);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT,
  kind TEXT NOT NULL DEFAULT 'chat',
  provider TEXT,
  model TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_conversations_updated ON conversations (updated_at);

CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content TEXT NOT NULL,
  tool_calls TEXT,
  tool_call_id TEXT,
  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'streaming', 'error')),
  error_code TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);

CREATE TABLE memory_facts (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  category TEXT,
  source_conversation_id TEXT REFERENCES conversations (id) ON DELETE SET NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE conversation_summaries (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  up_to_message_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_summaries_conversation ON conversation_summaries (conversation_id, created_at);

CREATE TABLE settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE entitlements (
  product_id TEXT PRIMARY KEY NOT NULL,
  integration_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'pending')),
  platform TEXT,
  transaction_id TEXT,
  purchased_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sync_state (
  source TEXT NOT NULL,
  data_type TEXT NOT NULL,
  anchor TEXT,
  last_synced_at INTEGER,
  last_error TEXT,
  PRIMARY KEY (source, data_type)
);

CREATE TABLE integration_interest (
  integration_id TEXT PRIMARY KEY NOT NULL,
  notify_remote INTEGER NOT NULL DEFAULT 0,
  remote_registered_at INTEGER,
  created_at INTEGER NOT NULL
);
`,
};
