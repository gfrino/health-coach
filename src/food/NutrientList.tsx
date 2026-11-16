import { useState } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Icon, SegmentedControl, TextField, type AppIconName } from '@/components';
import type { FoodTotals } from '@/db/repositories/foodRepository';
import { haptic } from '@/lib/haptics';
import { num } from '@/lib/units';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import {
  BASE_NUTRIENTS,
  BASE_UNITS,
  effectiveReference,
  nutrientReference,
  refStatus,
  type NutrientGoal,
  type NutrientRef,
  type RefProfile,
} from './references';
import { useTrackerLabel } from './TrackerSettings';
import { isCatalogue, NO_TRACKERS } from './trackers';

/** Icona del nutriente: quelle del catalogo hanno la loro, le voci dell'utente un'etichetta. */
export function nutrientIcon(id: string): AppIconName {
  return isCatalogue(id) || (BASE_NUTRIENTS as readonly string[]).includes(id)
    ? (id as AppIconName)
    : 'customTracker';
}

/** Aperto/chiuso resta finché l'app è aperta. */
let openState = false;

/**
 * Valori oltre ai macro (fibre, grassi saturi, sodio e quelli scelti dall'utente) in una lista che
 * si apre con un tocco, con il valore consigliato al giorno accanto e una barra di avanzamento.
 */
