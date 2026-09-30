import { strFromU8, unzipSync } from 'fflate';

/**
 * Estrazione del testo dai documenti sul telefono (nessun servizio esterno):
 * Word .docx e OpenDocument .odt sono archivi zip con XML; RTF e testo semplice
 * si leggono direttamente. Il vecchio .doc binario non è leggibile: resta solo salvato.
 */

export const MAX_TEXT_CHARS = 60_000;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

const tidy = (s: string) =>
  s
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** document.xml di Word: paragrafi <w:p>, tabulazioni <w:tab/>, a capo <w:br/>. */
export function docxXmlToText(xml: string): string {
  return tidy(
    decodeXmlEntities(
      xml
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<w:br[^>]*\/>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<\/w:tc>/g, '\t')
        .replace(/<[^>]+>/g, ''),
    ),
  );
}

/** content.xml di OpenDocument: paragrafi <text:p> e titoli <text:h>. */
export function odtXmlToText(xml: string): string {
  return tidy(
    decodeXmlEntities(
      xml
        .replace(/<text:tab\/>/g, '\t')
        .replace(/<text:line-break\/>/g, '\n')
        .replace(/<\/text:(p|h)>/g, '\n')
        .replace(/<[^>]+>/g, ''),
    ),
  );
}

/** RTF → testo (approssimato: gruppi di controllo rimossi, \par come a capo). */
export function rtfToText(rtf: string): string {
  return tidy(
    rtf
      .replace(/\\'([0-9a-f]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\u(-?\d+)\??/g, (_, n: string) => String.fromCharCode((Number(n) + 65536) % 65536))
      .replace(/\{\\\*[^{}]*\}/g, '')
      .replace(/\{\\(fonttbl|colortbl|stylesheet|info)[\s\S]*?\}\s*\}/g, '')
      .replace(/\\(par|line)\b ?/g, '\n')
      .replace(/\\tab\b ?/g, '\t')
      .replace(/\\[a-z]+-?\d* ?/gi, '')
      .replace(/[{}]/g, ''),
  );
}

/** Testo del documento, o null se il formato non si può leggere sul telefono. */
export function extractDocumentText(mimeType: string, data: Uint8Array): string | null {
  let text: string | null = null;
  switch (mimeType) {
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      const files = unzipSync(data, { filter: (f) => f.name === 'word/document.xml' });
      const xml = files['word/document.xml'];
      text = xml ? docxXmlToText(strFromU8(xml)) : null;
      break;
    }
    case 'application/vnd.oasis.opendocument.text': {
      const files = unzipSync(data, { filter: (f) => f.name === 'content.xml' });
      const xml = files['content.xml'];
      text = xml ? odtXmlToText(strFromU8(xml)) : null;
      break;
    }
    case 'application/rtf':
      text = rtfToText(strFromU8(data, true));
      break;
    case 'text/plain':
    case 'text/markdown':
    case 'text/csv':
      text = strFromU8(data).trim();
      break;
    default:
      return null;
  }
  if (!text) return null;
  return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n[…]` : text;
}
