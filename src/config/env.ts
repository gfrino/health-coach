import Constants from 'expo-constants';
import { z } from 'zod';

const extraSchema = z.object({
  variant: z.enum(['development', 'preview', 'production']).default('development'),
  backendUrl: z.string().default(''),
});

/** Configurazione pubblica letta da app.config.ts → extra. Nessun segreto qui. */
export const env = extraSchema.parse(Constants.expoConfig?.extra ?? {});
export const appVersion = Constants.expoConfig?.version ?? '0.0.0';
