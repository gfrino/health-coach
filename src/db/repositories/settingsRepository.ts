import {
  getDefaultSettings,
  settingsShape,
  type AppSettings,
  type SettingKey,
} from '@/config/settingsSchema';

import type { Db } from '../types';

interface SettingRow {
  key: string;
  value: string;
}

/**
 * Carica le impostazioni: ogni chiave viene validata singolarmente con Zod;
 * valori mancanti, corrotti o di versioni precedenti ricadono sul default.
 */
export async function loadSettings(db: Db, region?: string | null): Promise<AppSettings> {
  const rows = await db.getAllAsync<SettingRow>('SELECT key, value FROM settings', []);
  const settings: Record<string, unknown> = { ...getDefaultSettings(region) };

  for (const row of rows) {
    if (!(row.key in settingsShape)) continue;
    const schema = settingsShape[row.key as SettingKey];
    const parsed = schema.safeParse(safeJsonParse(row.value));
    if (parsed.success) settings[row.key] = parsed.data;
  }
  return settings as AppSettings;
}

export async function saveSettings(db: Db, patch: Partial<AppSettings>): Promise<void> {
  const entries = Object.entries(patch) as [SettingKey, unknown][];
  if (entries.length === 0) return;

  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const [key, value] of entries) {
      const validated = settingsShape[key].parse(value);
      await db.runAsync(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, JSON.stringify(validated), now],
      );
    }
  });
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
