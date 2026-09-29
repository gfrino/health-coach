import type { Db } from '../types';

/** Integrazioni per cui l'utente ha chiesto "Avvisami". Solo locale; l'invio al backend (con consenso) arriva in Fase 8. */
export async function listInterests(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ integration_id: string }>(
    'SELECT integration_id FROM integration_interest ORDER BY created_at',
    [],
  );
  return rows.map((r) => r.integration_id);
}

export async function setInterest(
  db: Db,
  integrationId: string,
  interested: boolean,
): Promise<void> {
  if (interested) {
    await db.runAsync(
      'INSERT INTO integration_interest (integration_id, created_at) VALUES (?, ?) ON CONFLICT (integration_id) DO NOTHING',
      [integrationId, Date.now()],
    );
  } else {
    await db.runAsync('DELETE FROM integration_interest WHERE integration_id = ?', [integrationId]);
  }
}
