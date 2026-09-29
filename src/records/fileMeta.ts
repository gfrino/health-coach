/** File in arrivo (da fotocamera, galleria, documenti o condivisione da un'altra app). */
export interface IncomingFile {
  uri: string;
  mimeType: string | null;
  fileName: string | null;
}

export const ACCEPTED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
];

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
};

export function guessMime(f: IncomingFile): string | null {
  if (f.mimeType && f.mimeType !== 'application/octet-stream') return f.mimeType;
  const ext = (f.fileName ?? f.uri).split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? null;
}

/** Titolo dal nome del file, se significativo (non "IMG_1234"). */
export function titleFromFileName(fileName: string | null): string {
  const base = fileName
    ?.replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!base || /^(img|image|photo|scan|document|file)\s?\d*$/i.test(base)) return '';
  return base;
}
