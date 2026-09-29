import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Lista a scelta singola, accessibile come gruppo di radio button. */
export function OptionGroup<T extends string>({ label, options, value, onChange }: Props<T>) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: spacing.sm }}>
      <AppText
        variant="caption"
        tone="textMuted"
        style={{ textTransform: 'uppercase', marginLeft: spacing.xs }}
      >
        {label}
      </AppText>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        {options.map((opt, i) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={selected ? `${opt.label}, ${t('common.selected')}` : opt.label}
              style={({ pressed }) => ({
                minHeight: 48,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              })}
            >
              <AppText style={{ flexShrink: 1 }}>{opt.label}</AppText>
              {selected ? <Icon name="check" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
