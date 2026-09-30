import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, InfoRow, NavRow, OptionGroup, Screen } from '@/components';
import { SUPPORTED_LANGUAGES, type AppSettings, type Units } from '@/config/settingsSchema';
import { appVersion } from '@/config/env';
import { getDatabaseInfo } from '@/db';
import { useSettingsStore } from '@/store/settingsStore';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const dbInfo = getDatabaseInfo();

  const save = (patch: Partial<AppSettings>) =>
    update(patch).catch(() => Alert.alert(t('errors.generic')));
  const setUnit = <K extends keyof Units>(key: K, value: Units[K]) =>
    save({ units: { ...settings.units, [key]: value } });

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('tabs.settings') }} />
      <Screen title={t('settings.title')}>
        <AppText variant="headline">{t('settings.sections.coach')}</AppText>
        <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          <NavRow
            first
            icon="coach"
            label={t('coachSetup.title')}
            value={`${settings.coach.name} · ${t(`coachSetup.medicalOptions.${settings.coach.medicalApproach}.label`)}`}
            onPress={() => router.push('/settings/coach')}
          />
          <NavRow
            icon="today"
            label={t('preferences.title')}
            value={t(`preferences.modes.${settings.proactivity.mode}.label`)}
            onPress={() => router.push('/settings/proactivity')}
          />
        </Card>

        <OptionGroup
          label={t('settings.sections.language')}
          value={settings.language}
          onChange={(language) => save({ language })}
          options={[
            { value: 'system', label: t('settings.languageSystem') },
            ...SUPPORTED_LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) })),
          ]}
        />

        <OptionGroup
          label={t('settings.theme.title')}
          value={settings.theme}
          onChange={(theme) => save({ theme })}
          options={[
            { value: 'system', label: t('settings.theme.system') },
            { value: 'light', label: t('settings.theme.light') },
            { value: 'dark', label: t('settings.theme.dark') },
          ]}
        />

        <AppText variant="headline">{t('settings.sections.units')}</AppText>
        <OptionGroup
          label={t('settings.units.weight')}
          value={settings.units.weight}
          onChange={(v) => setUnit('weight', v)}
          options={[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ]}
        />
        <OptionGroup
          label={t('settings.units.distance')}
          value={settings.units.distance}
          onChange={(v) => setUnit('distance', v)}
          options={[
            { value: 'km', label: 'km' },
            { value: 'mi', label: 'mi' },
          ]}
        />
        <OptionGroup
          label={t('settings.units.temperature')}
          value={settings.units.temperature}
          onChange={(v) => setUnit('temperature', v)}
          options={[
            { value: 'c', label: t('settings.units.celsius') },
            { value: 'f', label: t('settings.units.fahrenheit') },
          ]}
        />
        <OptionGroup
          label={t('settings.units.glucose')}
          value={settings.units.glucose}
          onChange={(v) => setUnit('glucose', v)}
          options={[
            { value: 'mmol/L', label: 'mmol/L' },
            { value: 'mg/dL', label: 'mg/dL' },
          ]}
        />

        <AppText variant="headline">{t('settings.sections.about')}</AppText>
        <Card>
          <InfoRow label={t('settings.about.version')} value={appVersion} />
          <InfoRow
            label={t('settings.about.database')}
            value={
              dbInfo?.cipherVersion
                ? t('settings.about.encrypted', { version: dbInfo.cipherVersion })
                : t('settings.about.notEncrypted')
            }
          />
          {dbInfo ? (
            <AppText variant="caption" tone="textMuted">
              {t('settings.about.schema', { version: dbInfo.schemaVersion })}
            </AppText>
          ) : null}
        </Card>
        <Card tone="soft">
          <AppText variant="headline">{t('settings.about.disclaimer')}</AppText>
          <AppText variant="callout">{t('onboarding.disclaimer')}</AppText>
        </Card>
      </Screen>
    </>
  );
}
