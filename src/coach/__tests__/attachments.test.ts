import { attachmentNote } from '../chatEngine';

jest.mock('@/records/attachmentContent', () => ({ loadAttachmentContent: jest.fn() }));
jest.mock('@/db', () => ({}));

describe('attachmentNote', () => {
  it('descrive gli allegati per la cronologia', () => {
    expect(
      attachmentNote([
        { reportId: '1', title: 'Esami del sangue', mimeType: 'application/pdf' },
        { reportId: '2', title: 'Foto', mimeType: 'image/jpeg' },
      ]),
    ).toBe("[Attached: Esami del sangue, Foto — saved in the user's health records]");
    expect(attachmentNote([])).toBe('');
  });
});
