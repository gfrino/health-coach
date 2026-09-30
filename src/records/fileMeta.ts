/** File in arrivo (da fotocamera, galleria, documenti o condivisione da un'altra app). */
export interface IncomingFile {
  uri: string;
  mimeType: string | null;
  fileName: string | null;
}

export type FileKind = 'pdf' | 'image' | 'document' | 'text';

interface FileType {
  mime: string;
  ext: string[];
  /** Uniform Type Identifier iOS (anteprima/condivisione). */
  uti: string;
  kind: FileKind;
}

/** Tipi di documento accettati (Cartella salute, condivisione da altre app, selettore file). */
export const FILE_TYPES: FileType[] = [
  { mime: 'application/pdf', ext: ['pdf'], uti: 'com.adobe.pdf', kind: 'pdf' },
  { mime: 'image/jpeg', ext: ['jpg', 'jpeg'], uti: 'public.jpeg', kind: 'image' },
  { mime: 'image/png', ext: ['png'], uti: 'public.png', kind: 'image' },
  { mime: 'image/heic', ext: ['heic'], uti: 'public.heic', kind: 'image' },
  { mime: 'image/heif', ext: ['heif'], uti: 'public.heif', kind: 'image' },
  { mime: 'image/webp', ext: ['webp'], uti: 'org.webmproject.webp', kind: 'image' },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: ['docx'],
    uti: 'org.openxmlformats.wordprocessingml.document',
    kind: 'document',
  },
  { mime: 'application/msword', ext: ['doc'], uti: 'com.microsoft.word.doc', kind: 'document' },
  {
    mime: 'application/vnd.oasis.opendocument.text',
    ext: ['odt'],
    uti: 'org.oasis-open.opendocument.text',
    kind: 'document',
  },
  { mime: 'application/rtf', ext: ['rtf'], uti: 'public.rtf', kind: 'document' },
  { mime: 'text/plain', ext: ['txt'], uti: 'public.plain-text', kind: 'text' },
  { mime: 'text/markdown', ext: ['md'], uti: 'net.daringfireball.markdown', kind: 'text' },
  { mime: 'text/csv', ext: ['csv'], uti: 'public.comma-separated-values-text', kind: 'text' },
];

/** Sinonimi usati da alcune app. */
const MIME_ALIASES: Record<string, string> = {
  'text/rtf': 'application/rtf',
  'image/jpg': 'image/jpeg',
  'text/x-markdown': 'text/markdown',
  'application/x-pdf': 'application/pdf',
};

export const ACCEPTED_MIME = FILE_TYPES.map((t) => t.mime);

export function fileTypeOf(mime: string | null | undefined): FileType | undefined {
  return FILE_TYPES.find((t) => t.mime === mime);
}

export function guessMime(f: IncomingFile): string | null {
  const declared = f.mimeType?.toLowerCase().split(';')[0]?.trim();
  const normalized = declared ? (MIME_ALIASES[declared] ?? declared) : null;
  if (normalized && fileTypeOf(normalized)) return normalized;
  const ext = (f.fileName ?? f.uri).split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
  return FILE_TYPES.find((t) => t.ext.includes(ext))?.mime ?? null;
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
