import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { toAIError } from '@/ai/errors';
import {
  DEVICE_MODEL_ID,
  deviceEngineName,
  downloadDeviceModel,
  getDeviceAvailability,
} from '@/ai/providers/device';
import type { OnDeviceAvailability } from 'on-device-ai';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { BrandLogo } from './BrandLogo';
import { Button } from './Button';
import { Card } from './Card';
import { Icon } from './Icon';

interface Props {
  onAvailability?: (a: OnDeviceAvailability) => void;
}

/** "AI del telefono": un tocco, nessun account. Guida l'utente se va attivata o scaricata. */
export function DeviceAISetup({ onAvailability }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const ai = useSettingsStore((s) => s.settings.ai);
  const update = useSettingsStore((s) => s.update);
  const [availability, setAvailability] = useState<OnDeviceAvailability | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    const a = await getDeviceAvailability();
    setAvailability(a);
    onAvailability?.(a);
  }, [onAvailability]);

  // Controlla all'apertura e al ritorno nell'app (es. dopo aver attivato Apple Intelligence).
  useEffect(() => {
    void getDeviceAvailability().then((a) => {
      setAvailability(a);
      onAvailability?.(a);
    });
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void check());
    return () => sub.remove();
  }, [check, onAvailability]);

  const inUse = ai.provider === 'device';
  const engine = deviceEngineName();

  const use = async () => {
    await update({ ai: { provider: 'device', model: DEVICE_MODEL_ID } });
  };

  const download = async () => {
    setError(null);
    setDownloading(0);
    try {
      await downloadDeviceModel((bytes) => setDownloading(bytes));
      await check();
    } catch (e) {
      setError(t(`ai.errors.${toAIError(e).code}`));
    } finally {
      setDownloading(null);
    }
  };

  const body = () => {
    if (!availability) return <AppText tone="textMuted">{t('ai.device.checking')}</AppText>;
    switch (availability.status) {
      case 'available':
        return inUse ? (
          <View
            style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}
            accessibilityLiveRegion="polite"
          >
            <Icon name="checkCircle" color={colors.success} />
            <AppText tone="success" style={{ flex: 1 }}>
              {t('ai.device.inUse', { engine })}
            </AppText>
          </View>
        ) : (
          <Button label={t('ai.device.use', { engine })} onPress={use} />
        );
      case 'downloadable':
        return (
          <>
            <AppText variant="callout">{t('ai.device.downloadNeeded')}</AppText>
            <Button
              label={
                downloading !== null
                  ? t('ai.device.downloading', { mb: Math.round(downloading / 1e6) })
                  : t('ai.device.download')
              }
              onPress={download}
              loading={downloading !== null && downloading === 0}
              disabled={downloading !== null}
            />
          </>
        );
      case 'downloading':
        return (
          <>
            <AppText variant="callout">{t('ai.device.preparing', { engine })}</AppText>
            <Button label={t('ai.device.recheck')} variant="secondary" onPress={check} />
          </>
        );
      default:
        if (availability.reason === 'notEnabled') {
          return (
            <>
              <AppText variant="callout">{t('ai.device.enableAppleIntelligence')}</AppText>
              <Button label={t('ai.device.recheck')} variant="secondary" onPress={check} />
            </>
          );
        }
        return (
          <AppText variant="callout" tone="textMuted">
            {Platform.OS === 'ios'
              ? t('ai.device.notSupportedIOS')
              : t('ai.device.notSupportedAndroid')}
          </AppText>
        );
    }
  };

  return (
    <Card tone={availability?.status === 'available' ? 'soft' : 'default'}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <BrandLogo id="device" size={36} />
        <AppText variant="headline" style={{ flex: 1 }}>
          {t('ai.device.title', { engine })}
        </AppText>
        {availability?.status === 'available' ? (
          <AppText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
            {t('ai.device.recommended')}
          </AppText>
        ) : null}
      </View>
      <AppText variant="callout">{t('ai.device.pitch')}</AppText>
      {body()}
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
    </Card>
  );
}
