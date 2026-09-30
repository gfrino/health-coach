import type { Migration } from './types';

/** Notifiche proattive inviate: per non ripeterle e rispettare il limite giornaliero. */
export const migration004: Migration = {
  version: 4,
  name: 'notification_log',
  up: `CREATE TABLE notification_log (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  sent_at INTEGER NOT NULL
);
CREATE INDEX idx_notification_log_sent ON notification_log (sent_at);`,
};
