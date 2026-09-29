import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type AppIconName } from './Icon';

interface Props {
  icon: AppIconName;
  title: string;
  value: string | null;
  subtitle?: string | null;
  emptyText: string;
  chart?: ReactNode;
  children?: ReactNode;
}

export function MetricCard({ icon, title, value, subtitle, emptyText, chart, children }: Props) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name={icon} size={18} color={colors.primary} />
        <AppText variant="callout" tone="textMuted" style={{ fontWeight: '600', flex: 1 }}>
          {title}
        </AppText>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <View
          style={{ flex: 1, gap: 2 }}
          accessible
          accessibilityLabel={`${title}: ${value ?? emptyText}${subtitle ? `, ${subtitle}` : ''}`}
        >
          <AppText variant="title" tone={value ? 'text' : 'textMuted'}>
            {value ?? emptyText}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" tone="textMuted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {chart}
      </View>
      {children}
    </View>
  );
}
