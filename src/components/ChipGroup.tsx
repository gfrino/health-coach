import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
  leading?: ReactNode;
}

interface Props<T extends string> {
  label?: string;
  options: readonly Option<T>[];
  /** Selezione singola: stringa; multipla: array. */
  value: T | readonly T[];
  onChange: (value: T) => void;
}

/** Scelte compatte a "pillola". Con `description` diventa una lista di card selezionabili. */
export function ChipGroup<T extends string>({ label, options, value, onChange }: Props<T>) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const multi = Array.isArray(value);
  const isSelected = (v: T) => (multi ? (value as readonly T[]).includes(v) : value === v);
  const asCards = options.some((o) => o.description);

  return (
    <View
      style={{ gap: spacing.sm }}
      accessibilityRole={multi ? undefined : 'radiogroup'}
      accessibilityLabel={label}
    >
      {label ? (
        <AppText variant="callout" style={{ fontWeight: '600' }}>
          {label}
        </AppText>
      ) : null}
      <View
        style={
          asCards
            ? { flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm }
            : { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }
        }
      >
        {options.map((o) => {
          const selected = isSelected(o.value);
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole={multi ? 'checkbox' : 'radio'}
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={`${o.label}${o.description ? `. ${o.description}` : ''}${selected ? `, ${t('common.selected')}` : ''}`}
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: 'center',
                alignSelf: asCards ? 'stretch' : 'auto',
                paddingHorizontal: spacing.lg,
                paddingVertical: asCards ? spacing.md : spacing.sm,
                borderRadius: asCards ? radius.md : radius.pill,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected
                  ? colors.primarySoft
                  : pressed
                    ? colors.surfaceAlt
                    : colors.surface,
                gap: 2,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {o.leading}
                <View style={{ flex: o.leading ? 1 : undefined, gap: 2 }}>
                  <AppText variant="callout" style={{ fontWeight: selected ? '600' : '400' }}>
                    {o.label}
                  </AppText>
                  {o.description ? (
                    <AppText variant="caption" tone="textMuted">
                      {o.description}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
