import { migrate } from '@/db/migrate';
import * as healthDataRepository from '@/db/repositories/healthDataRepository';
import * as profileRepository from '@/db/repositories/profileRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

import { latestBody, recordManualBody, syncProfileBody } from '../body';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `b-${++mockSeq}` }));
jest.mock('@/db', () => ({
  healthDataRepository: jest.requireActual('@/db/repositories/healthDataRepository'),
  profileRepository: jest.requireActual('@/db/repositories/profileRepository'),
}));

describe('peso e altezza del profilo', () => {
  it("seguono l'ultima misura, da Apple Salute o scritta a mano", async () => {
    const db = createTestDb();
    await migrate(db);
    await profileRepository.saveProfile(db, { weightKg: 80, heightCm: 176 });
    expect(await syncProfileBody(db)).toBe(false);

    // Pesata arrivata da Apple Salute: il profilo si aggiorna.
    await healthDataRepository.upsertMetrics(db, [
      {
        type: 'weight',
        value: 77.04,
        unit: 'kg',
        startAt: Date.parse('2026-11-18T07:00:00'),
        endAt: Date.parse('2026-11-18T07:00:00'),
        source: 'apple_health',
        sourceId: 'hk-w',
      },
    ]);
    expect(await syncProfileBody(db)).toBe(true);
    expect((await profileRepository.getProfile(db)).weightKg).toBe(77);
    expect((await profileRepository.getProfile(db)).heightCm).toBe(176);

    // Peso scritto a mano dopo: diventa l'ultima misura.
    await recordManualBody(db, 'weight', 76.5, Date.parse('2026-11-20T09:00:00'));
    expect(await latestBody(db, 'weight')).toMatchObject({ value: 76.5, source: 'manual' });
    await syncProfileBody(db);
    expect((await profileRepository.getProfile(db)).weightKg).toBe(76.5);
  });
});
