import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, ChipGroup, TextField } from '@/components';
import { num } from '@/lib/units';
import { haptic } from '@/lib/haptics';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import {
  CATALOGUE_IDS,
  catalogueTracker,
  customTracker,
  isCatalogue,
  TRACKER_CATALOGUE,
  type Tracker,
} from './trackers';

/** Nome di una voce nella lingua dell'app (quelle dell'utente come le ha scritte). */
export function useTrackerLabel() {
  const { t } = useTranslation();
  return (tr: Tracker) =>
    isCatalogue(tr.id)
      ? t(`food.trackers.names.${tr.id}` as 'food.trackers.names.fructose')
      : (tr.name ?? tr.id);
}

/** Totali del giorno dei valori tracciati ("Fruttosio 18 g · Caffeina 160 mg"). */
export function TrackedTotals({ extras }: { extras: Record<string, number> }) {
  const { i18n } = useTranslation();
  const trackers = useSettingsStore((s) => s.settings.food.trackers ?? []);
  const label = useTrackerLabel();
  if (!trackers.length) return null;
  return (
    <AppText variant="caption" tone="textMuted">
      {trackers
        .map((tr) => `${label(tr)} ${num(extras[tr.id] ?? 0, i18n.language, 1)} ${tr.unit}`)
        .join(' · ')}
    </AppText>
  );
}

/**
 * Scelta dei valori in più da tracciare: catalogo (fruttosio, caffeina, alcol…) e voci scritte
 * dall'utente. L'AI li stima per ogni alimento e il coach li considera.
 */
export function TrackerSettings() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const food = useSettingsStore((s) => s.settings.food);
  const update = useSettingsStore((s) => s.update);
  const label = useTrackerLabel();
  const trackers = food.trackers ?? [];
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('g');

  const save = (next: Tracker[]) => void update({ food: { ...food, trackers: next } });
  const toggle = (id: string) => {
    haptic.select();
    if (trackers.some((x) => x.id === id)) save(trackers.filter((x) => x.id !== id));
    else if (isCatalogue(id)) save([...trackers, catalogueTracker(id)]);
  };
  const addCustom = () => {
    const tr = customTracker(name, unit);
    if (!tr || trackers.some((x) => x.id === tr.id)) return;
    haptic.success();
    save([...trackers, tr]);
    setName('');
  };
  const customs = trackers.filter((x) => !isCatalogue(x.id));

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="headline">{t('food.trackers.title')}</AppText>
      <AppText variant="caption" tone="textMuted">
        {t('food.trackers.hint')}
      </AppText>
      <ChipGroup
        value={trackers.map((x) => x.id)}
        onChange={toggle}
        options={[
          ...CATALOGUE_IDS.map((id) => ({
            value: id as string,
            label: `${label({ id, unit: '' })} (${TRACKER_CATALOGUE[id].unit})`,
          })),
          ...customs.map((x) => ({ value: x.id, label: `${label(x)} (${x.unit})` })),
        ]}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
        <View style={{ flex: 3 }}>
          <TextField
            label={t('food.trackers.customName')}
            value={name}
            onChangeText={setName}
            placeholder={t('food.trackers.customPlaceholder')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label={t('food.trackers.unit')} value={unit} onChangeText={setUnit} />
        </View>
      </View>
      <Button
        label={t('food.trackers.add')}
        variant="secondary"
        onPress={addCustom}
        disabled={!name.trim()}
      />
    </View>
  );
}
