import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { MAX_FONT_SCALE, useTheme } from '@/theme';

import { AppText } from './AppText';

interface Props extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
}

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, hint, error, style, multiline, ...rest },
  ref,
) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="callout" style={{ fontWeight: '600' }}>
        {label}
      </AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textMuted}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        multiline={multiline}
        style={[
          typography.body,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            minHeight: multiline ? 96 : 48,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});
