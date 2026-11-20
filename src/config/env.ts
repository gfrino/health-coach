import Constants from 'expo-constants';
import { z } from 'zod';

const extraSchema = z.object({
  variant: z.enum(['development', 'preview', 'production']).default('development'),
  backendUrl: z.string().default(''),
});

/** Configurazione pubblica letta da app.config.ts → extra. Nessun segreto qui. */
export const env = extraSchema.parse(Constants.expoConfig?.extra ?? {});
export const appVersion = Constants.expoConfig?.version ?? '0.0.0';

/**
 * Versione del codice JavaScript (package.json): cresce a ogni modifica e arriva anche con gli
 * aggiornamenti OTA, mentre `appVersion` cambia solo con una nuova build per lo store.
 */
export const codeVersion: string = (require('../../package.json') as { version: string }).version;

/** La build nativa installata è almeno questa versione? (es. permessi Android aggiunti in 1.40.0) */
export function nativeAtLeast(min: string, version = appVersion): boolean {
  const a = version.split('.').map((n) => parseInt(n, 10) || 0);
  const b = min.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}

/** Build con tutti i permessi Health Connect (lettura completa e scrittura). */
export const HEALTH_CONNECT_FULL_VERSION = '1.40.0';
