import { SSEParser } from '../sse';

describe('SSEParser', () => {
  it('ricompone eventi spezzati in chunk arbitrari', () => {
    const p = new SSEParser();
    const input =
      'event: message_start\ndata: {"a":1}\n\ndata: {"b":\ndata: 2}\n\n: commento\ndata: [DONE]\n\n';
    const events = [...input].flatMap((ch) => p.push(ch));
    expect(events).toEqual([
      { event: 'message_start', data: '{"a":1}' },
      { event: undefined, data: '{"b":\n2}' },
      { event: undefined, data: '[DONE]' },
    ]);
  });

  it('gestisce CRLF e un evento finale senza riga vuota', () => {
    const p = new SSEParser();
    expect(p.push('data: x\r\n\r\ndata: y')).toEqual([{ event: undefined, data: 'x' }]);
    expect(p.flush()).toEqual([{ event: undefined, data: 'y' }]);
  });
});