export function NutrientList({ totals, profile }: { totals: FoodTotals; profile: RefProfile }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const trackers = useSettingsStore((s) => s.settings.food.trackers ?? NO_TRACKERS);
  const food = useSettingsStore((s) => s.settings.food);
  const update = useSettingsStore((s) => s.update);
  const goals = food.goals;
  const trackerLabel = useTrackerLabel();
  const [open, setOpen] = useState(openState);
  const [editing, setEditing] = useState<string | null>(null);
  const locale = i18n.language;

  const rows = [
    ...BASE_NUTRIENTS.map((id) => ({
      id,
      label: t(`food.nutrients.names.${id}`),
      unit: BASE_UNITS[id],
      value: totals[id],
    })),
    ...trackers.map((tr) => ({
      id: tr.id,
      label: trackerLabel(tr),
      unit: tr.unit,
      value: totals.extras[tr.id] ?? 0,
    })),
  ];

  const toggle = () => {
    haptic.select();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    openState = !open;
    setOpen(!open);
  };

  const edit = (id: string) => {
    haptic.select();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditing(editing === id ? null : id);
  };
  const saveGoal = (id: string, goal: NutrientGoal | null) => {
    const next = { ...goals };
    if (goal) next[id] = goal;
    else delete next[id];
    void update({ food: { ...food, goals: next } });
    haptic.success();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditing(null);
  };

  const fmt = (v: number, unit: string) =>
    `${num(v, locale, v >= 100 || unit === 'mg' ? 0 : 1)} ${unit}`;
  const refLabel = (ref: NutrientRef) =>
    ref.source === 'user'
      ? t(ref.kind === 'min' ? 'food.nutrients.myGoal' : 'food.nutrients.myMax', {
          value: fmt(ref.value, ref.unit),
        })
      : ref.kind === 'min'
        ? t('food.nutrients.min', { value: fmt(ref.value, ref.unit) })
        : ref.kind === 'max'
          ? t('food.nutrients.max', { value: fmt(ref.value, ref.unit) })
          : t('food.nutrients.avoid');

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={t(open ? 'food.nutrients.hide' : 'food.nutrients.show')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 44,
          paddingTop: spacing.xs,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <AppText variant="callout" style={{ flex: 1, fontWeight: '600' }}>
          {t('food.nutrients.title', { count: rows.length })}
        </AppText>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={{ gap: spacing.sm, paddingBottom: spacing.xs }}>
          {rows.map((r) => {
            const ref = effectiveReference(r.id, profile, goals, r.unit);
            const official = nutrientReference(r.id, profile);
            const status = refStatus(r.value, ref);
            const over = status === 'high';
            const reached = ref?.kind === 'min' && status === 'ok';
            const tone = over ? colors.warning : reached ? colors.success : colors.primary;
            const pct = ref && ref.kind !== 'avoid' ? Math.min(1, r.value / ref.value) : null;
            return (
              <View key={r.id} style={{ gap: spacing.sm }}>
                <Pressable
                  onPress={() => edit(r.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.label}: ${fmt(r.value, r.unit)}${ref ? `, ${refLabel(ref)}` : ''}`}
                  accessibilityHint={t('food.nutrients.editHint')}
                  accessibilityState={{ expanded: editing === r.id }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: over ? colors.warningSoft : colors.primarySoft,
                    }}
                  >
                    <Icon
                      name={nutrientIcon(r.id)}
                      size={15}
                      color={over ? colors.warning : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                      <AppText variant="callout" style={{ flex: 1 }} numberOfLines={1}>
                        {r.label}
                      </AppText>
                      <AppText
                        variant="callout"
                        style={{ fontWeight: '600', color: over ? colors.warning : colors.text }}
                      >
                        {fmt(r.value, r.unit)}
                      </AppText>
                    </View>
                    {ref ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        {pct !== null ? (
                          <View
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: radius.pill,
                              backgroundColor: colors.surfaceAlt,
                              overflow: 'hidden',
                            }}
                          >
                            <View
                              style={{
                                width: `${pct * 100}%`,
                                height: '100%',
                                backgroundColor: tone,
                              }}
                            />
                          </View>
                        ) : (
                          <View style={{ flex: 1 }} />
                        )}
                        <AppText
                          variant="caption"
                          tone={ref.source === 'user' ? 'primary' : 'textMuted'}
                        >
                          {refLabel(ref)}
                        </AppText>
                      </View>
                    ) : (
                      <AppText variant="caption" tone="textMuted">
                        {t('food.nutrients.setGoal')}
                      </AppText>
                    )}
                  </View>
                </Pressable>
                {editing === r.id ? (
                  <GoalEditor
                    label={r.label}
                    unit={r.unit}
                    current={ref}
                    official={official}
                    officialLabel={official ? refLabel(official) : null}
                    onSave={(goal) => saveGoal(r.id, goal)}
                    onCancel={() => edit(r.id)}
                  />
                ) : null}
              </View>
            );
          })}
          <AppText variant="caption" tone="textMuted">
            {t('food.nutrients.hint')}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** Obiettivo personale di un valore: da raggiungere o da non superare, o il ritorno a quello consigliato. */
function GoalEditor({
  label,
  unit,
  current,
  official,
  officialLabel,
  onSave,
  onCancel,
}: {
  label: string;
  unit: string;
  current: NutrientRef | null;
  official: NutrientRef | null;
  officialLabel: string | null;
  onSave: (goal: NutrientGoal | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const start: NutrientGoal | null =
    current && current.kind !== 'avoid' ? { kind: current.kind, value: current.value } : null;
  const [kind, setKind] = useState<'min' | 'max'>(
    start?.kind ?? (official?.kind === 'max' || official?.kind === 'avoid' ? 'max' : 'min'),
  );
  const [text, setText] = useState(start ? String(start.value) : '');
  const value = Number(text.replace(',', '.'));
  const valid = text.trim() !== '' && Number.isFinite(value) && value > 0 && value < 1_000_000;
  const custom = current?.source === 'user';

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.primarySoft,
      }}
    >
      <SegmentedControl
        segments={[
          { value: 'min', label: t('food.nutrients.kindMin') },
          { value: 'max', label: t('food.nutrients.kindMax') },
        ]}
        value={kind}
        onChange={setKind}
      />
      <TextField
        label={t('food.nutrients.goalLabel', { name: label, unit })}
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
        returnKeyType="done"
        autoFocus
        onSubmitEditing={() => (valid ? onSave({ kind, value }) : undefined)}
        hint={
          officialLabel
            ? t('food.nutrients.officialHint', { value: officialLabel })
            : t('food.nutrients.noOfficial')
        }
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label={t('common.save')}
            onPress={() => onSave({ kind, value })}
            disabled={!valid}
          />
        </View>
        <View style={{ flex: 1 }}>
          {custom ? (
            <Button
              label={t(official ? 'food.nutrients.reset' : 'food.nutrients.remove')}
              variant="secondary"
              onPress={() => onSave(null)}
            />
          ) : (
            <Button label={t('common.cancel')} variant="secondary" onPress={onCancel} />
          )}
        </View>
      </View>
    </View>
  );
}
