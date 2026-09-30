import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { toAIError } from '@/ai/errors';
import { retryLastTurn, runCoachTurn } from '@/coach/chatEngine';
import { conversationRepository, getDb } from '@/db';
import type { StoredMessage } from '@/db/repositories/conversationRepository';
import { resolveLanguage, deviceLanguageCodes } from '@/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { speechLocale } from '@/voice/locale';
import { speak, stopSpeaking } from '@/voice/speak';
import { useVoiceInput } from '@/voice/useVoiceInput';
import { useTheme } from '@/theme';

import { AppText } from '../AppText';
import { EmptyState } from '../EmptyState';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

type Row =
  | { kind: 'message'; message: StoredMessage }
  | { kind: 'pendingUser'; id: string; text: string }
  | { kind: 'streaming'; text: string; tool: string | null };

interface Props {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}

export function ChatView({ conversationId, onConversationCreated }: Props) {
  const { t } = useTranslation();
  const toolLabel = (tool: string) =>
    tool === 'save_journal_entry' ? t('chat.savingJournal') : t('chat.readingData');
  const { spacing } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<{ text: string; tool: string | null } | null>(null);
  const listRef = useRef<FlatList<Row>>(null);
  const locale = speechLocale(resolveLanguage(settings.language, deviceLanguageCodes()));
  // Se l'utente ha parlato, il coach risponde anche a voce.
  const replyByVoice = useRef(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    getDb()
      .then((db) => (conversationId ? conversationRepository.listMessages(db, conversationId) : []))
      .then((list) => active && setMessages(list));
    return () => {
      active = false;
    };
  }, [conversationId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const busy = streaming !== null;

  const run = async (
    fn: (id: string, cb: Parameters<typeof runCoachTurn>[3]) => Promise<unknown>,
    userText?: string,
  ) => {
    let id = conversationId;
    if (!id) {
      const db = await getDb();
      id = await conversationRepository.createConversation(db, {
        provider: settings.ai.provider,
        model: settings.ai.model,
      });
      onConversationCreated(id);
    }
    if (userText) setPendingUser(userText);
    setStreaming({ text: '', tool: null });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await fn(id, {
        signal: controller.signal,
        onText: (text) => setStreaming({ text, tool: null }),
        onToolUse: (tool) => setStreaming((s) => ({ text: s?.text ?? '', tool })),
      });
    } catch (e) {
      // L'errore è salvato sul messaggio (status "error") e mostrato con "Riprova".
      void toAIError(e);
    } finally {
      setPendingUser(null);
      setStreaming(null);
      const db = await getDb();
      const list = await conversationRepository.listMessages(db, id);
      setMessages(list);
      const last = list.at(-1);
      if (
        replyByVoice.current &&
        last?.role === 'assistant' &&
        last.status === 'complete' &&
        last.content
      ) {
        setSpeakingId(last.id);
        speak(last.content, locale, () => setSpeakingId(null));
      }
      replyByVoice.current = false;
    }
  };

  const send = (text: string) => run((id, cb) => runCoachTurn(settings, id, text, cb), text);
  const voice = useVoiceInput(locale, (text) => {
    replyByVoice.current = true;
    void send(text);
  });
  const toggleSpeak = (m: StoredMessage) => {
    if (speakingId === m.id) {
      stopSpeaking();
      setSpeakingId(null);
    } else {
      setSpeakingId(m.id);
      speak(m.content, locale, () => setSpeakingId((cur) => (cur === m.id ? null : cur)));
    }
  };
  const retry = () => run((id, cb) => retryLastTurn(settings, id, cb));

  if (!settings.ai.provider || !settings.ai.model) {
    return (
      <EmptyState
        icon="sparkles"
        title={t('chat.noProviderTitle')}
        body={t('chat.noProviderBody')}
        action={{
          label: t('chat.noProviderAction'),
          onPress: () => router.push('/integrations/ai'),
        }}
      />
    );
  }

  const rows: Row[] = [
    ...messages
      .filter((m) => m.status !== 'streaming' || !busy)
      .map((m): Row => ({ kind: 'message', message: m })),
    ...(pendingUser ? [{ kind: 'pendingUser' as const, id: 'pending', text: pendingUser }] : []),
    ...(streaming ? [{ kind: 'streaming' as const, ...streaming }] : []),
  ];
  const hasUserMessages = messages.some((m) => m.role === 'user') || !!pendingUser;
  const quick = [1, 2, 3, 4].map((i) => t(`chat.quick.${i}` as 'chat.quick.1'));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'message' ? r.message.id : `${r.kind}-${i}`)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              icon="coach"
              title={t('chat.emptyTitle', { name: settings.coach.name })}
              body={t('chat.emptyBody')}
            />
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'pendingUser')
            return <MessageBubble role="user" text={item.text} coachName="" />;
          if (item.kind === 'streaming') {
            return item.text ? (
              <View style={{ gap: spacing.xs }}>
                <MessageBubble role="assistant" text={item.text} coachName={settings.coach.name} />
                {item.tool ? <TypingIndicator label={toolLabel(item.tool)} /> : null}
              </View>
            ) : (
              <TypingIndicator
                label={
                  item.tool ? toolLabel(item.tool) : t('chat.typing', { name: settings.coach.name })
                }
              />
            );
          }
          const m = item.message;
          if (m.status === 'error') {
            return (
              <MessageBubble
                role="assistant"
                text=""
                coachName={settings.coach.name}
                error={{ code: m.errorCode ?? 'unknown', onRetry: retry }}
              />
            );
          }
          if (!m.content) return null;
          return (
            <MessageBubble
              role={m.role}
              text={m.content}
              coachName={settings.coach.name}
              speaking={speakingId === m.id}
              onSpeak={m.role === 'assistant' ? () => toggleSpeak(m) : undefined}
            />
          );
        }}
        ListFooterComponent={
          !hasUserMessages && !busy ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <AppText variant="caption" tone="textMuted">
                {t('chat.quickTitle')}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {quick.map((q) => (
                  <QuickChip key={q} label={q} onPress={() => send(q)} />
                ))}
              </View>
            </View>
          ) : null
        }
      />
      <Composer onSend={send} disabled={busy} voice={voice} />
    </KeyboardAvoidingView>
  );
}

function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        minHeight: 40,
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.primary,
        backgroundColor: pressed ? colors.primarySoft : colors.surface,
      })}
    >
      <AppText variant="callout" tone="primary">
        {label}
      </AppText>
    </Pressable>
  );
}
