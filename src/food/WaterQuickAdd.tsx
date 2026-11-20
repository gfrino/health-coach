import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Icon, TextField } from '@/components';
import { getDb } from '@/db';
import { haptic } from '@/lib/haptics';
import { num } from '@/lib/units';
import { parseNumber } from '@/records/labExtraction';
import { useTheme } from '@/theme';

import { addWater, undoLastWater, waterOfDay, waterTime, WATER_PRESETS } from './water';

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
  onClose,
}: {
  day: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const locale = i18n.language;
  const [water, setWater] = useState<{ total: number; manual: number } | null>(null);
  const [other, setOther] = useState('');
  const [added, setAdded] = useState<number | null>(null);

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
    onClose();
  };

  const add = async (ml: number) => {
    if (!(ml > 0 && ml <= 5000)) return;
    await addWater(await getDb(), ml, waterTime(day, new Date()));
    haptic.success();
    setAdded(ml);
    setOther('');
    await load();
  };
  const undo = async () => {
    if (await undoLastWater(await getDb(), day)) haptic.select();
    setAdded(null);
    await load();
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
                  {water ? t('food.water.total', { value: formatWater(water.total, locale) }) : ' '}
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
