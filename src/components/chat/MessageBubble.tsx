import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAIErrorText } from '@/ai/errorText';

import type { MessageAttachment } from '@/db/repositories/conversationRepository';
import { haptic } from '@/lib/haptics';
import { markdownToPlainText } from '@/lib/markdown';
import { useTheme } from '@/theme';

import { AppText } from '../AppText';
import { AttachmentChip } from './AttachmentChip';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Markdown } from '../Markdown';

interface Props {
  role: 'user' | 'assistant';
  text: string;
  coachName: string;
  error?: { code: string; onRetry: () => void } | null;
  onSpeak?: () => void;
  speaking?: boolean;
  attachments?: MessageAttachment[];
  onOpenAttachment?: (a: MessageAttachment) => void;
}

export function MessageBubble({
  role,
  text,
  coachName,
  error,
  onSpeak,
  speaking,
  attachments,
  onOpenAttachment,
}: Props) {
  const { t } = useTranslation();
  const aiErrorText = useAIErrorText();
  const { colors, spacing, radius } = useTheme();
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    await Clipboard.setStringAsync(isUser ? text : markdownToPlainText(text));
    haptic.success();
    setCopied(true);
  };

  if (error) {
    return (
      <View
        style={{
          alignSelf: 'stretch',
          backgroundColor: colors.dangerSoft,
          borderRadius: radius.lg,
          padding: spacing.md,
          gap: spacing.sm,
        }}
        accessibilityLiveRegion="assertive"
      >
        <AppText variant="callout">{aiErrorText(error.code)}</AppText>
        <Button label={t('common.retry')} variant="secondary" onPress={error.onRetry} />
      </View>
    );
  }

  return (
    <View
      style={{
        // Risposte del coach a tutta larghezza: con liste e testo lungo la bolla "a misura di
        // contenuto" calcola male l'altezza e il testo esce dal riquadro.
        alignSelf: isUser ? 'flex-end' : 'stretch',
        maxWidth: isUser ? '85%' : '100%',
        backgroundColor: isUser ? colors.primary : colors.surface,
        borderColor: colors.border,
        borderWidth: isUser ? 0 : 1,
        borderRadius: radius.lg,
        borderBottomRightRadius: isUser ? radius.sm : radius.lg,
        borderBottomLeftRadius: isUser ? radius.lg : radius.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      {attachments?.length ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
            marginBottom: text ? spacing.xs : 0,
          }}
        >
          {attachments.map((a) => (
            <AttachmentChip
              key={a.reportId}
              attachment={a}
              onPrimary={isUser}
              onPress={onOpenAttachment ? () => onOpenAttachment(a) : undefined}
            />
          ))}
        </View>
      ) : null}
      {/* Il testo è un unico elemento per VoiceOver/TalkBack; il pulsante "Leggi" resta raggiungibile. */}
      {text ? (
        <View accessible accessibilityLabel={`${isUser ? t('chat.you') : coachName}: ${text}`}>
          {isUser ? (
            <AppText tone="onPrimary" selectable>
              {text}
            </AppText>
          ) : (
            <Markdown>{text}</Markdown>
          )}
        </View>
      ) : null}
      {/* Azioni sotto le risposte del coach: copia (tutto il messaggio) e leggi ad alta voce.
          Il testo si può anche selezionare con una pressione lunga. */}
      {!isUser && text ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: spacing.md,
            marginTop: spacing.xs,
          }}
        >
          <Pressable
            onPress={() => void copy()}
            accessibilityRole="button"
            accessibilityLabel={copied ? t('chat.copied') : t('chat.copy')}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={15} color={colors.primary} />
            <AppText variant="caption" tone="primary">
              {copied ? t('chat.copied') : t('chat.copy')}
            </AppText>
          </Pressable>
          {onSpeak ? (
            <Pressable
              onPress={onSpeak}
              accessibilityRole="button"
              accessibilityLabel={speaking ? t('voice.stopReading') : t('voice.read')}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}
            >
              <Icon name={speaking ? 'stop' : 'speaker'} size={16} color={colors.primary} />
              <AppText variant="caption" tone="primary">
                {speaking ? t('voice.stopReading') : t('voice.read')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
