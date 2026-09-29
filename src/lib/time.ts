/** Funzioni pure su date, orari e trend (senza dipendenze native: testabili). */

/** Aggiunge minuti a un orario "HH:MM" (con giro sulle 24 ore). */
export function addMinutes(time: string, delta: number): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function toIsoDate(d: string, m: string, y: string): string | null {
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!day || !month || y.length !== 4) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  if (year < 1900 || date.getTime() > Date.now()) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function trendOf(
  avg7: number | null,
  avg30: number | null,
): 'up' | 'down' | 'stable' | null {
  if (avg7 == null || avg30 == null || avg30 === 0) return null;
  const delta = (avg7 - avg30) / Math.abs(avg30);
  if (delta > 0.05) return 'up';
  if (delta < -0.05) return 'down';
  return 'stable';
}
