import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

import { AppText } from '../AppText';
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
}

export function MessageBubble({ role, text, coachName, error, onSpeak, speaking }: Props) {
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
        alignSelf: isUser ? 'flex-end' : 'flex-start',
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
      {/* Il testo è un unico elemento per VoiceOver/TalkBack; il pulsante "Leggi" resta raggiungibile. */}
      <View accessible accessibilityLabel={`${isUser ? t('chat.you') : coachName}: ${text}`}>
        {isUser ? <AppText tone="onPrimary">{text}</AppText> : <Markdown>{text}</Markdown>}
      </View>
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
