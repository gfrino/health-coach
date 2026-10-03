import type { Migration } from './types';

/**
 * Programmi creati dal coach o dall'utente (azioni da spuntare) e check-in quotidiani
 * preparati dal coach (analisi del mattino collegata alla notifica).
 */
export const migration005: Migration = {
  version: 5,
  name: 'programs',
  up: `CREATE TABLE programs (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  goal TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'active',
  start_day TEXT NOT NULL,
  duration_days INTEGER,
  source TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_programs_status ON programs (status, updated_at);
CREATE TABLE program_items (
  id TEXT PRIMARY KEY NOT NULL,
  program_id TEXT NOT NULL REFERENCES programs (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  details TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily',
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_program_items_program ON program_items (program_id, position);
CREATE TABLE program_checks (
  item_id TEXT NOT NULL REFERENCES program_items (id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  done_at INTEGER NOT NULL,
  PRIMARY KEY (item_id, day)
);
CREATE TABLE daily_checkins (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT REFERENCES conversations (id) ON DELETE SET NULL,
  summary TEXT,
  created_at INTEGER NOT NULL
);`,
};
