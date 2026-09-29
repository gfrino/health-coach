import { router, type Href } from 'expo-router';

import { useSettingsStore } from '@/store/settingsStore';

/** Ordine dei passi dell'onboarding. L'indice è salvato in settings.onboardingStep (riprendibile). */
export const ONBOARDING_ROUTES = [
  '/onboarding',
  '/onboarding/ai',
  '/onboarding/sources',
  '/onboarding/coach',
  '/onboarding/profile',
  '/onboarding/preferences',
  '/onboarding/sync',
] as const satisfies readonly Href[];

export const ONBOARDING_STEP_COUNT = ONBOARDING_ROUTES.length;

export function routeForStep(step: number): Href {
  return (
    ONBOARDING_ROUTES[Math.min(Math.max(step, 0), ONBOARDING_ROUTES.length - 1)] ?? '/onboarding'
  );
}

/** Salva il progresso e passa al passo successivo. */
export async function goToStep(step: number): Promise<void> {
  const { settings, update } = useSettingsStore.getState();
  if (step > settings.onboardingStep) await update({ onboardingStep: step });
  router.push(routeForStep(step));
}
