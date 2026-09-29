import { Redirect } from 'expo-router';

import { routeForStep } from '@/onboarding/steps';
import { useSettingsStore } from '@/store/settingsStore';

/** Punto di ingresso: l'app, oppure l'onboarding ripreso dal passo salvato. */
export default function Index() {
  const { onboardingCompleted, onboardingStep } = useSettingsStore((s) => s.settings);
  return <Redirect href={onboardingCompleted ? '/coach' : routeForStep(onboardingStep)} />;
}
