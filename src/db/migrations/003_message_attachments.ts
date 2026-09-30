import type { Migration } from './types';

/**
 * Allegati dei messaggi in chat: riferimenti ai file salvati nella Cartella salute
 * (JSON [{ reportId, title, mimeType }]). Il file resta nel DB cifrato, una sola volta.
 */
export const migration003: Migration = {
  version: 3,
  name: 'message_attachments',
  up: `ALTER TABLE messages ADD COLUMN attachments TEXT;`,
};
