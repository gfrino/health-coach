import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Icon, TextField } from '@/components';
import { getDb } from '@/db';
import { haptic } from '@/lib/haptics';
import { num } from '@/lib/units';
import { parseNumber } from '@/records/labExtraction';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import { removeWaterFromHealth, writeWaterToHealth } from './healthWrite';
import {
  addWater,
  setWaterHealthSample,
  undoLastWater,
  waterOfDay,
  waterTime,
  WATER_PRESETS,
} from './water';

/** "800 ml" o "1,2 L". */
export function formatWater(ml: number, locale: string): string {
  return ml < 1000 ? `${num(ml, locale, 0)} ml` : `${num(ml / 1000, locale, ml % 1000 ? 2 : 0)} L`;
}

/**
 * Popup dell'acqua: un tocco su una quantità la aggiunge al giorno mostrato. Resta aperto per
 * aggiungerne altre e per vedere il totale; "Annulla l'ultima" corregge un tocco sbagliato.
 */
export function WaterQuickAdd({
  day,
  visible,
  defaultTarget,
  onClose,
  onChange,
}: {
  day: string;
  visible: boolean;
  /** Obiettivo stimato dall'app (EFSA), usato se l'utente non ne ha scelto uno. */
  defaultTarget: number;
  onClose: () => void;
  /** Dopo ogni aggiunta o annullamento: chi mostra la barra ricarica il totale. */
  onChange?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const locale = i18n.language;
  const [water, setWater] = useState<{ total: number; manual: number } | null>(null);
  const [other, setOther] = useState('');
  const [added, setAdded] = useState<number | null>(null);
  const food = useSettingsStore((st) => st.settings.food);
  const update = useSettingsStore((st) => st.update);
  const custom = food.waterTarget ?? null;
  const target = custom ?? defaultTarget;
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetText, setTargetText] = useState('');
  // Fino a 10 si intende in litri ("2,5"), oltre in ml ("2500").
  const targetValue = (() => {
    const v = parseNumber(targetText);
    if (v === null || v <= 0) return null;
    const ml = Math.round(v <= 10 ? v * 1000 : v);
    return ml >= 500 && ml <= 6000 ? ml : null;
  })();
  const saveTarget = (ml: number | null) => {
    void update({ food: { ...food, waterTarget: ml } });
    haptic.success();
    setEditingTarget(false);
  };

  const load = useCallback(async () => {
    setWater(await waterOfDay(await getDb(), day));
  }, [day]);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void getDb()
      .then((db) => waterOfDay(db, day))
      .then((w) => {
        if (alive) setWater(w);
      });
    return () => {
      alive = false;
    };
  }, [visible, day]);
  // Alla chiusura si azzera, così alla riapertura non resta l'ultima aggiunta.
  const close = () => {
    setAdded(null);
    setOther('');
    setEditingTarget(false);
    onClose();
  };

  const add = async (ml: number) => {
    if (!(ml > 0 && ml <= 5000)) return;
    const db = await getDb();
    const at = waterTime(day, new Date());
    const id = await addWater(db, ml, at);
    haptic.success();
    // Anche in Apple Salute, in background: il popup non aspetta.
    if (id) {
      void writeWaterToHealth(id, ml, at).then((uuid) =>
        uuid ? setWaterHealthSample(db, id, uuid) : undefined,
      );
    }
    setAdded(ml);
    setOther('');
    await load();
    onChange?.();
  };
  const undo = async () => {
    const removed = await undoLastWater(await getDb(), day);
    if (removed) {
      haptic.select();
      if (removed.healthUuid) void removeWaterFromHealth(removed.healthUuid);
    }
    setAdded(null);
    await load();
    onChange?.();
  };
  const otherMl = parseNumber(other);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t('food.water.close')}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Pressable
            // Il tocco dentro il riquadro non chiude il popup.
            onPress={() => undefined}
            accessible={false}
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              paddingBottom: spacing.xl,
              gap: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.primarySoft,
                }}
              >
                <Icon name="water" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="headline">{t('food.water.title')}</AppText>
                <AppText variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
                  {water
                    ? t('food.water.totalOf', {
                        value: formatWater(water.total, locale),
                        target: formatWater(target, locale),
                      })
                    : ' '}
                  {added
                    ? ` · ${t('food.water.added', { value: formatWater(added, locale) })}`
                    : ''}
                </AppText>
              </View>
              {water && water.manual > 0 ? (
                <Pressable
                  onPress={() => void undo()}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    minHeight: 44,
                    opacity: pressed ? 0.5 : 1,
                  })}
                >
                  <Icon name="undo" size={13} color={colors.primary} />
                  <AppText variant="callout" tone="primary" style={{ fontWeight: '600' }}>
                    {t('food.water.undo')}
                  </AppText>
                </Pressable>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {WATER_PRESETS.map((p, i) => (
                <Pressable
                  key={p.key}
                  onPress={() => void add(p.ml)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(`food.water.presets.${p.key}`)}, ${formatWater(p.ml, locale)}`}
                  style={({ pressed }) => ({
                    flexBasis: '31%',
                    flexGrow: 1,
                    alignItems: 'center',
                    gap: 4,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceAlt,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View style={{ height: 28, justifyContent: 'center' }}>
                    {/* La goccia cresce con la quantità. */}
                    <Icon name="water" size={14 + i * 2.5} color={colors.primary} />
                  </View>
                  <AppText variant="callout" style={{ fontWeight: '600' }} numberOfLines={1}>
                    {t(`food.water.presets.${p.key}`)}
                  </AppText>
                  <AppText variant="caption" tone="textMuted">
                    {formatWater(p.ml, locale)}
                  </AppText>
                </Pressable>
              ))}
            </View>

            {editingTarget ? (
              <View style={{ gap: spacing.sm }}>
                <TextField
                  label={t('food.water.targetLabel')}
                  value={targetText}
                  onChangeText={setTargetText}
                  keyboardType="decimal-pad"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => (targetValue ? saveTarget(targetValue) : undefined)}
                  hint={t('food.water.targetHint', { value: formatWater(defaultTarget, locale) })}
                />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t('common.save')}
                      onPress={() => (targetValue ? saveTarget(targetValue) : undefined)}
                      disabled={!targetValue}
                      compact
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    {custom !== null ? (
                      <Button
                        label={t('food.nutrients.reset')}
                        variant="secondary"
                        onPress={() => saveTarget(null)}
                        compact
                      />
                    ) : (
                      <Button
                        label={t('common.cancel')}
                        variant="secondary"
                        onPress={() => setEditingTarget(false)}
                        compact
                      />
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  haptic.select();
                  setTargetText(num(target / 1000, locale, target % 1000 ? 1 : 0));
                  setEditingTarget(true);
                }}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  minHeight: 44,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <AppText variant="callout" style={{ flex: 1 }}>
                  {t(custom !== null ? 'food.water.targetMine' : 'food.water.targetEfsa', {
                    value: formatWater(target, locale),
                  })}
                </AppText>
                <Icon name="edit" size={13} color={colors.primary} />
                <AppText variant="callout" tone="primary" style={{ fontWeight: '600' }}>
                  {t('food.water.targetEdit')}
                </AppText>
              </Pressable>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('food.water.other')}
                  value={other}
                  onChangeText={setOther}
                  keyboardType="number-pad"
                  placeholder="300"
                  returnKeyType="done"
                  onSubmitEditing={() => (otherMl ? void add(otherMl) : undefined)}
                />
              </View>
              <Button
                label={t('food.water.add')}
                variant="secondary"
                onPress={() => (otherMl ? void add(otherMl) : undefined)}
                disabled={!otherMl || otherMl <= 0 || otherMl > 5000}
              />
            </View>

            <Button label={t('common.done')} onPress={close} />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

/**
 * Barra blu dell'acqua sotto i riquadri dei macro: bevuta del giorno verso l'obiettivo. Un tocco
 * apre il popup (aggiunte rapide e obiettivo).
 */
export function WaterBar({
  total,
  target,
  onPress,
}: {
  total: number;
  target: number;
  onPress: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const locale = i18n.language;
  const blue = colors.info;
  const done = total >= target;
  const detail = done
    ? t('food.water.reached')
    : t('food.water.left', { value: formatWater(target - total, locale) });
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${t('food.water.title')}: ${formatWater(total, locale)} / ${formatWater(target, locale)}, ${detail}`}
      accessibilityHint={t('food.water.open')}
      style={({ pressed }) => ({
        gap: 6,
        padding: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceAlt,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            // Blu tenue: il colore "info" del tema con trasparenza (va bene in chiaro e in scuro).
            backgroundColor: `${blue}2E`,
          }}
        >
          <Icon name="water" size={13} color={blue} />
        </View>
        <AppText variant="caption" tone="textMuted" style={{ flex: 1 }}>
          {t('food.water.title')}
        </AppText>
        <AppText variant="headline">{formatWater(total, locale)}</AppText>
        <AppText variant="caption" tone="textMuted">
          {` / ${formatWater(target, locale)}`}
        </AppText>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: radius.pill,
          backgroundColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(0, Math.min(1, total / target)) * 100}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: blue,
          }}
        />
      </View>
      <AppText variant="caption" style={{ fontSize: 11, color: done ? blue : colors.textMuted }}>
        {detail}
      </AppText>
    </Pressable>
  );
}
