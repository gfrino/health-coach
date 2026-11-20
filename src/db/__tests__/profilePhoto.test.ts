import { migrate } from '@/db/migrate';
import * as profileRepository from '@/db/repositories/profileRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

describe('foto del profilo', () => {
  it('si salva anche senza profilo, non tocca gli altri dati e si toglie', async () => {
    const db = createTestDb();
    await migrate(db);
    expect(await profileRepository.getPhoto(db)).toBeNull();

    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    await profileRepository.setPhoto(db, jpeg);
    expect(Array.from((await profileRepository.getPhoto(db))!)).toEqual(Array.from(jpeg));

    await profileRepository.saveProfile(db, { sex: 'female', heightCm: 168 } as never);
    expect(await profileRepository.getPhoto(db)).not.toBeNull();
    expect((await profileRepository.getProfile(db)).heightCm).toBe(168);

    await profileRepository.setPhoto(db, null);
    expect(await profileRepository.getPhoto(db)).toBeNull();
    expect((await profileRepository.getProfile(db)).sex).toBe('female');
  });
});
