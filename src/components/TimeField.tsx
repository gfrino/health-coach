import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MAX_FONT_SCALE, useTheme } from '@/theme';

import { parseTime } from '@/lib/time';

import { AppText } from './AppText';

interface Props {
  label: string;
  /** "HH:MM" (24 ore). */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

/** Ora come due campi numerici (ore : minuti), come DateField: senza moduli nativi. */
export function TimeField({ label, value, onChange, hint }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing, typography } = useTheme();
  // Mentre si scrive vale la bozza; altrimenti il valore ricevuto (che può cambiare da fuori,
  // es. scegliendo un altro pasto).
  const [draft, setDraft] = useState<{ h: string; m: string } | null>(null);
  const [h0 = '', m0 = ''] = value.split(':');
  const hours = draft?.h ?? h0;
  const minutes = draft?.m ?? m0;
  // Ora completa (minuti a due cifre): si salva subito, anche se si preme "Salva" senza uscire dal campo.
  const update = (h: string, m: string) => {
    setDraft({ h, m });
    const v = m.length === 2 ? parseTime(h, m) : null;
    if (v && v !== value) onChange(v);
  };
  const setHours = (h: string) => update(h, minutes);
  const setMinutes = (m: string) => update(hours, m);
  const [error, setError] = useState<string | null>(null);

  const commit = (h: string, m: string) => {
    const v = parseTime(h, m);
    setError(v ? null : t('components.timeInvalid'));
    if (!v) return;
    setDraft(null);
    if (v !== value) onChange(v);
  };

  const field = (val: string, set: (v: string) => void, placeholder: string, a11y: string) => (
    <TextInput
      value={val}
      onChangeText={(v) => set(v.replace(/\D/g, '').slice(0, 2))}
      onEndEditing={() => commit(hours, minutes)}
      keyboardType="number-pad"
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      accessibilityLabel={`${label}, ${a11y}`}
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[
        typography.body,
        {
          width: 64,
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
        {field(hours, setHours, t('components.hh'), t('components.hours'))}
        <AppText tone="textMuted">:</AppText>
        {field(minutes, setMinutes, t('components.min'), t('components.minutes'))}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
