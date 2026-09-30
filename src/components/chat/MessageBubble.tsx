import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MessageAttachment } from '@/db/repositories/conversationRepository';
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
  const { colors, spacing, radius } = useTheme();
  const isUser = role === 'user';

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
        <AppText variant="callout">{t(`ai.errors.${error.code}` as 'ai.errors.unknown')}</AppText>
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
          {isUser ? <AppText tone="onPrimary">{text}</AppText> : <Markdown>{text}</Markdown>}
        </View>
      ) : null}
      {onSpeak ? (
        <Pressable
          onPress={onSpeak}
          accessibilityRole="button"
          accessibilityLabel={speaking ? t('voice.stopReading') : t('voice.read')}
          hitSlop={8}
          style={{
            alignSelf: 'flex-end',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: spacing.xs,
            minHeight: 32,
          }}
        >
          <Icon name={speaking ? 'stop' : 'speaker'} size={16} color={colors.primary} />
          <AppText variant="caption" tone="primary">
            {speaking ? t('voice.stopReading') : t('voice.read')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
