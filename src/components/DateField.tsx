import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MAX_FONT_SCALE, useTheme } from '@/theme';

import { toIsoDate } from '@/lib/time';

import { AppText } from './AppText';

interface Props {
  label: string;
  /** YYYY-MM-DD oppure null. */
  value: string | null;
  onChange: (value: string | null) => void;
}

/** Data come tre campi numerici (giorno / mese / anno): semplice e accessibile, senza moduli nativi. */
export function DateField({ label, value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing, typography } = useTheme();
  const [y0, m0, d0] = value?.split('-') ?? [];
  const [day, setDay] = useState(d0 ?? '');
  const [month, setMonth] = useState(m0 ?? '');
  const [year, setYear] = useState(y0 ?? '');
  const [error, setError] = useState<string | null>(null);

  const commit = (d: string, m: string, y: string) => {
    if (!d && !m && !y) {
      setError(null);
      onChange(null);
      return;
    }
    const iso = toIsoDate(d, m, y);
    setError(iso ? null : t('components.dateInvalid'));
    if (iso) onChange(iso);
  };

  const field = (
    val: string,
    set: (v: string) => void,
    placeholder: string,
    a11y: string,
    max: number,
    width: number,
  ) => (
    <TextInput
      value={val}
      onChangeText={(v) => {
        const clean = v.replace(/\D/g, '').slice(0, max);
        set(clean);
      }}
      onEndEditing={() => commit(day, month, year)}
      keyboardType="number-pad"
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      accessibilityLabel={`${label}, ${a11y}`}
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[
        typography.body,
        {
          width,
          textAlign: 'center',
          color: colors.text,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radius.md,
          minHeight: 48,
        },
      ]}
    />
  );

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="callout" style={{ fontWeight: '600' }}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        {field(day, setDay, t('components.dd'), t('components.day'), 2, 64)}
        <AppText tone="textMuted">/</AppText>
        {field(month, setMonth, t('components.mm'), t('components.month'), 2, 64)}
        <AppText tone="textMuted">/</AppText>
        {field(year, setYear, t('components.yyyy'), t('components.year'), 4, 88)}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
