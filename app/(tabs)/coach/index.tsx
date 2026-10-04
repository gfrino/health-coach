import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, MenuButton } from '@/components';
import { ChatView } from '@/components/chat/ChatView';
import { summarizePendingConversations } from '@/coach/memory';
import { useSettingsStore } from '@/store/settingsStore';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

/** Chat principale: apre la conversazione indicata (?c=…) oppure la più recente. */
export default function CoachScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const coachName = useSettingsStore((s) => s.settings.coach.name);
  const params = useLocalSearchParams<{ c?: string; new?: string; ask?: string; report?: string }>();
  const [conversationId, setConversationId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    // Conversazione indicata (?c=…, es. dalla Cronologia); altrimenti, anche all'apertura
    // dell'app, una chat nuova: le precedenti restano in "Cronologia".
    void Promise.resolve().then(() => active && setConversationId(params.c ?? null));
    // Le conversazioni concluse diventano memoria del coach (riassunto e fatti sull'utente).
    void summarizePendingConversations(useSettingsStore.getState().settings);
    return () => {
      active = false;
    };
  }, [params.c, params.new]);

  // Pulsanti nell'header: testo più piccolo e margini laterali, dentro la "pillola" di sistema.
  const headerButton = (label: string, onPress: () => void) => (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
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
          headerLeft: () => <MenuButton />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {headerButton(t('chat.history'), () => router.push('/coach/history'))}
              {headerButton(t('chat.new'), () =>
                router.setParams({ c: undefined, new: String(Date.now()) }),
              )}
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: spacing.xs }}>
        {conversationId === undefined ? null : (
          <ChatView
            // Chiave legata alla navigazione, non all'id: quando il primo messaggio crea la
            // conversazione la chat non deve rimontarsi (annullerebbe la risposta in corso).
            key={params.c ?? params.new ?? 'latest'}
            conversationId={conversationId}
            onConversationCreated={setConversationId}
            initialPrompt={params.ask}
            initialReportId={params.report}
          />
        )}
      </View>
    </>
  );
}
