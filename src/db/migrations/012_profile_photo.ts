import type { Migration } from './types';

/** Foto del profilo (JPEG piccolo), nel DB cifrato come gli altri dati personali. */
export const migration012: Migration = {
  version: 12,
  name: 'profile_photo',
  up: `ALTER TABLE profile ADD COLUMN photo BLOB;`,
};
