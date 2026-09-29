import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HEALTH_DATA_CATEGORIES, typesForPlatform } from '@/sources/healthDataTypes';
import {
  getHealthAvailability,
  openHealthInstallPage,
  requestHealthReadAccess,
} from '@/sources/platformHealth';
import type { HealthAvailability } from '@/sources/types';
import { syncHealthData, useSyncStore } from '@/sources/syncService';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { BrandLogo } from './BrandLogo';
import { Button } from './Button';
import { Card } from './Card';
import { Icon } from './Icon';

/** Apple Health (iOS) / Health Connect (Android): stato, spiegazione dei dati, collegamento. */
export function HealthSourceCard({ showCategories = true }: { showCategories?: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const connectedAt = useSettingsStore((s) => s.settings.healthSourceConnectedAt);
  const update = useSettingsStore((s) => s.update);
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [busy, setBusy] = useState(false);
  const { syncing, lastSyncAt } = useSyncStore();

  const isIOS = Platform.OS === 'ios';
  const sourceName = isIOS ? 'Apple Health' : 'Health Connect';
  const platformCategories = new Set(
    typesForPlatform(isIOS ? 'ios' : 'android').map((d) => d.category),
  );
  const connected = connectedAt !== null;

  // Ricontrolla al ritorno sulla schermata (es. dopo aver installato Health Connect).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getHealthAvailability().then((a) => active && setAvailability(a));
      return () => {
        active = false;
      };
    }, []),
  );

  const connect = async () => {
    setBusy(true);
    try {
      const res = await requestHealthReadAccess();
      if (res.completed && res.grantedCount !== 0) {
        await update({ healthSourceConnectedAt: connectedAt ?? Date.now() });
        // Prima lettura subito dopo il consenso (nell'onboarding la fa il passo finale).
        if (useSettingsStore.getState().settings.onboardingCompleted)
          void syncHealthData({ force: true });
      } else if (res.grantedCount === 0) {
        Alert.alert(
          t('sources.noneGrantedTitle'),
          t('sources.noneGrantedBody', { source: sourceName }),
        );
      }
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <BrandLogo id={isIOS ? 'apple_health' : 'health_connect'} size={36} />
        <AppText variant="title" style={{ flex: 1 }}>
          {sourceName}
        </AppText>
        {connected ? <Icon name="checkCircle" color={colors.success} /> : null}
      </View>
      <AppText variant="callout" tone="textMuted">
        {t('sources.readOnly')}
      </AppText>

      {showCategories
        ? HEALTH_DATA_CATEGORIES.filter((c) => platformCategories.has(c)).map((c) => (
            <View key={c} style={{ gap: 2, marginTop: spacing.xs }}>
              <AppText variant="callout" style={{ fontWeight: '600' }}>
                {t(`sources.categories.${c}.title`)}
              </AppText>
              <AppText variant="caption" tone="textMuted">
                {t(`sources.categories.${c}.why`)}
              </AppText>
            </View>
          ))
        : null}

      {availability === 'needsInstall' ? (
        <>
          <AppText variant="callout">{t('sources.installHealthConnect')}</AppText>
          <Button label={t('sources.installButton')} onPress={openHealthInstallPage} />
        </>
      ) : availability === 'unavailable' ? (
        <AppText variant="callout" tone="warning">
          {t('sources.unavailable', { source: sourceName })}
        </AppText>
      ) : connected ? (
        <View style={{ gap: spacing.sm }}>
          <AppText tone="success">{t('sources.connected', { source: sourceName })}</AppText>
          <AppText variant="caption" tone="textMuted">
            {syncing
              ? t('today.syncing', { source: sourceName })
              : lastSyncAt
                ? t('integrations.lastSync', {
                    when: new Date(lastSyncAt).toLocaleString(i18n.language, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }),
                  })
                : t('integrations.lastSyncNever')}
          </AppText>
          <Button
            label={t('today.syncNow')}
            onPress={() => void syncHealthData({ force: true })}
            loading={syncing}
          />
          <Button
            label={t('sources.reviewPermissions')}
            variant="secondary"
            onPress={connect}
            loading={busy}
          />
        </View>
      ) : (
        <Button
          label={t('sources.connect', { source: sourceName })}
          onPress={connect}
          loading={busy}
          disabled={availability === null}
        />
      )}
      {!isIOS && !connected ? (
        <AppText variant="caption" tone="textMuted">
          {t('sources.androidHistoryNote')}
        </AppText>
      ) : null}
    </Card>
  );
}
