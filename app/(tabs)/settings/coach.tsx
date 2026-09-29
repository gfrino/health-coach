import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen } from '@/components';
import { coachConfigSchema } from '@/config/settingsSchema';
import { CoachForm } from '@/forms/CoachForm';
import { useSettingsStore } from '@/store/settingsStore';

export default function CoachSettingsScreen() {
  const { t } = useTranslation();
  const initial = useSettingsStore((s) => s.settings.coach);
  const update = useSettingsStore((s) => s.update);
  const [coach, setCoach] = useState(initial);

  const save = async () => {
    const parsed = coachConfigSchema.safeParse(coach);
    if (!parsed.success) return Alert.alert(t('coachSetup.nameRequired'));
    await update({ coach: parsed.data });
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: t('coachSetup.title'), headerLargeTitle: false }} />
      <Screen footer={<Button label={t('common.save')} onPress={save} />}>
        <CoachForm value={coach} onChange={setCoach} />
      </Screen>
    </>
  );
}
