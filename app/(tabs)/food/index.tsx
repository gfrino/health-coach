import { router, useFocusEffect } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useCallback, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  Card,
  Icon,
  ProgressBar,
  Screen,
  SwitchRow,
  TextField,
} from '@/components';
import { foodRepository, getDb } from '@/db';
import { FOOD_MEALS, type FoodEntry, type FoodMeal } from '@/db/repositories/foodRepository';
import { shiftDay } from '@/food/days';
import { loadCalorieTarget, type CalorieTarget } from '@/food/target';
import { haptic } from '@/lib/haptics';
import { localIsoDate } from '@/lib/dates';
import { num } from '@/lib/units';
import { parseNumber } from '@/records/labExtraction';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

const MEAL_EMOJI: Record<FoodMeal, string> = {
  breakfast: '☀️',
  lunch: '🥗',
  dinner: '🌙',
  snack: '🍎',
};

/** Tab "Cibo": il diario alimentare del giorno, semplice come un quaderno. */
export default function FoodScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const locale = i18n.language;
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const today = localIsoDate(new Date());
  const [day, setDay] = useState(today);
  const [entries, setEntries] = useState<FoodEntry[] | null>(null);
  const [estimated, setEstimated] = useState<CalorieTarget | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  const load = useCallback(async () => {
    const db = await getDb();
    const [list, target] = await Promise.all([
      foodRepository.listDay(db, day),
      loadCalorieTarget(db).catch(() => null),
    ]);
    setEntries(list);
    setEstimated(target);
  }, [day]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const add = (meal?: FoodMeal) => {
    haptic.tap();
    router.push({ pathname: '/food/new', params: { day, ...(meal ? { meal } : {}) } });
  };

  const totals = foodRepository.totals(entries ?? []);
  const custom = settings.food.calorieTarget;
  const target = custom ?? estimated?.kcal ?? null;
  const left = target != null ? target - totals.calories : null;

  const dayLabel =
    day === today
      ? t('food.today')
      : day === shiftDay(today, -1)
        ? t('food.yesterday')
        : new Date(`${day}T12:00:00`).toLocaleDateString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });

  const saveTarget = () => {
    const v = parseNumber(targetInput);
    if (v !== null && v >= 800 && v <= 6000) {
      update({ food: { ...settings.food, calorieTarget: Math.round(v) } });
      haptic.success();
    }
    setEditingTarget(false);
  };

  const dayButton = (icon: 'chevronLeft' | 'chevronRight', label: string, onPress?: () => void) => (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptic.select();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceAlt,
        opacity: onPress ? 1 : 0.35,
      }}
    >
      <Icon name={icon} color={colors.text} size={18} />
    </Pressable>
  );

  const macro = (label: string, grams: number) => (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <AppText variant="headline">{t('food.grams', { value: num(grams, locale, 0) })}</AppText>
      <AppText variant="caption" tone="textMuted">
        {label}
      </AppText>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('tabs.food') }} />
      <Screen
        menu
        title={t('tabs.food')}
        titleAction={
          <Pressable
            onPress={() => add()}
            accessibilityRole="button"
            accessibilityLabel={t('food.addTitle')}
            hitSlop={10}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primarySoft,
            }}
          >
            <Icon name="add" color={colors.primary} />
          </Pressable>
        }
      >
        {/* Giorno */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {dayButton('chevronLeft', t('food.prevDay'), () => setDay(shiftDay(day, -1)))}
          <AppText variant="headline" align="center" style={{ flex: 1 }}>
            {dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}
          </AppText>
          {dayButton(
            'chevronRight',
            t('food.nextDay'),
            day < today ? () => setDay(shiftDay(day, 1)) : undefined,
          )}
        </View>

        {/* Riepilogo */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
            <AppText variant="largeTitle">{num(totals.calories, locale, 0)}</AppText>
            <AppText variant="callout" tone="textMuted">
              {target != null
                ? t('food.ofTarget', { kcal: num(target, locale, 0) })
                : t('food.kcalEaten')}
            </AppText>
          </View>
          {target != null ? (
            <>
              <ProgressBar
                value={totals.calories / target}
                label={t('food.ofTarget', { kcal: num(target, locale, 0) })}
              />
              <AppText
                variant="callout"
                style={{ color: left != null && left < 0 ? colors.warning : colors.textMuted }}
              >
                {left != null && left >= 0
                  ? t('food.remaining', { kcal: num(left, locale, 0) })
                  : t('food.over', { kcal: num(-(left ?? 0), locale, 0) })}
              </AppText>
            </>
          ) : (
            <AppText variant="caption" tone="textMuted">
              {t('food.noTarget')}
            </AppText>
          )}
          <View
            style={{
              flexDirection: 'row',
              paddingTop: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            {macro(t('food.protein'), totals.protein)}
            {macro(t('food.carbs'), totals.carbs)}
            {macro(t('food.fat'), totals.fat)}
          </View>
        </Card>

        {/* Pasti */}
        {FOOD_MEALS.map((meal) => {
          const items = (entries ?? []).filter((e) => e.meal === meal);
          const kcal = foodRepository.totals(items).calories;
          return (
            <Card key={meal}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <AppText variant="headline" style={{ flex: 1 }}>
                  {`${MEAL_EMOJI[meal]}  ${t(`food.meals.${meal}`)}`}
                </AppText>
                {items.length ? (
                  <AppText variant="callout" tone="textMuted">
                    {t('food.kcal', { value: num(kcal, locale, 0) })}
                  </AppText>
                ) : null}
              </View>
              {items.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    haptic.tap();
                    router.push({ pathname: '/food/[id]', params: { id: e.id } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.name}${e.quantity ? `, ${e.quantity}` : ''}, ${e.calories != null ? t('food.kcal', { value: num(e.calories, locale, 0) }) : ''}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.xs,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText>{e.name}</AppText>
                    {e.quantity || e.source === 'coach' ? (
                      <AppText variant="caption" tone="textMuted">
                        {[
                          e.quantity,
                          e.source === 'coach'
                            ? t('food.byCoach', { name: settings.coach.name })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText variant="callout" style={{ fontWeight: '600' }}>
                    {e.calories != null ? num(e.calories, locale, 0) : '–'}
                  </AppText>
                </Pressable>
              ))}
              {!items.length ? (
                <AppText variant="callout" tone="textMuted">
                  {t('food.nothingYet')}
                </AppText>
              ) : null}
              <Button label={t('food.add')} variant="ghost" onPress={() => add(meal)} />
            </Card>
          );
        })}

        {/* Obiettivo e Apple Salute */}
        <Card tone="soft">
          <AppText variant="headline">{t('food.targetTitle')}</AppText>
          {editingTarget ? (
            <>
              <TextField
                label={t('food.targetLabel')}
                value={targetInput}
                onChangeText={setTargetInput}
                keyboardType="number-pad"
                placeholder={estimated ? String(estimated.kcal) : '2000'}
                autoFocus
                onSubmitEditing={saveTarget}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button label={t('common.save')} onPress={saveTarget} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={t('common.cancel')}
                    variant="secondary"
                    onPress={() => setEditingTarget(false)}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <AppText variant="callout">
                {custom
                  ? t('food.targetCustom', { kcal: num(custom, locale, 0) })
                  : estimated
                    ? t('food.targetEstimated', { kcal: num(estimated.kcal, locale, 0) })
                    : t('food.noTarget')}
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={t('food.targetEdit')}
                    variant="secondary"
                    onPress={() => {
                      setTargetInput(custom ? String(custom) : '');
                      setEditingTarget(true);
                    }}
                  />
                </View>
                {custom && estimated ? (
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t('food.targetReset')}
                      variant="ghost"
                      onPress={() => update({ food: { ...settings.food, calorieTarget: null } })}
                    />
                  </View>
                ) : null}
              </View>
            </>
          )}
          {Platform.OS === 'ios' ? (
            <SwitchRow
              label={t('food.writeHealth')}
              description={
                settings.healthSourceConnectedAt
                  ? t('food.writeHealthHint')
                  : t('food.writeHealthNotConnected')
              }
              value={settings.food.writeToHealth}
              // Riaccendendolo, iOS può chiedere di nuovo il permesso al prossimo salvataggio.
              onChange={(v) =>
                void update({
                  food: {
                    ...settings.food,
                    writeToHealth: v,
                    ...(v ? { healthAskedAt: null, healthAskedTypes: null } : {}),
                  },
                })
              }
            />
          ) : null}
        </Card>
      </Screen>
    </>
  );
}
