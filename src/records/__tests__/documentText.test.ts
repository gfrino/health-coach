import { strToU8, zipSync } from 'fflate';

import { docxXmlToText, extractDocumentText, rtfToText } from '../documentText';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('estrazione testo dai documenti', () => {
  it('legge un .docx (paragrafi, tabulazioni, entità)', () => {
    const xml =
      '<w:document><w:body><w:p><w:r><w:t>Emocromo</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Emoglobina</w:t></w:r><w:r><w:tab/><w:t>14,2 g/dL &amp; ok</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const data = zipSync({
      'word/document.xml': strToU8(xml),
      '[Content_Types].xml': strToU8('x'),
    });
    expect(extractDocumentText(DOCX, data)).toBe('Emocromo\nEmoglobina\t14,2 g/dL & ok');
  });

  it('legge un .odt', () => {
    const xml =
      '<office:text><text:h>Referto</text:h><text:p>Glicemia 92 mg/dL</text:p></office:text>';
    const data = zipSync({ 'content.xml': strToU8(xml) });
    expect(extractDocumentText('application/vnd.oasis.opendocument.text', data)).toBe(
      'Referto\nGlicemia 92 mg/dL',
    );
  });

  it('RTF e testo semplice', () => {
    expect(rtfToText('{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\f0 Colesterolo\\par LDL 110}')).toBe(
      'Colesterolo\nLDL 110',
    );
    expect(extractDocumentText('text/plain', strToU8('  ferritina 30  '))).toBe('ferritina 30');
  });

  it('i formati non leggibili restituiscono null', () => {
    expect(extractDocumentText('application/msword', new Uint8Array([1, 2, 3]))).toBeNull();
    expect(docxXmlToText('<w:p></w:p>')).toBe('');
  });
});
