/** Testo leggibile ad alta voce: via il Markdown (asterischi, titoli, link…). */
export function toSpeakable(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, '$2')
    .replace(/\s+\n/g, '\n')
    .trim();
}
