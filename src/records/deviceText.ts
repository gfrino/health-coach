import { MAX_TEXT_CHARS } from './documentText';

/**
 * Testo di PDF e foto letto SUL TELEFONO (iOS: PDFKit e riconoscimento del testo di Vision),
 * per l'AI del telefono che non sa aprire questi file. Nessun dato esce dal dispositivo.
 * `null` su Android, nelle build senza il modulo o se il file non contiene testo.
 */
export async function readTextOnDevice(file: {
  mimeType: string;
  fileName: string | null;
  data: Uint8Array;
}): Promise<string | null> {
  const isPdf = file.mimeType === 'application/pdf';
  if (!isPdf && !file.mimeType.startsWith('image/')) return null;
  /* eslint-disable @typescript-eslint/no-require-imports -- moduli nativi opzionali */
  const native = (require('file-preview') as typeof import('file-preview')).default;
  if (!native?.extractText) return null;
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const ext = isPdf ? 'pdf' : (file.mimeType.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
  const tmp = new File(Paths.cache, `ocr-${Date.now()}.${ext}`);
  try {
    tmp.create();
    tmp.write(file.data);
    const text = await native.extractText(tmp.uri);
    return text?.trim() ? text.trim().slice(0, MAX_TEXT_CHARS) : null;
  } catch {
    return null;
  } finally {
    try {
      if (tmp.exists) tmp.delete();
    } catch {
      // file temporaneo già rimosso
    }
  }
}
