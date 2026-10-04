import { z } from 'zod';

export const SUPPORTED_LANGUAGES = ['it', 'en', 'de', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const unitsSchema = z.object({
  weight: z.enum(['kg', 'lb']),
  distance: z.enum(['km', 'mi']),
  temperature: z.enum(['c', 'f']),
  glucose: z.enum(['mmol/L', 'mg/dL']),
});
export type Units = z.infer<typeof unitsSchema>;

/** 'device' = modello sul telefono (Apple Intelligence / Gemini Nano): nessun account né chiave. */
export const AI_PROVIDERS = ['device', 'anthropic', 'openai', 'gemini'] as const;
// Gemini per primo: accesso con l'account Google e piano gratuito, il più semplice da attivare.
export const CLOUD_AI_PROVIDERS = ['gemini', 'anthropic', 'openai'] as const;
export type CloudAIProviderId = (typeof CLOUD_AI_PROVIDERS)[number];
export type AIProviderId = (typeof AI_PROVIDERS)[number];

export const MEDICAL_APPROACHES = [
  'conventional',
  'functional',
  'tcm',
  'ayurveda',
  'integrative',
  'naturopathy',
] as const;
export const NUTRITION_APPROACHES = [
  'none',
  'mediterranean',
  'keto',
  'healthyKeto',
  'lowCarb',
  'vegetarian',
  'vegan',
  'paleo',
  'intermittentFasting',
  'lowFodmap',
  'carnivore',
  'lectinFree',
] as const;
export const COACH_TONES = ['empathetic', 'direct', 'motivational', 'scientific'] as const;

export const aiConfigSchema = z.object({
  provider: z.enum(AI_PROVIDERS).nullable(),
  model: z.string().nullable(),
});
export type AIConfig = z.infer<typeof aiConfigSchema>;

export const coachConfigSchema = z.object({
  medicalApproach: z.enum(MEDICAL_APPROACHES),
  nutritionApproach: z.enum(NUTRITION_APPROACHES),
  tone: z.enum(COACH_TONES),
  name: z.string().trim().min(1).max(40),
});
export type CoachConfig = z.infer<typeof coachConfigSchema>;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const proactivitySchema = z.object({
  mode: z.enum(['proactive', 'passive']),
  maxNotificationsPerDay: z.number().int().min(0).max(5),
  eveningSummaryTime: timeOfDay,
  /** Check-in del mattino (analisi della notte): aggiunto dopo, default per chi l'aveva già. */
  morningCheckinTime: timeOfDay.default('08:00'),
  quietHoursStart: timeOfDay,
  quietHoursEnd: timeOfDay,
  reports: z.object({ daily: z.boolean(), weekly: z.boolean(), monthly: z.boolean() }),
});
export type Proactivity = z.infer<typeof proactivitySchema>;

/** Versione del flusso di onboarding: se cambia, chi l'aveva completato riprende dai passi nuovi. */
/** Diario alimentare: obiettivo scelto dall'utente (null = stimato dall'app) e Apple Salute. */
export const foodSettingsSchema = z.object({
  calorieTarget: z.number().int().min(800).max(6000).nullable(),
  writeToHealth: z.boolean(),
  /** Quando è stato chiesto il permesso di scrittura in Apple Salute: si chiede una volta sola. */
  healthAskedAt: z.number().int().nullable().optional(),
  /** Quanti tipi c'erano nell'ultima richiesta: se l'app ne scrive di nuovi, si richiede una volta. */
  healthAskedTypes: z.number().int().nullable().optional(),
});

export const ONBOARDING_FLOW_VERSION = 2;

/**
 * Ogni chiave è una riga della tabella `settings` (valore JSON).
 * Aggiungere un'impostazione = aggiungere qui chiave + default.
 */
export const settingsShape = {
  language: z.enum(['system', ...SUPPORTED_LANGUAGES]),
  theme: z.enum(['system', 'light', 'dark']),
  units: unitsSchema,
  onboardingStep: z.number().int().min(0),
  onboardingCompleted: z.boolean(),
  medicalDisclaimerAcceptedAt: z.number().int().nullable(),
  onboardingFlowVersion: z.number().int().min(0),
  biometricLock: z.boolean(),
  ai: aiConfigSchema,
  coach: coachConfigSchema,
  proactivity: proactivitySchema,
  /** Sorgente di salute di piattaforma collegata (Apple Health su iOS, Health Connect su Android). */
  healthSourceConnectedAt: z.number().int().nullable(),
  food: foodSettingsSchema,
} as const;

export const settingsSchema = z.object(settingsShape);
export type AppSettings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof AppSettings;

const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);
const MG_DL_REGIONS = new Set(['US', 'FR', 'IT', 'DE', 'AT', 'BE', 'ES', 'PT', 'JP', 'IN', 'BR']);

/** Default ragionevoli in base al Paese del dispositivo (la Svizzera usa mmol/L). */
export function defaultUnitsForRegion(region: string | null | undefined): Units {
  const r = region?.toUpperCase() ?? '';
  const imperial = IMPERIAL_REGIONS.has(r);
  return {
    weight: imperial ? 'lb' : 'kg',
    distance: imperial ? 'mi' : 'km',
    temperature: imperial ? 'f' : 'c',
    glucose: MG_DL_REGIONS.has(r) ? 'mg/dL' : 'mmol/L',
  };
}

export function getDefaultSettings(region?: string | null): AppSettings {
  return {
    language: 'system',
    theme: 'system',
    units: defaultUnitsForRegion(region),
    onboardingStep: 0,
    onboardingCompleted: false,
    medicalDisclaimerAcceptedAt: null,
    onboardingFlowVersion: 0,
    biometricLock: false,
    ai: { provider: null, model: null },
    coach: {
      medicalApproach: 'conventional',
      nutritionApproach: 'none',
      tone: 'empathetic',
      name: 'Coach',
    },
    proactivity: {
      mode: 'proactive',
      maxNotificationsPerDay: 2,
      eveningSummaryTime: '20:30',
      morningCheckinTime: '08:00',
      quietHoursStart: '22:00',
      quietHoursEnd: '07:30',
      reports: { daily: true, weekly: true, monthly: false },
    },
    healthSourceConnectedAt: null,
    food: { calorieTarget: null, writeToHealth: true },
  };
}
