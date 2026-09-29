import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components';
import { ChatView } from '@/components/chat/ChatView';
import { conversationRepository, getDb } from '@/db';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

/** Chat principale: apre la conversazione indicata (?c=…) oppure la più recente. */
export default function CoachScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const coachName = useSettingsStore((s) => s.settings.coach.name);
  const params = useLocalSearchParams<{ c?: string; new?: string }>();
  const [conversationId, setConversationId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    (async () => {
      if (params.new) return active && setConversationId(null);
      if (params.c) return active && setConversationId(params.c);
      const db = await getDb();
      const latest = (await conversationRepository.listConversations(db))[0];
      if (active) setConversationId(latest?.id ?? null);
    })();
    return () => {
      active = false;
    };
  }, [params.c, params.new]);

  // Pulsanti nell'header: testo più piccolo e margini laterali, dentro la "pillola" di sistema.
  const headerButton = (label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}
    >
      <AppText variant="callout" tone="primary" style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: coachName,
          headerLargeTitle: false,
          headerLeft: () => headerButton(t('chat.history'), () => router.push('/coach/history')),
          headerRight: () =>
            headerButton(t('chat.new'), () =>
              router.setParams({ c: undefined, new: String(Date.now()) }),
            ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: spacing.xs }}>
        {conversationId === undefined ? null : (
          <ChatView
            key={conversationId ?? params.new ?? 'new'}
            conversationId={conversationId}
            onConversationCreated={setConversationId}
          />
        )}
      </View>
    </>
  );
}
