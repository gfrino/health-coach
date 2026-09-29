import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { destroyDatabase, DatabaseUnlockError } from '@/db';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';
import { Screen } from './Screen';

/** Schermata mostrata se l'avvio fallisce (tipicamente: DB cifrato non sbloccabile). */
export function StartupError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [busy, setBusy] = useState(false);
  const isUnlock = error instanceof DatabaseUnlockError;

  const confirmReset = () =>
    Alert.alert(t('errors.resetConfirmTitle'), t('errors.resetConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('errors.resetData'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          await destroyDatabase().catch(() => undefined);
          setBusy(false);
          onRetry();
        },
      },
    ]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <Icon name="warning" size={40} color={colors.danger} />
        <AppText variant="title">
          {isUnlock ? t('errors.dbUnlockTitle') : t('errors.generic')}
        </AppText>
        {isUnlock ? <AppText tone="textMuted">{t('errors.dbUnlockBody')}</AppText> : null}
        {__DEV__ ? (
          <AppText variant="caption" tone="textMuted">
            {String((error as Error)?.cause ?? error)}
          </AppText>
        ) : null}
        <Button label={t('common.retry')} onPress={onRetry} disabled={busy} />
        {isUnlock ? (
          <Button
            label={t('errors.resetData')}
            variant="ghost"
            onPress={confirmReset}
            loading={busy}
          />
        ) : null}
      </View>
    </Screen>
  );
}
