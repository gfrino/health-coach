import type { Units } from '@/config/settingsSchema';

/** Conversioni e formattazione nelle unità scelte dall'utente (i dati restano in unità canoniche). */

export const MG_DL_PER_MMOL_L = 18.016;

export function num(value: number, locale: string, maxDecimals = 0): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: maxDecimals }).format(value);
}

export function formatWeight(kg: number, units: Units, locale: string): string {
  return units.weight === 'lb' ? `${num(kg * 2.20462, locale, 1)} lb` : `${num(kg, locale, 1)} kg`;
}

export function formatDistance(m: number, units: Units, locale: string): string {
  return units.distance === 'mi'
    ? `${num(m / 1609.344, locale, 1)} mi`
    : `${num(m / 1000, locale, 1)} km`;
}

export function formatGlucose(mgdl: number, units: Units, locale: string): string {
  return units.glucose === 'mmol/L'
    ? `${num(mgdl / MG_DL_PER_MMOL_L, locale, 1)} mmol/L`
    : `${num(mgdl, locale)} mg/dL`;
}

export function formatTemperature(c: number, units: Units, locale: string): string {
  return units.temperature === 'f'
    ? `${num((c * 9) / 5 + 32, locale, 1)} °F`
    : `${num(c, locale, 1)} °C`;
}

/** "7 h 05" / "45 min" */
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
