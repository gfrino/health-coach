/**
 * Parser Markdown minimale per le risposte del coach (niente HTML, niente immagini):
 * titoli, paragrafi, elenchi puntati/numerati, blocchi di codice, citazioni e
 * inline **grassetto**, *corsivo*, `codice`, [link](url).
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: Inline[] }
  | { type: 'italic'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; url: string; children: Inline[] };

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; inline: Inline[] }
  | { type: 'paragraph'; inline: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'code'; text: string }
  | { type: 'quote'; inline: Inline[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'paragraph', inline: parseInline(para.join(' ')) });
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    if (line.trim().startsWith('```')) {
      flushPara();
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```'))
        code.push(lines[i++] ?? '');
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    if (!line.trim()) {
      flushPara();
      continue;
    }
    const h = HEADING.exec(line);
    if (h?.[1] && h[2] !== undefined) {
      flushPara();
      blocks.push({
        type: 'heading',
        level: Math.min(h[1].length, 3) as 1 | 2 | 3,
        inline: parseInline(h[2]),
      });
      continue;
    }
    if (line.startsWith('>')) {
      flushPara();
      blocks.push({ type: 'quote', inline: parseInline(line.replace(/^>\s?/, '')) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    if (bullet || ordered) {
      flushPara();
      const isOrdered = !!ordered;
      const items: Inline[][] = [];
      let j = i;
      for (; j < lines.length; j++) {
        const m = (isOrdered ? ORDERED : BULLET).exec(lines[j] ?? '');
        if (!m) break;
        items.push(parseInline(m[1] ?? ''));
      }
      blocks.push({ type: 'list', ordered: isOrdered, items });
      i = j - 1;
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  return blocks;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = '';
  const pushText = () => {
    if (text) {
      out.push({ type: 'text', text });
      text = '';
    }
  };

  for (let i = 0; i < src.length;) {
    const rest = src.slice(i);

    if (rest.startsWith('`')) {
      const end = src.indexOf('`', i + 1);
      if (end > i + 1) {
        pushText();
        out.push({ type: 'code', text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    const strong = /^(\*\*|__)(.+?)\1/.exec(rest);
    if (strong?.[2]) {
      pushText();
      out.push({ type: 'bold', children: parseInline(strong[2]) });
      i += strong[0].length;
      continue;
    }
    const em = /^(\*|_)(?!\s)(.+?)(?<!\s)\1(?![*_\w])/.exec(rest);
    if (em?.[2]) {
      pushText();
      out.push({ type: 'italic', children: parseInline(em[2]) });
      i += em[0].length;
      continue;
    }
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(rest);
    if (link?.[1] && link[2]) {
      pushText();
      out.push({ type: 'link', url: link[2], children: parseInline(link[1]) });
      i += link[0].length;
      continue;
    }
    text += src[i];
    i++;
  }
  pushText();
  return out;
}
