import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

interface Props<T extends string> {
  segments: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Selettore a segmenti (accessibile come gruppo di schede). */
export function SegmentedControl<T extends string>({ segments, value, onChange }: Props<T>) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        padding: 3,
      }}
    >
      {segments.map((s) => {
        const selected = s.value === value;
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={s.label}
            style={{
              flex: 1,
              minHeight: 38,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.sm,
              borderRadius: radius.sm,
              backgroundColor: selected ? colors.surface : 'transparent',
            }}
          >
            <AppText
              variant="callout"
              tone={selected ? 'text' : 'textMuted'}
              style={{ fontWeight: selected ? '600' : '400' }}
            >
              {s.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
