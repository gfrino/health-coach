import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { OnDeviceAvailability } from 'on-device-ai';

import { deviceEngineName, isDeviceUnsupported } from '@/ai/providers/device';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { CloudAISetup } from './CloudAISetup';
import { DeviceAISetup } from './DeviceAISetup';
import { useScrollIntoView } from './ScrollIntoView';

/**
 * Scelta dell'AI del coach. Predefinita: il modello sul telefono (nessun account né chiave).
 * Sotto, sempre visibili, i servizi online (con chiave API): la guida si apre toccandone uno.
 * Se il telefono non ha l'AI integrata, lo diciamo chiaramente e portiamo l'utente ai servizi online.
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
  const [unsupported, setUnsupported] = useState(false);

  const connected = (ai.provider === 'device' && !!ai.model) || cloudConnected;
  useEffect(() => {
    onConnectedChange?.(connected);
  }, [connected, onConnectedChange]);

  const onAvailability = useCallback(
    (a: OnDeviceAvailability) => setUnsupported(isDeviceUnsupported(a)),
    [],
  );

  // Senza AI integrata e senza un servizio online già collegato: scorre una volta ai servizi online.
  const scrollIntoView = useScrollIntoView();
  const cloudRef = useRef<View>(null);
  const scrolled = useRef(false);
  const hasCloud = !!ai.provider && ai.provider !== 'device' && !!ai.model;
  useEffect(() => {
    if (!unsupported || hasCloud || scrolled.current) return;
    scrolled.current = true;
    const timer = setTimeout(() => scrollIntoView(cloudRef), 300);
    return () => clearTimeout(timer);
  }, [unsupported, hasCloud, scrollIntoView]);

  return (
    <View style={{ gap: spacing.lg }}>
      <DeviceAISetup onAvailability={onAvailability} />

      {/* Servizi online sempre visibili: chi ha già ChatGPT, Claude o Gemini li trova subito. */}
      <View ref={cloudRef} collapsable={false} style={{ gap: 2 }}>
        <AppText variant="headline">
          {unsupported
            ? t('ai.cloud.unsupportedTitle', { engine: deviceEngineName() })
            : t('ai.cloud.toggle')}
        </AppText>
        <AppText variant="caption" tone="textMuted">
          {unsupported ? t('ai.cloud.unsupportedHint') : t('ai.cloud.toggleHint')}
        </AppText>
      </View>
      <CloudAISetup onConnectedChange={setCloudConnected} />
    </View>
  );
}
