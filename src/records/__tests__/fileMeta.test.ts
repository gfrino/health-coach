import { guessMime, titleFromFileName } from '../fileMeta';

describe('fileMeta', () => {
  it("ricava il tipo dal mime o dall'estensione", () => {
    expect(guessMime({ uri: 'file:///x/esami.PDF', mimeType: null, fileName: null })).toBe(
      'application/pdf',
    );
    expect(guessMime({ uri: 'file:///x/a', mimeType: 'image/png', fileName: null })).toBe(
      'image/png',
    );
    expect(
      guessMime({ uri: 'file:///x/a', mimeType: 'application/octet-stream', fileName: 'r.jpg' }),
    ).toBe('image/jpeg');
    expect(guessMime({ uri: 'file:///x/a.docx', mimeType: null, fileName: null })).toBeNull();
  });

  it('usa il nome del file come titolo solo se significativo', () => {
    expect(titleFromFileName('Esami_sangue-2026.pdf')).toBe('Esami sangue 2026');
    expect(titleFromFileName('IMG_1234.jpg')).toBe('');
    expect(titleFromFileName(null)).toBe('');
  });
});
