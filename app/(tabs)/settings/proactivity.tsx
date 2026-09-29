import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Screen } from '@/components';
import { PreferencesForm } from '@/forms/PreferencesForm';
import { useSettingsStore } from '@/store/settingsStore';

export default function ProactivitySettingsScreen() {
  const { t } = useTranslation();
  const initial = useSettingsStore((s) => s.settings.proactivity);
  const update = useSettingsStore((s) => s.update);
  const [prefs, setPrefs] = useState(initial);

  return (
    <>
      <Stack.Screen options={{ title: t('preferences.title'), headerLargeTitle: false }} />
      <Screen
        footer={
          <Button
            label={t('common.save')}
            onPress={async () => {
              await update({ proactivity: prefs });
              router.back();
            }}
          />
        }
      >
        <PreferencesForm value={prefs} onChange={setPrefs} />
      </Screen>
    </>
  );
}
