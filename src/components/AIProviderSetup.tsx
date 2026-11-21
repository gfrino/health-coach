import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { CloudAISetup } from './CloudAISetup';
import { DeviceAISetup } from './DeviceAISetup';

/**
 * Scelta dell'AI del coach. Predefinita: il modello sul telefono (nessun account né chiave).
 * Sotto, sempre visibili, i servizi online (con chiave API): la guida si apre toccandone uno.
 */
export function AIProviderSetup({
  onConnectedChange,
}: {
  onConnectedChange?: (connected: boolean) => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const ai = useSettingsStore((s) => s.settings.ai);
  const [cloudConnected, setCloudConnected] = useState(false);

  const connected = (ai.provider === 'device' && !!ai.model) || cloudConnected;
  useEffect(() => {
    onConnectedChange?.(connected);
  }, [connected, onConnectedChange]);

  return (
    <View style={{ gap: spacing.lg }}>
      <DeviceAISetup />

      {/* Servizi online sempre visibili: chi ha già ChatGPT, Claude o Gemini li trova subito. */}
      <View style={{ gap: 2 }}>
        <AppText variant="headline">{t('ai.cloud.toggle')}</AppText>
        <AppText variant="caption" tone="textMuted">
          {t('ai.cloud.toggleHint')}
        </AppText>
      </View>
      <CloudAISetup onConnectedChange={setCloudConnected} />
    </View>
  );
}
