import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

interface Props extends ViewProps {
  children: ReactNode;
  tone?: 'default' | 'soft' | 'warning' | 'danger';
}

export function Card({ children, tone = 'default', style, ...rest }: Props) {
  const { colors, radius, spacing } = useTheme();
  const bg = {
    default: colors.surface,
    soft: colors.primarySoft,
    warning: colors.warningSoft,
    danger: colors.dangerSoft,
  }[tone];
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: spacing.sm,
          borderWidth: tone === 'default' ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
