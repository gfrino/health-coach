import { getDefaultSettings } from '@/config/settingsSchema';
import { createTestDb } from '@/test/nodeSqliteDb';

import { migrate } from '../migrate';
import { loadSettings, saveSettings } from '../repositories/settingsRepository';

async function setup() {
  const db = createTestDb();
  await migrate(db);
  return db;
}

describe('settingsRepository', () => {
  it('restituisce i default quando non ci sono righe', async () => {
    const db = await setup();
    expect(await loadSettings(db, 'CH')).toEqual(getDefaultSettings('CH'));
  });

  it('salva e ricarica le impostazioni', async () => {
    const db = await setup();
    await saveSettings(db, { theme: 'dark', language: 'de', onboardingStep: 3 });
    const s = await loadSettings(db, 'CH');
    expect(s.theme).toBe('dark');
    expect(s.language).toBe('de');
    expect(s.onboardingStep).toBe(3);
  });

  it('sovrascrive un valore esistente', async () => {
    const db = await setup();
    await saveSettings(db, { theme: 'dark' });
    await saveSettings(db, { theme: 'light' });
    expect((await loadSettings(db)).theme).toBe('light');
  });

  it('ignora valori corrotti e chiavi sconosciute', async () => {
    const db = await setup();
    await db.runAsync(
      "INSERT INTO settings (key, value, updated_at) VALUES ('theme', '\"purple\"', 0)",
      [],
    );
    await db.runAsync(
      "INSERT INTO settings (key, value, updated_at) VALUES ('language', 'not json', 0)",
      [],
    );
    await db.runAsync(
      "INSERT INTO settings (key, value, updated_at) VALUES ('legacy', '1', 0)",
      [],
    );
    const s = await loadSettings(db);
    expect(s.theme).toBe('system');
    expect(s.language).toBe('system');
    expect(s).not.toHaveProperty('legacy');
  });

  it('rifiuta di salvare valori non validi', async () => {
    const db = await setup();
    // @ts-expect-error valore volutamente non valido
    await expect(saveSettings(db, { theme: 'purple' })).rejects.toThrow();
  });
});
