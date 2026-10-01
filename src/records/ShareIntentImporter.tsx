import { router } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '@/store/settingsStore';

import { importFiles } from './importReport';

/**
 * Riceve i file condivisi verso Health Coach da altre app (menu "Condividi" di iOS/Android)
 * e li salva come referti nella Cartella salute. Attende la fine dell'onboarding.
 */
export function ShareIntentImporter() {
  const { t } = useTranslation();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const ready = useSettingsStore((s) => s.hydrated && s.settings.onboardingCompleted);
  const busy = useRef(false);

  useEffect(() => {
    if (!hasShareIntent || !ready || busy.current) return;
    const files = (shareIntent.files ?? []).map((f) => ({
      uri: f.path,
      mimeType: f.mimeType,
      fileName: f.fileName,
    }));
    if (!files.length) {
      // Condiviso solo testo o un link: niente da salvare, ma lo diciamo invece di ignorarlo.
      resetShareIntent();
      Alert.alert(t('records.importFailed'), t('records.sharedNoFile'));
      return;
    }
    busy.current = true;
    importFiles(files, t('records.defaultTitle'))
      .then((ids) => {
        router.navigate({ pathname: '/me', params: { section: 'records' } });
        if (ids.length === 1)
          router.push({ pathname: '/me/report/[id]', params: { id: ids[0] as string } });
        Alert.alert(t('records.sharedTitle'), t('records.sharedBody', { count: ids.length }));
      })
      .catch(() => Alert.alert(t('records.importFailed'), t('records.unsupported')))
      .finally(() => {
        busy.current = false;
        resetShareIntent();
      });
  }, [hasShareIntent, ready, shareIntent, resetShareIntent, t]);

  return null;
}
