import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PreferencesForm } from '@/forms/PreferencesForm';
import { OnboardingStep } from '@/onboarding/OnboardingStep';
import { goToStep } from '@/onboarding/steps';
import { useSettingsStore } from '@/store/settingsStore';

export default function PreferencesStep() {
  const { t } = useTranslation();
  const initial = useSettingsStore((s) => s.settings.proactivity);
  const update = useSettingsStore((s) => s.update);
  const [prefs, setPrefs] = useState(initial);

  return (
    <OnboardingStep
      step={5}
      title={t('preferences.title')}
      subtitle={t('preferences.subtitle')}
      primary={{
        label: t('common.continue'),
        onPress: async () => {
          await update({ proactivity: prefs });
          await goToStep(6);
        },
      }}
    >
      <PreferencesForm value={prefs} onChange={setPrefs} />
    </OnboardingStep>
  );
}
