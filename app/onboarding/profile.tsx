import { useTranslation } from 'react-i18next';

import { AppText } from '@/components';
import { HealthListsEditor } from '@/forms/HealthListsEditor';
import { useProfileForm } from '@/forms/ProfileForm';
import { OnboardingStep } from '@/onboarding/OnboardingStep';
import { goToStep } from '@/onboarding/steps';

export default function ProfileStep() {
  const { t } = useTranslation();
  const form = useProfileForm();
  if (!form.ready) return null;

  return (
    <OnboardingStep
      step={4}
      title={t('profileSetup.title')}
      subtitle={t('profileSetup.subtitle')}
      primary={{
        label: t('common.continue'),
        onPress: async () => {
          await form.save();
          await goToStep(5);
        },
      }}
    >
      {form.fields}
      <HealthListsEditor />
      <AppText variant="caption" tone="textMuted">
        {t('profileSetup.optionalNote')}
      </AppText>
    </OnboardingStep>
  );
}
