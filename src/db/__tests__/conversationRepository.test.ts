import { migrate } from '../migrate';
import * as conversations from '../repositories/conversationRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

let mockSeq = 0;
jest.mock('../ids', () => ({ newId: () => `id-${++mockSeq}` }));

describe('messaggi con allegati', () => {
  it('salva e rilegge gli allegati', async () => {
    const db = createTestDb();
    await migrate(db);
    const conv = await conversations.createConversation(db, { provider: 'openai', model: 'm' });
    const attachment = { reportId: 'r1', title: 'Esami', mimeType: 'application/pdf' };
    await conversations.addMessage(db, {
      conversationId: conv,
      role: 'user',
      content: '',
      attachments: [attachment],
    });
    await conversations.addMessage(db, { conversationId: conv, role: 'assistant', content: 'Ok' });
    const list = await conversations.listMessages(db, conv);
    expect(list[0]?.attachments).toEqual([attachment]);
    expect(list[1]?.attachments).toEqual([]);
  });
});
