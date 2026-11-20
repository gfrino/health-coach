import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { getDb, labReportRepository } from '@/db';
import { base64ToBytes } from '@/lib/base64';
import { localIsoDate } from '@/lib/dates';

import { ACCEPTED_MIME, guessMime, titleFromFileName, type IncomingFile } from './fileMeta';

export type { IncomingFile };

/** Legge i file e li salva nel DB cifrato. Restituisce gli id dei referti creati. */
export async function importFiles(files: IncomingFile[], fallbackTitle: string): Promise<string[]> {
  const db = await getDb();
  const ids: string[] = [];
  for (const f of files) {
    const mime = guessMime(f);
    if (!mime || !ACCEPTED_MIME.includes(mime)) throw new Error('unsupported_type');
    const file = new File(f.uri);
    const data = new Uint8Array(await file.arrayBuffer());
    ids.push(
      await labReportRepository.createReport(db, {
        title: titleFromFileName(f.fileName) || fallbackTitle,
        reportDate: localIsoDate(new Date()),
        mimeType: mime,
        fileName: f.fileName,
        data,
      }),
    );
    // La copia temporanea non serve più: ora il file è cifrato nel DB.
    try {
      file.delete();
    } catch {
      // file non eliminabile (fornito dal sistema): ignorato
    }
  }
  // Il coach legge subito i nuovi referti (valori e riassunto), in background.
  if (ids.length) {
    /* eslint-disable @typescript-eslint/no-require-imports -- evita cicli di import */
    const { extractReport } = require('./labExtraction') as typeof import('./labExtraction');
    const { useSettingsStore } =
      require('@/store/settingsStore') as typeof import('@/store/settingsStore');
    /* eslint-enable @typescript-eslint/no-require-imports */
    void (async () => {
      for (const id of ids) await extractReport(useSettingsStore.getState().settings, id);
    })();
  }
  return ids;
}

export async function pickFromCamera(): Promise<IncomingFile[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('permission_denied');
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  return res.canceled
    ? []
    : res.assets.map((a) => ({
        uri: a.uri,
        mimeType: a.mimeType ?? 'image/jpeg',
        fileName: a.fileName ?? null,
      }));
}

export async function pickFromLibrary(): Promise<IncomingFile[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: 10,
  });
  return res.canceled
    ? []
    : res.assets.map((a) => ({
        uri: a.uri,
        mimeType: a.mimeType ?? 'image/jpeg',
        fileName: a.fileName ?? null,
      }));
}

/** C'è un'immagine copiata negli appunti? (Non mostra l'avviso "incolla" di iOS.) */
export async function clipboardHasImage(): Promise<boolean> {
  try {
    return await Clipboard.hasImageAsync();
  } catch {
    return false;
  }
}

/**
 * Foto copiata (es. "Copia" in Foto o uno screenshot): diventa un file temporaneo JPEG, poi entra
 * nella Cartella salute come le altre. iOS può chiedere il permesso di incollare: se l'utente
 * rifiuta non arriva niente.
 */
export async function pasteImageFromClipboard(): Promise<IncomingFile[]> {
  const img = await Clipboard.getImageAsync({ format: 'jpeg', jpegQuality: 0.85 });
  // C'era un'immagine ma iOS non l'ha data: permesso di incollare negato.
  if (!img?.data) throw new Error('paste_denied');
  return [imageFileFromData(img.data)];
}

/** Immagine già letta (data URI JPEG, es. dal pulsante "Incolla" di Apple) → file temporaneo. */
export function imageFileFromData(dataUri: string): IncomingFile {
  const file = new File(Paths.cache, `incollata-${Date.now()}.jpg`);
  file.write(base64ToBytes(dataUri));
  return { uri: file.uri, mimeType: 'image/jpeg', fileName: null };
}

export async function pickDocument(): Promise<IncomingFile[]> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ACCEPTED_MIME,
    multiple: true,
    copyToCacheDirectory: true,
  });
  return res.canceled
    ? []
    : res.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? null, fileName: a.name }));
}
