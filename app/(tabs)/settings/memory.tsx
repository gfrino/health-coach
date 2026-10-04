import { useFocusEffect } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, EmptyState, Icon, Screen } from '@/components';
import { getDb, memoryRepository } from '@/db';
import type { MemoryFact } from '@/db/repositories/memoryRepository';
import { haptic } from '@/lib/haptics';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

/** Opzioni → Cosa ricorda il coach: i fatti salvati, uno per uno eliminabili. */
export default function MemoryScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const name = useSettingsStore((s) => s.settings.coach.name);
  const [facts, setFacts] = useState<MemoryFact[] | null>(null);
  const [summaries, setSummaries] = useState(0);

  const load = useCallback(async () => {
    const db = await getDb();
    setFacts(await memoryRepository.listFacts(db));
    setSummaries(await memoryRepository.countSummaries(db));
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const remove = async (id: string) => {
    haptic.select();
    await memoryRepository.deleteFact(await getDb(), id);
    await load();
  };

  const clearAll = () =>
    Alert.alert(t('memory.clearTitle'), t('memory.clearBody', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await memoryRepository.clearMemory(await getDb());
          haptic.success();
          await load();
        },
      },
    ]);

  if (!facts) return null;
  return (
    <>
      <Stack.Screen options={{ title: t('memory.title') }} />
      <Screen>
        <AppText variant="callout" tone="textMuted">
          {t('memory.intro', { name })}
        </AppText>
        {facts.length ? (
          <Card>
            {facts.map((f, i) => (
              <View
                key={f.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <AppText variant="body" style={{ flex: 1 }}>
                  {f.text}
                </AppText>
                <Pressable
                  onPress={() => void remove(f.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.removeItem', { item: f.text })}
                  hitSlop={8}
                  style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="trash" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState
            icon="sparkles"
            title={t('memory.emptyTitle')}
            body={t('memory.emptyBody', { name })}
          />
        )}
        {summaries ? (
          <AppText variant="caption" tone="textMuted">
            {t('memory.summaries', { count: summaries })}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="textMuted">
          {t('memory.privacy')}
        </AppText>
        {facts.length || summaries ? (
          <Button label={t('memory.clear')} variant="danger" onPress={clearAll} />
        ) : null}
      </Screen>
    </>
  );
}
