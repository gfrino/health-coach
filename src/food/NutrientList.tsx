import { useState } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, type AppIconName } from '@/components';
import type { FoodTotals } from '@/db/repositories/foodRepository';
import { haptic } from '@/lib/haptics';
import { num } from '@/lib/units';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import {
  BASE_NUTRIENTS,
  BASE_UNITS,
  nutrientReference,
  refStatus,
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
  const trackerLabel = useTrackerLabel();
  const [open, setOpen] = useState(openState);
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

  const fmt = (v: number, unit: string) =>
    `${num(v, locale, v >= 100 || unit === 'mg' ? 0 : 1)} ${unit}`;
  const refLabel = (ref: NutrientRef) =>
    ref.kind === 'min'
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
            const ref = nutrientReference(r.id, profile);
            const status = refStatus(r.value, ref);
            const over = status === 'high';
            const reached = ref?.kind === 'min' && status === 'ok';
            const tone = over ? colors.warning : reached ? colors.success : colors.primary;
            const pct = ref && ref.kind !== 'avoid' ? Math.min(1, r.value / ref.value) : null;
            return (
              <View
                key={r.id}
                accessible
                accessibilityLabel={`${r.label}: ${fmt(r.value, r.unit)}${ref ? `, ${refLabel(ref)}` : ''}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
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
                      <AppText variant="caption" tone="textMuted">
                        {refLabel(ref)}
                      </AppText>
                    </View>
                  ) : null}
                </View>
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
