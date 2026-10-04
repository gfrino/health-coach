import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Stack } from 'expo-router/stack';
import { Alert, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, InfoRow, NavRow, OptionGroup, Screen } from '@/components';
import { SUPPORTED_LANGUAGES, type AppSettings, type Units } from '@/config/settingsSchema';
import { appVersion, codeVersion } from '@/config/env';
import { getDatabaseInfo } from '@/db';
import { DEVELOPER, LEGAL_DOCS } from '@/legal';
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
            icon="me"
            label={t('profileSettings.title')}
            value={t('profileSettings.subtitle')}
            onPress={() => router.push('/settings/profile')}
          />
          <NavRow
            icon="coach"
            label={t('coachSetup.title')}
            value={`${settings.coach.name} · ${t(`coachSetup.medicalOptions.${settings.coach.medicalApproach}.label`)}`}
            onPress={() => router.push('/settings/coach')}
          />
          <NavRow
            icon="sparkles"
            label={t('memory.title')}
            value={t('memory.subtitle', { name: settings.coach.name })}
            onPress={() => router.push('/settings/memory')}
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
          <InfoRow
            label={t('settings.about.version')}
            value={codeVersion === appVersion ? appVersion : `${appVersion} (${codeVersion})`}
          />
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

        <AppText variant="headline">{t('settings.sections.developer')}</AppText>
        <Card>
          <AppText variant="headline">{DEVELOPER.name}</AppText>
          <AppText variant="callout" tone="textMuted">
            {`${DEVELOPER.street}\n${DEVELOPER.city}`}
          </AppText>
        </Card>
        <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          <NavRow
            first
            icon="globe"
            label={t('settings.developer.website')}
            value={DEVELOPER.website.replace(/^https:\/\//, '')}
            onPress={() => void WebBrowser.openBrowserAsync(DEVELOPER.website)}
          />
          <NavRow
            icon="mail"
            label={t('settings.developer.contact')}
            value={DEVELOPER.email}
            onPress={() => void Linking.openURL(`mailto:${DEVELOPER.email}`)}
          />
        </Card>

        <AppText variant="headline">{t('settings.sections.legal')}</AppText>
        <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          {LEGAL_DOCS.map((doc, i) => (
            <NavRow
              key={doc}
              first={i === 0}
              icon="document"
              label={t(`legal.${doc}`)}
              onPress={() => router.push({ pathname: '/settings/legal/[doc]', params: { doc } })}
            />
          ))}
        </Card>
      </Screen>
    </>
  );
}
