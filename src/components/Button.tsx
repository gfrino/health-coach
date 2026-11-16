import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { haptic } from '@/lib/haptics';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { ButtonDecor } from './ButtonDecor';
import { Icon, type AppIconName } from './Icon';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  /** Icona a linee prima del testo (stesso stile delle icone dell'app). */
  icon?: AppIconName;
  /** Testo più piccolo, al massimo su due righe (pulsanti affiancati in spazi stretti). */
  compact?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  accessibilityHint,
  icon,
  compact,
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
          // Il principale ha la sfumatura con le foglie (ButtonDecor), tagliata dagli angoli.
          backgroundColor: bg,
          overflow: variant === 'primary' ? 'hidden' : undefined,
          borderRadius: radius.md,
          paddingHorizontal: compact ? spacing.sm : spacing.lg,
          opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {variant === 'primary' ? <ButtonDecor color={colors.primary} /> : null}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : icon ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name={icon} color={fg} size={19} />
          <AppText variant="headline" style={{ color: fg }} align="center">
            {label}
          </AppText>
        </View>
      ) : (
        <AppText
          variant={compact ? 'callout' : 'headline'}
          style={{ color: fg, fontWeight: '600' }}
          align="center"
          numberOfLines={compact ? 2 : undefined}
        >
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
