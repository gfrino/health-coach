import { View } from 'react-native';

import { useTheme } from '@/theme';

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const { colors, radius } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{
        height: 6,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceAlt,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.primary }} />
    </View>
  );
}
