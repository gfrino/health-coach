import { migrations as defaultMigrations, type Migration } from './migrations';
import type { Db } from './types';

export async function getSchemaVersion(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  return row?.user_version ?? 0;
}

/**
 * Applica in ordine le migrazioni mancanti, ognuna nella propria transazione
 * insieme all'aggiornamento di user_version: o riesce tutta, o niente.
 * Restituisce la versione finale dello schema.
 */
export async function migrate(
  db: Db,
  migrations: readonly Migration[] = defaultMigrations,
): Promise<number> {
  assertContiguous(migrations);
  const current = await getSchemaVersion(db);
  const latest = migrations.at(-1)?.version ?? 0;
  if (current > latest) {
    throw new Error(
      `Schema del database (v${current}) più recente dell'app (v${latest}). Aggiorna l'app.`,
    );
  }

  for (const m of migrations) {
    if (m.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.up);
      // PRAGMA non accetta parametri: version è un intero validato da assertContiguous.
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
  }
  return getSchemaVersion(db);
}

function assertContiguous(migrations: readonly Migration[]) {
  migrations.forEach((m, i) => {
    if (!Number.isInteger(m.version) || m.version !== i + 1) {
      throw new Error(`Migrazione "${m.name}": versione ${m.version}, attesa ${i + 1}`);
    }
  });
}
