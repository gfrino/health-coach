/**
 * Ordine delle righe dei nutrienti scelto dall'utente (es. i grassi insaturi sotto i saturi).
 * Gli id non presenti nell'ordine salvato (voci aggiunte dopo) restano in fondo nell'ordine
 * originale; quelli salvati ma non più tracciati si ignorano.
 */
export function orderRows<T extends { id: string }>(rows: T[], order: string[] | undefined): T[] {
  if (!order?.length) return rows;
  const pos = new Map(order.map((id, i) => [id, i]));
  return rows
    .map((r, i) => ({ r, i, p: pos.get(r.id) ?? order.length + i }))
    .sort((a, b) => a.p - b.p)
    .map((x) => x.r);
}

/** Sposta un id di una posizione in su (-1) o in giù (+1); restituisce il nuovo ordine completo. */
export function moveId(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
