/** Parsing tollerante degli argomenti di una tool call (JSON parziale o vuoto → oggetto vuoto). */
export function parseToolArguments(raw: string | undefined | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
