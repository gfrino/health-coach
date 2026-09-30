import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { getDb, labReportRepository } from '@/db';
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
