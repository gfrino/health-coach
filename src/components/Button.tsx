import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { haptic } from '@/lib/haptics';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  accessibilityHint,
}: Props) {
  const { colors, radius, spacing } = useTheme();
  const inactive = disabled || loading;

  const bg = {
    primary: colors.primary,
    secondary: colors.surfaceAlt,
    ghost: 'transparent',
    danger: colors.danger,
  }[variant];
  const fg = {
    primary: colors.onPrimary,
    secondary: colors.text,
    ghost: colors.primary,
    danger: colors.background,
  }[variant];

  return (
    <Pressable
      onPress={() => {
        if (variant === 'primary' || variant === 'danger') haptic.press();
        else haptic.tap();
        onPress();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <AppText variant="headline" style={{ color: fg }} align="center">
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 48pt: area di tocco minima consigliata (Apple 44, Material 48).
  base: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
});
