import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { OnDeviceAvailability } from 'on-device-ai';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { CloudAISetup } from './CloudAISetup';
import { DeviceAISetup } from './DeviceAISetup';
import { Icon } from './Icon';

/**
 * Scelta dell'AI del coach. Predefinita: il modello sul telefono (nessun account né chiave).
 * I servizi online (con chiave API) sono un'opzione avanzata, aperta in automatico
 * solo se il telefono non supporta l'AI integrata o se sono già in uso.
 */
export function AIProviderSetup({
  onConnectedChange,
}: {
  onConnectedChange?: (connected: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const ai = useSettingsStore((s) => s.settings.ai);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [showCloud, setShowCloud] = useState(!!ai.provider && ai.provider !== 'device');
  const [deviceUnsupported, setDeviceUnsupported] = useState(false);

  const connected = (ai.provider === 'device' && !!ai.model) || cloudConnected;
  useEffect(() => {
    onConnectedChange?.(connected);
  }, [connected, onConnectedChange]);

  const onAvailability = useCallback((a: OnDeviceAvailability) => {
    setDeviceUnsupported(a.status === 'unavailable' && a.reason !== 'notEnabled');
  }, []);

  const open = showCloud || deviceUnsupported;

  return (
    <View style={{ gap: spacing.lg }}>
      <DeviceAISetup onAvailability={onAvailability} />

      <Pressable
        onPress={() => setShowCloud((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('ai.cloud.toggle')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 }}
      >
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="chevronRight" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText tone="primary" style={{ fontWeight: '600' }}>
            {t('ai.cloud.toggle')}
          </AppText>
          <AppText variant="caption" tone="textMuted">
            {t('ai.cloud.toggleHint')}
          </AppText>
        </View>
      </Pressable>

      {open ? <CloudAISetup onConnectedChange={setCloudConnected} /> : null}
    </View>
  );
}
