import type { Db } from '../types';

export interface SentNotification {
  id: string;
  kind: string;
  sentAt: number;
}

export async function recentNotifications(db: Db, sinceMs: number): Promise<SentNotification[]> {
  const rows = await db.getAllAsync<{ id: string; kind: string; sent_at: number }>(
    'SELECT id, kind, sent_at FROM notification_log WHERE sent_at >= ? ORDER BY sent_at DESC',
    [sinceMs],
  );
  return rows.map((r) => ({ id: r.id, kind: r.kind, sentAt: r.sent_at }));
}

export async function logNotification(db: Db, n: SentNotification): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO notification_log (id, kind, sent_at) VALUES (?, ?, ?)', [
    n.id,
    n.kind,
    n.sentAt,
  ]);
}
