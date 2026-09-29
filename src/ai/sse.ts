export interface SSEEvent {
  event?: string;
  data: string;
}

/**
 * Parser incrementale di Server-Sent Events: riceve testo a pezzi arbitrari
 * e restituisce gli eventi completi (separati da riga vuota).
 */
export class SSEParser {
  private buffer = '';

  push(chunk: string): SSEEvent[] {
    this.buffer += chunk.replace(/\r\n?/g, '\n');
    const events: SSEEvent[] = [];
    let idx: number;
    while ((idx = this.buffer.indexOf('\n\n')) !== -1) {
      const raw = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      const ev = parseBlock(raw);
      if (ev) events.push(ev);
    }
    return events;
  }

  /** Eventuale evento finale senza riga vuota di chiusura. */
  flush(): SSEEvent[] {
    const rest = this.buffer;
    this.buffer = '';
    const ev = parseBlock(rest);
    return ev ? [ev] : [];
  }
}

function parseBlock(block: string): SSEEvent | null {
  let event: string | undefined;
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  if (data.length === 0) return null;
  return { event, data: data.join('\n') };
}

/** Legge una risposta in streaming e produce gli eventi SSE. */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SSEParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const ev of parser.push(decoder.decode(value, { stream: true }))) yield ev;
    }
    for (const ev of parser.push(decoder.decode())) yield ev;
    for (const ev of parser.flush()) yield ev;
  } finally {
    reader.releaseLock();
  }
}
