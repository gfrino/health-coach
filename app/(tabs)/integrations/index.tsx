import { useFocusEffect } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useCallback, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, NavRow, Screen } from '@/components';
import { HealthSourceCard } from '@/components/HealthSourceCard';
import { IntegrationCard } from '@/components/IntegrationCard';
import { getDb, integrationInterestRepository } from '@/db';
import { comingSoonByCategory } from '@/integrations/integrationsCatalog';
import { useTheme } from '@/theme';

export default function IntegrationsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const groups = comingSoonByCategory(Platform.OS === 'ios' ? 'ios' : 'android');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDb()
        .then((db) => integrationInterestRepository.listInterests(db))
        .then((ids) => active && setInterests(new Set(ids)));
      return () => {
        active = false;
      };
    }, []),
  );

  const toggle = async (id: string) => {
    const next = !interests.has(id);
    const db = await getDb();
    await integrationInterestRepository.setInterest(db, id, next);
    setInterests((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const section = (title: string, subtitle?: string) => (
    <View style={{ gap: 2, marginTop: spacing.sm }}>
      <AppText variant="title">{title}</AppText>
      {subtitle ? (
        <AppText variant="callout" tone="textMuted">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('tabs.integrations') }} />
      <Screen menu title={t('tabs.integrations')}>
        {section(t('integrations.healthTitle'))}
        <HealthSourceCard showCategories={false} />

        {section(t('integrations.comingSoonTitle'), t('integrations.comingSoonIntro'))}
        {groups.map((g) => (
          <View key={g.category} style={{ gap: spacing.sm }}>
            <AppText
              variant="caption"
              tone="textMuted"
              style={{ textTransform: 'uppercase', marginTop: spacing.sm }}
            >
              {t(`integrations.categories.${g.category}`)}
            </AppText>
            {g.items.map((item) => (
              <IntegrationCard
                key={item.id}
                integration={item}
                interested={interests.has(item.id)}
                onToggleInterest={() => toggle(item.id)}
              />
            ))}
          </View>
        ))}
        <AppText variant="caption" tone="textMuted">
          {t('integrations.notifyNote')}
        </AppText>

        <Card tone="soft">
          <AppText variant="headline">{t('integrations.requestTitle')}</AppText>
          <AppText variant="callout">{t('integrations.requestBody')}</AppText>
          <NavRow
            first
            label={t('integrations.requestButton')}
            value={t('common.comingSoon')}
            onPress={() =>
              Alert.alert(t('integrations.requestTitle'), t('integrations.requestSoon'))
            }
          />
        </Card>
      </Screen>
    </>
  );
}
