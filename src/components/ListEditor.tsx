import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { TextField } from './TextField';

interface Props {
  label: string;
  placeholder: string;
  items: { id: string; text: string }[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}

/** Elenco semplice di voci testuali con aggiunta e rimozione. */
export function ListEditor({ label, placeholder, items, onAdd, onRemove }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const [draft, setDraft] = useState('');

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft('');
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label={label}
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        onSubmitEditing={add}
        returnKeyType="done"
        blurOnSubmit={false}
      />
      {draft.trim() ? <Button label={t('common.add')} variant="secondary" onPress={add} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {items.map((it) => (
          <Pressable
            key={it.id}
            onPress={() => onRemove(it.id)}
            accessibilityRole="button"
            accessibilityLabel={t('common.removeItem', { item: it.text })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              minHeight: 36,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: colors.primarySoft,
            }}
          >
            <AppText variant="callout">{it.text}</AppText>
            <AppText variant="callout" tone="textMuted">
              ✕
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
