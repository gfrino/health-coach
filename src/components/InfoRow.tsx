import { View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

export function InfoRow({ label, value }: { label: string; value: string }) {
  const { spacing } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
        flexWrap: 'wrap',
      }}
    >
      <AppText>{label}</AppText>
      <AppText tone="textMuted">{value}</AppText>
    </View>
  );
}
