import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Screen } from '@/components';
import { HealthListsEditor } from '@/forms/HealthListsEditor';
import { useProfileForm } from '@/forms/ProfileForm';
import { haptic } from '@/lib/haptics';

/** Opzioni → Il mio profilo: gli stessi dati dell'onboarding, modificabili in ogni momento. */
export default function ProfileSettingsScreen() {
  const { t } = useTranslation();
  const form = useProfileForm();

  return (
    <>
      <Stack.Screen options={{ title: t('profileSettings.title') }} />
      {form.ready ? (
        <Screen
          footer={
            <Button
              label={t('common.save')}
              onPress={async () => {
                await form.save();
                haptic.success();
                router.back();
              }}
            />
          }
        >
          {form.fields}
          <AppText variant="title">{t('profileSettings.healthTitle')}</AppText>
          <HealthListsEditor />
        </Screen>
      ) : null}
    </>
  );
}
