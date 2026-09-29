/** Data locale in formato YYYY-MM-DD (non UTC: "oggi" è quello dell'utente). */
export function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
