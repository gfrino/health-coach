import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AIProviderSetup } from '@/components/AIProviderSetup';
import { OnboardingStep } from '@/onboarding/OnboardingStep';
import { goToStep } from '@/onboarding/steps';

export default function AIStep() {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  return (
    <OnboardingStep
      step={1}
      title={t('ai.title')}
      subtitle={t('ai.subtitle')}
      primary={{ label: t('common.continue'), onPress: () => goToStep(2), disabled: !connected }}
    >
      <AIProviderSetup onConnectedChange={setConnected} />
    </OnboardingStep>
  );
}
