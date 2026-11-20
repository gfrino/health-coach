import { useFocusEffect } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText, Card, InfoRow, Screen } from '@/components';
import { AIProviderSetup } from '@/components/AIProviderSetup';
import { conversationRepository, getDb } from '@/db';
import type { TokenUsage } from '@/db/repositories/conversationRepository';
import { DAY_MS } from '@/lib/dates';

/** Provider AI del coach: voce propria del menu laterale (prima era dentro Servizi). */
export default function AISettingsScreen() {
  const { t, i18n } = useTranslation();
  const [usage, setUsage] = useState<TokenUsage[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDb()
        .then((db) => conversationRepository.tokenUsageSince(db, Date.now() - 30 * DAY_MS))
        .then((u) => active && setUsage(u));
      return () => {
        active = false;
      };
    }, []),
  );

  const n = (x: number) => x.toLocaleString(i18n.language);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('tabs.ai') }} />
      <Screen menu title={t('tabs.ai')}>
        <AppText tone="textMuted">{t('settings.aiIntro')}</AppText>
        <AIProviderSetup />
        <Card>
          <AppText variant="headline">{t('settings.usageTitle')}</AppText>
          {usage.length === 0 ? (
            <AppText variant="callout" tone="textMuted">
              {t('settings.usageEmpty')}
            </AppText>
          ) : (
            usage.map((u) => (
              <InfoRow
                key={`${u.provider}-${u.model}`}
                label={u.model ?? u.provider ?? '—'}
                value={t('settings.usageValue', {
                  input: n(u.inputTokens),
                  output: n(u.outputTokens),
                  messages: u.messages,
                })}
              />
            ))
          )}
          <AppText variant="caption" tone="textMuted">
            {t('settings.usageNote')}
          </AppText>
        </Card>
      </Screen>
    </>
  );
}
