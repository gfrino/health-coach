import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { VoiceError } from '@/voice/useVoiceInput';
import { MAX_FONT_SCALE, useTheme } from '@/theme';

import { AppText } from '../AppText';
import { Icon } from '../Icon';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  voice: {
    listening: boolean;
    transcript: string;
    error: VoiceError | null;
    start: () => void;
    stop: () => void;
  };
}

/** Campo di scrittura con microfono: se il campo è vuoto, il pulsante principale è "Parla". */
export function Composer({ onSend, disabled, voice }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography } = useTheme();
  const [text, setText] = useState('');
  const canSend = !disabled && text.trim().length > 0;
  const showMic = !text.trim();

  const send = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  const round = (pressed: boolean, bg: string, enabled: boolean) => ({
    height: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: bg,
    opacity: !enabled ? 0.4 : pressed ? 0.8 : 1,
  });

  if (voice.listening) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}
        accessibilityLiveRegion="polite"
      >
        <View
          style={{
            flex: 1,
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: spacing.md,
          }}
        >
          <AppText variant="caption" tone="primary" style={{ fontWeight: '600' }}>
            {t('voice.listening')}
          </AppText>
          <AppText numberOfLines={3}>{voice.transcript || '…'}</AppText>
        </View>
        <Pressable
          onPress={voice.stop}
          accessibilityRole="button"
          accessibilityLabel={t('voice.stop')}
          style={({ pressed }) => round(pressed, colors.danger, true)}
        >
          <Icon name="stop" color={colors.background} />
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      {voice.error ? (
        <AppText
          variant="caption"
          tone="danger"
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}
        >
          {t(`voice.errors.${voice.error}`)}
        </AppText>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          padding: spacing.sm,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('chat.placeholder')}
          multiline
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[
            typography.body,
            {
              flex: 1,
              maxHeight: 140,
              minHeight: 44,
              color: colors.text,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
              paddingTop: 11,
              paddingBottom: 11,
            },
          ]}
        />
        {showMic ? (
          <Pressable
            onPress={voice.start}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('voice.talk')}
            accessibilityHint={t('voice.talkHint')}
            accessibilityState={{ disabled }}
            style={({ pressed }) => round(pressed, colors.primary, !disabled)}
          >
            <Icon name="mic" color={colors.onPrimary} />
          </Pressable>
        ) : (
          <Pressable
            onPress={send}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
            accessibilityState={{ disabled: !canSend }}
            style={({ pressed }) => round(pressed, colors.primary, canSend)}
          >
            <AppText variant="headline" tone="onPrimary">
              {t('chat.send')}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}
