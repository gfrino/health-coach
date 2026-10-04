import { loadAttachmentContent } from '../attachmentContent';
import { readTextOnDevice } from '../deviceText';

const mockFiles: Record<string, { mimeType: string; fileName: string | null; data: Uint8Array }> = {
  pdf: { mimeType: 'application/pdf', fileName: 'esami.pdf', data: new Uint8Array([1, 2, 3]) },
};

jest.mock('@/db', () => ({
  getDb: jest.fn(async () => ({})),
  labReportRepository: { getReportFile: jest.fn(async (_db: unknown, id: string) => mockFiles[id]) },
}));
jest.mock('../deviceText', () => ({ readTextOnDevice: jest.fn() }));

const deviceText = readTextOnDevice as jest.Mock;
const pdf = [{ reportId: 'pdf', title: 'Esami', mimeType: 'application/pdf' }];
const caps = { vision: true, pdf: true };

describe('loadAttachmentContent', () => {
  beforeEach(() => deviceText.mockReset());

  it('con preferText invia il testo letto sul telefono invece del PDF', async () => {
    deviceText.mockResolvedValue('Emoglobina 14.2 g/dL 13.0 – 17.0\n'.repeat(10));
    const out = await loadAttachmentContent(pdf, { ...caps, preferText: 'pdf' });
    expect(out.texts).toHaveLength(1);
    expect(out.documents).toHaveLength(0);
  });

  it('se il testo sul telefono è troppo poco (es. scansione) invia il PDF', async () => {
    deviceText.mockResolvedValue('Pagina 1');
    const out = await loadAttachmentContent(pdf, { ...caps, preferText: 'pdf' });
    expect(out.texts).toHaveLength(0);
    expect(out.documents).toHaveLength(1);
  });

  it('senza preferText il PDF va al modello così com’è', async () => {
    const out = await loadAttachmentContent(pdf, caps);
    expect(deviceText).not.toHaveBeenCalled();
    expect(out.documents).toHaveLength(1);
  });
});
