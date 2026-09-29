import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { coachConfigSchema } from '@/config/settingsSchema';
import { CoachForm } from '@/forms/CoachForm';
import { OnboardingStep } from '@/onboarding/OnboardingStep';
import { goToStep } from '@/onboarding/steps';
import { useSettingsStore } from '@/store/settingsStore';

export default function CoachStep() {
  const { t } = useTranslation();
  const initial = useSettingsStore((s) => s.settings.coach);
  const update = useSettingsStore((s) => s.update);
  const [coach, setCoach] = useState(initial);

  const next = async () => {
    const parsed = coachConfigSchema.safeParse(coach);
    if (!parsed.success) {
      Alert.alert(t('coachSetup.nameRequired'));
      return;
    }
    await update({ coach: parsed.data });
    await goToStep(4);
  };

  return (
    <OnboardingStep
      step={3}
      title={t('coachSetup.title')}
      subtitle={t('coachSetup.subtitle')}
      primary={{ label: t('common.continue'), onPress: next }}
    >
      <CoachForm value={coach} onChange={setCoach} />
    </OnboardingStep>
  );
}
