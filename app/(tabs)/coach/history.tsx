import { router, useFocusEffect } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, EmptyState } from '@/components';
import { conversationRepository, getDb } from '@/db';
import type { Conversation } from '@/db/repositories/conversationRepository';
import { useTheme } from '@/theme';

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const [items, setItems] = useState<Conversation[] | null>(null);

  const load = useCallback(async () => {
    const db = await getDb();
    setItems(await conversationRepository.listConversations(db));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const confirmDelete = (c: Conversation) =>
    Alert.alert(t('chat.deleteTitle'), t('chat.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await conversationRepository.deleteConversation(db, c.id);
          await load();
        },
      },
    ]);

  const date = (ms: number) =>
    new Date(ms).toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <>
      <Stack.Screen options={{ title: t('chat.history'), headerLargeTitle: false }} />
      <FlatList
        data={items ?? []}
        keyExtractor={(c) => c.id}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
        ListEmptyComponent={
          items ? (
            <EmptyState
              icon="coach"
              title={t('chat.historyEmptyTitle')}
              body={t('chat.historyEmptyBody')}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.navigate({ pathname: '/coach', params: { c: item.id } })}
            onLongPress={() => confirmDelete(item)}
            accessibilityRole="button"
            accessibilityHint={t('chat.historyItemHint')}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.lg,
              gap: spacing.xs,
            })}
          >
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}
            >
              <AppText variant="headline" style={{ flex: 1 }} numberOfLines={1}>
                {item.kind === 'welcome'
                  ? t('chat.welcomeTitle')
                  : (item.title ?? t('chat.untitled'))}
              </AppText>
              <AppText variant="caption" tone="textMuted">
                {date(item.updatedAt)}
              </AppText>
            </View>
            {item.lastMessage ? (
              <AppText variant="callout" tone="textMuted" numberOfLines={2}>
                {item.lastMessage.replace(/[#*_`>]/g, '')}
              </AppText>
            ) : null}
          </Pressable>
        )}
      />
    </>
  );
}
