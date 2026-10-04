import type { DocumentPart, ImagePart } from '@/ai/types';
import { getDb, labReportRepository } from '@/db';
import type { MessageAttachment } from '@/db/repositories/conversationRepository';
import { bytesToBase64 } from '@/lib/base64';

import { readTextOnDevice } from './deviceText';
import { extractDocumentText } from './documentText';

/** Lato lungo massimo delle foto inviate all'AI: leggibili, ma leggere da trasmettere. */
const MAX_IMAGE_SIDE = 1600;
/** Testo letto sul telefono sufficiente per non inviare il file intero all'AI. */
const MIN_DEVICE_TEXT = 200;
/** Oltre questa dimensione il PDF non viene inviato (limiti dei provider e memoria). */
const MAX_PDF_BYTES = 15 * 1024 * 1024;

export interface AttachmentContent {
  images: ImagePart[];
  documents: DocumentPart[];
  /** Testo estratto sul telefono (Word, ODT, RTF, TXT…). */
  texts: { name: string; text: string }[];
  /** File salvati ma non leggibili dal modello (formato o dimensione). */
  unreadable: string[];
}

async function resizeImage(mimeType: string, data: Uint8Array): Promise<ImagePart> {
  let mod: typeof import('expo-image-manipulator');
  try {
    // Caricato solo quando serve: nelle build precedenti il modulo nativo non c'è.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  } catch {
    // Senza ridimensionamento: si invia l'originale se è in un formato accettato ovunque.
    if (mimeType === 'image/jpeg' || mimeType === 'image/png')
      return { mimeType, base64: bytesToBase64(data) };
    throw new Error('image_manipulator_unavailable');
  }
  const { ImageManipulator, SaveFormat } = mod;
  const uri = `data:${mimeType};base64,${bytesToBase64(data)}`;
  const ctx = ImageManipulator.manipulate(uri);
  const probe = await ctx.renderAsync();
  const long = Math.max(probe.width, probe.height);
  const image =
    long > MAX_IMAGE_SIDE
      ? await ImageManipulator.manipulate(uri)
          .resize(
            probe.width >= probe.height ? { width: MAX_IMAGE_SIDE } : { height: MAX_IMAGE_SIDE },
          )
          .renderAsync()
      : probe;
  // JPEG sempre: HEIC/HEIF non sono accettati da tutti i provider.
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  return { mimeType: 'image/jpeg', base64: out.base64 ?? '' };
}

/** Il modello non sa aprire il file: si prova con il testo letto sul telefono. */
async function pushDeviceText(
  out: AttachmentContent,
  title: string,
  file: { mimeType: string; fileName: string | null; data: Uint8Array },
) {
  const text = await readTextOnDevice(file);
  if (text) out.texts.push({ name: title, text });
  else out.unreadable.push(title);
}

/**
 * Prepara gli allegati per il modello. `vision`/`pdf`: cosa sa leggere il modello in uso.
 * `preferText`: prima si legge il testo sul telefono (PDFKit, OCR di Vision) e, se basta, si invia
 * solo quello: più veloce e meno dati in uscita. Il file intero solo se il testo non c'è.
 * 'pdf' = solo per i PDF, 'all' = anche per le foto.
 */
export async function loadAttachmentContent(
  attachments: MessageAttachment[],
  caps: { vision: boolean; pdf: boolean; preferText?: 'pdf' | 'all' },
): Promise<AttachmentContent> {
  const db = await getDb();
  const out: AttachmentContent = { images: [], documents: [], texts: [], unreadable: [] };
  for (const a of attachments) {
    const file = await labReportRepository.getReportFile(db, a.reportId);
    if (!file) continue;
    try {
      const isPdf = file.mimeType === 'application/pdf';
      const isImage = file.mimeType.startsWith('image/');
      if ((isPdf && caps.preferText) || (isImage && caps.preferText === 'all')) {
        const text = await readTextOnDevice(file);
        if (text && text.length >= MIN_DEVICE_TEXT) {
          out.texts.push({ name: a.title, text });
          continue;
        }
      }
      if (isImage) {
        if (caps.vision) out.images.push(await resizeImage(file.mimeType, file.data));
        else await pushDeviceText(out, a.title, file);
      } else if (isPdf) {
        if (caps.pdf && file.data.byteLength <= MAX_PDF_BYTES) {
          out.documents.push({
            mimeType: 'application/pdf',
            base64: bytesToBase64(file.data),
            name: file.fileName ?? `${a.title}.pdf`,
          });
        } else await pushDeviceText(out, a.title, file);
      } else {
        const text = extractDocumentText(file.mimeType, file.data);
        if (text) out.texts.push({ name: a.title, text });
        else out.unreadable.push(a.title);
      }
    } catch {
      out.unreadable.push(a.title);
    }
  }
  return out;
}
