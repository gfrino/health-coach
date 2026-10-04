import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, DateField, Screen, TextField } from '@/components';
import { getDb, journalRepository } from '@/db';
import { ENERGY_EMOJI, MOOD_EMOJI, splitList } from '@/features/journal/scale';
import { localIsoDate } from '@/lib/dates';
import { useTheme } from '@/theme';

function Scale({
  label,
  emoji,
  value,
  onChange,
  a11y,
}: {
  label: string;
  emoji: readonly string[];
  value: number | null;
  onChange: (v: number | null) => void;
  a11y: (v: number) => string;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="callout" style={{ fontWeight: '600' }}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {emoji.map((e, i) => {
          const v = i + 1;
          const selected = value === v;
          return (
            <Pressable
              key={e}
              onPress={() => onChange(selected ? null : v)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={a11y(v)}
              style={{
                flex: 1,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primarySoft : colors.surface,
              }}
            >
              <AppText variant="title">{e}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Nuova voce di diario (id "new") o modifica di una esistente. */
export default function JournalEntryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [loaded, setLoaded] = useState(isNew);
  const [date, setDate] = useState<string | null>(localIsoDate(new Date()));
  const [entryAt, setEntryAt] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let active = true;
    getDb()
      .then((db) => journalRepository.getEntry(db, id))
      .then((e) => {
        if (!active || !e) return;
        setDate(localIsoDate(new Date(e.entryAt)));
        setEntryAt(e.entryAt);
        setMood(e.mood);
        setEnergy(e.energy);
        setSymptoms(e.symptoms.join(', '));
        setText(e.text ?? '');
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [id, isNew]);

  if (!loaded) return null;

  const empty = mood == null && energy == null && !text.trim() && !splitList(symptoms).length;

  /** Stesso giorno → orario invariato (o adesso per le nuove voci); altro giorno → mezzogiorno. */
  const timestamp = () => {
    const keep = entryAt ?? Date.now();
    if (!date || date === localIsoDate(new Date(keep))) return keep;
    return new Date(`${date}T12:00:00`).getTime();
  };

  const save = async () => {
    setSaving(true);
    try {
      const db = await getDb();
      const input = {
        entryAt: timestamp(),
        mood,
        energy,
        symptoms: splitList(symptoms),
        text,
      };
      if (isNew) await journalRepository.createEntry(db, input);
      else await journalRepository.updateEntry(db, id, input);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert(t('journal.deleteTitle'), t('journal.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await journalRepository.deleteEntry(db, id);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: isNew ? t('journal.newTitle') : t('journal.editTitle') }} />
      <Screen>
        <DateField label={t('journal.date')} value={date} onChange={setDate} />
        <Scale
          label={t('journal.mood')}
          emoji={MOOD_EMOJI}
          value={mood}
          onChange={setMood}
          a11y={(v) => t('journal.moodA11y', { value: v })}
        />
        <Scale
          label={t('journal.energy')}
          emoji={ENERGY_EMOJI}
          value={energy}
          onChange={setEnergy}
          a11y={(v) => t('journal.energyA11y', { value: v })}
        />
        <TextField
          label={t('journal.symptoms')}
          hint={t('journal.symptomsHint')}
          value={symptoms}
          onChangeText={setSymptoms}
          placeholder={t('journal.symptomsPlaceholder')}
        />
        <TextField
          label={t('journal.note')}
          value={text}
          onChangeText={setText}
          placeholder={t('journal.notePlaceholder')}
          multiline
        />
        <Button label={t('common.save')} onPress={save} loading={saving} disabled={empty} />
        {!isNew ? <Button label={t('common.delete')} variant="danger" onPress={remove} /> : null}
      </Screen>
    </>
  );
}
