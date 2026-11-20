import { router, useFocusEffect } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useCallback, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  Card,
  Icon,
  type AppIconName,
  ProgressBar,
  Screen,
  SourcesLink,
  SwitchRow,
  TextField,
} from '@/components';
import { foodRepository, getDb, profileRepository } from '@/db';
import { FOOD_MEALS, type FoodEntry, type FoodMeal } from '@/db/repositories/foodRepository';
import { shiftDay } from '@/food/days';
import { macroGuide } from '@/food/macroGuide';
import { loadFoodTargets, type CalorieTarget, type ProteinTarget } from '@/food/target';
import { NutrientList } from '@/food/NutrientList';
import { ageFrom, effectiveReference, nutrientReference, type RefProfile } from '@/food/references';
import { TrackerSettings } from '@/food/TrackerSettings';
import { canWriteToHealthHere } from '@/food/healthWrite';
import { WaterBar, WaterQuickAdd } from '@/food/WaterQuickAdd';
import { defaultWaterTarget, waterOfDay } from '@/food/water';
import { haptic } from '@/lib/haptics';
import { localIsoDate } from '@/lib/dates';
import { num } from '@/lib/units';
import { parseNumber } from '@/records/labExtraction';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

const MEAL_ICONS: Record<FoodMeal, AppIconName> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
};

/** Valore che apre una chat nuova nel coach (cambia a ogni tocco). */
const newChatId = () => String(Date.now());

type MacroKey = 'protein' | 'carbs' | 'sugar' | 'fat';

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
  const [protein, setProtein] = useState<ProteinTarget | null>(null);
  const [person, setPerson] = useState<Pick<RefProfile, 'sex' | 'age'>>({ sex: null, age: null });
  const [editingTarget, setEditingTarget] = useState(false);
  const [explain, setExplain] = useState<MacroKey | null>(null);
  const [targetInput, setTargetInput] = useState('');
  const [waterOpen, setWaterOpen] = useState(false);
  const [water, setWater] = useState(0);

  const load = useCallback(async () => {
    const db = await getDb();
    const [list, targets, profile, drunk] = await Promise.all([
      foodRepository.listDay(db, day),
      loadFoodTargets(db).catch(() => ({ calories: null, protein: null })),
      profileRepository.getProfile(db),
      waterOfDay(db, day).catch(() => ({ total: 0, manual: 0 })),
    ]);
    setEntries(list);
    setWater(drunk.total);
    setEstimated(targets.calories);
    setProtein(targets.protein);
    setPerson({ sex: profile.sex, age: ageFrom(profile.birthDate, localIsoDate(new Date())) });
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
  const waterDefault = defaultWaterTarget(person.sex);
  const waterTarget = settings.food.waterTarget ?? waterDefault;
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

  /** Riquadro di un macronutriente: icona, valore, barra e una riga di dettaglio. */
  const macro = (o: {
    key: MacroKey;
    icon: AppIconName;
    label: string;
    grams: number;
    /** Obiettivo in grammi (solo proteine). */
    of?: number | null;
    /** Riempimento della barra (0–1), null = nessuna barra. */
    bar: number | null;
    barColor?: string;
    detail: string;
    detailColor?: string;
  }) => (
    <Pressable
      onPress={() => {
        haptic.select();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExplain(explain === o.key ? null : o.key);
      }}
      accessibilityRole="button"
      accessibilityState={{ expanded: explain === o.key }}
      accessibilityHint={t('food.macroInfo.hint')}
      accessibilityLabel={`${o.label}: ${t('food.grams', { value: num(o.grams, locale, 0) })}${o.of ? ` / ${t('food.grams', { value: num(o.of, locale, 0) })}` : ''}, ${o.detail}`}
      style={({ pressed }) => ({
        flex: 1,
        gap: 6,
        padding: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: explain === o.key ? colors.primary : 'transparent',
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
            backgroundColor: colors.primarySoft,
          }}
        >
          <Icon name={o.icon} size={13} color={colors.primary} />
        </View>
        <AppText variant="caption" tone="textMuted" numberOfLines={1} style={{ flex: 1 }}>
          {o.label}
        </AppText>
        <Icon name="info" size={12} color={colors.textMuted} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <AppText variant="headline">{num(o.grams, locale, 0)}</AppText>
        <AppText variant="caption" tone="textMuted" numberOfLines={1}>
          {o.of ? ` / ${num(o.of, locale, 0)} g` : ' g'}
        </AppText>
      </View>
      <View
        style={{
          height: 4,
          borderRadius: radius.pill,
          backgroundColor: o.bar !== null ? colors.border : 'transparent',
          overflow: 'hidden',
        }}
      >
        {o.bar !== null ? (
          <View
            style={{
              width: `${Math.max(0, Math.min(1, o.bar)) * 100}%`,
              height: '100%',
              backgroundColor: o.barColor ?? colors.primary,
            }}
          />
        ) : null}
      </View>
      <AppText
        variant="caption"
        numberOfLines={1}
        style={{ fontSize: 11, color: o.detailColor ?? colors.textMuted }}
      >
        {o.detail}
      </AppText>
    </Pressable>
  );

  const askCoach = () => {
    haptic.tap();
    router.navigate({
      pathname: '/coach',
      params: {
        new: newChatId(),
        ask:
          day === today
            ? t('food.askCoachPrompt')
            : t('food.askCoachPromptDay', { day: dayLabel.toLowerCase(), date: day }),
      },
    });
  };

  const proteinLeft = protein ? protein.grams - totals.protein : null;
  const refProfile: RefProfile = { ...person, kcal: target };
  // Riferimenti secondo la dieta scelta per il coach (keto: carboidrati netti, grassi come energia…).
  const diet = settings.coach.nutritionApproach;
  const dietName = t(`coachSetup.nutritionOptions.${diet}`);
  const guide = macroGuide(diet, target, protein?.grams ?? null);
  const carbsShown = guide.carbs.net ? Math.max(0, totals.carbs - totals.fiber) : totals.carbs;
  const carbsOver = carbsShown > guide.carbs.max;
  const sugarMax = guide.sugar.max;
  const freeSugarMax = nutrientReference('addedSugar', refProfile)!.value;
  // I saturati seguono l'obiettivo dell'utente se l'ha cambiato in "Altri valori".
  const satMax = effectiveReference('saturatedFat', refProfile, settings.food.goals, 'g')!.value;
  const sugarOver = totals.sugar > sugarMax;
  const satOver = totals.saturatedFat > satMax;
  const fatRef = guide.fat.max ?? guide.fat.target ?? 0;
  const fatOver = guide.fat.max != null && totals.fat > guide.fat.max;
  const energyPct = (grams: number, kcalPerGram: number) =>
    totals.calories > 0 ? Math.round(((grams * kcalPerGram) / totals.calories) * 100) : 0;
  const g = (v: number) => num(v, locale, 0);
  const explanation: Record<MacroKey, string[]> = {
    protein: protein
      ? [
          t('food.macroInfo.protein', {
            grams: g(totals.protein),
            target: g(protein.grams),
            perKg: num(protein.perKg, locale, 2),
          }),
          t(`food.macroInfo.proteinBasis.${protein.basis}`),
        ]
      : [t('food.macroInfo.proteinNoTarget', { grams: g(totals.protein) })],
    carbs: [
      t(`food.macroInfo.carbsBasis.${guide.carbs.basis}`, {
        grams: g(carbsShown),
        pct: energyPct(totals.carbs, 4),
        min: g(guide.carbs.min ?? 0),
        max: g(guide.carbs.max),
        diet: dietName,
      }),
    ],
    sugar: [
      t(`food.macroInfo.sugarBasis.${guide.sugar.basis}`, {
        sugar: g(totals.sugar),
        max: g(sugarMax),
        diet: dietName,
      }),
      ...(guide.sugar.basis === 'eu'
        ? [t('food.macroInfo.freeSugar', { free: g(freeSugarMax) })]
        : []),
    ],
    fat: [
      t(`food.macroInfo.fatBasis.${guide.fat.basis}`, {
        grams: g(totals.fat),
        pct: energyPct(totals.fat, 9),
        max: g(fatRef),
        diet: dietName,
      }),
      t('food.macroInfo.saturated', { sat: g(totals.saturatedFat), max: g(satMax) }),
      ...(guide.fat.basis === 'fuel'
        ? [t('food.macroInfo.saturatedLowCarb', { diet: dietName })]
        : []),
    ],
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('tabs.food') }} />
      <Screen
        menu
        title={t('tabs.food')}
        titleAction={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={() => {
                haptic.tap();
                setWaterOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('food.water.open')}
              hitSlop={6}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.primarySoft,
              }}
            >
              <Icon name="water" size={20} color={colors.primary} />
            </Pressable>
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
          </View>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: left != null && left < 0 ? colors.warningSoft : colors.primarySoft,
              }}
            >
              <Icon
                name="flame"
                size={20}
                color={left != null && left < 0 ? colors.warning : colors.primary}
              />
            </View>
            <View
              style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}
            >
              <AppText variant="largeTitle">{num(totals.calories, locale, 0)}</AppText>
              <AppText
                variant="callout"
                tone="textMuted"
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {target != null
                  ? t('food.ofTarget', { kcal: num(target, locale, 0) })
                  : t('food.kcalEaten')}
              </AppText>
            </View>
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
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {macro({
                key: 'protein',
                icon: 'protein',
                label: t('food.protein'),
                grams: totals.protein,
                of: protein?.grams,
                bar: protein ? totals.protein / protein.grams : null,
                barColor: proteinLeft != null && proteinLeft <= 0 ? colors.success : colors.primary,
                detail:
                  proteinLeft == null
                    ? t('food.proteinNoTarget')
                    : proteinLeft > 0
                      ? t('food.proteinLeft', { value: g(proteinLeft) })
                      : t('food.proteinDone'),
                detailColor: proteinLeft != null && proteinLeft <= 0 ? colors.success : undefined,
              })}
              {macro({
                key: 'carbs',
                icon: 'carbs',
                label: t(guide.carbs.net ? 'food.netCarbs' : 'food.carbs'),
                grams: carbsShown,
                of: guide.carbs.strict ? guide.carbs.max : null,
                bar: carbsShown / guide.carbs.max,
                barColor: carbsOver
                  ? guide.carbs.strict
                    ? colors.danger
                    : colors.warning
                  : undefined,
                detail: guide.carbs.strict
                  ? carbsOver
                    ? t('food.overLimit', { value: g(carbsShown - guide.carbs.max) })
                    : t('food.limitLeft', { value: g(guide.carbs.max - carbsShown) })
                  : t('food.energyShare', { pct: energyPct(totals.carbs, 4) }),
                detailColor: carbsOver && guide.carbs.strict ? colors.danger : undefined,
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {macro({
                key: 'sugar',
                icon: 'addedSugar',
                label: t('food.sugars'),
                grams: totals.sugar,
                of: sugarMax,
                bar: totals.sugar / sugarMax,
                barColor: sugarOver ? colors.danger : colors.primary,
                detail: sugarOver
                  ? t('food.overLimit', { value: g(totals.sugar - sugarMax) })
                  : t('food.limitLeft', { value: g(sugarMax - totals.sugar) }),
                detailColor: sugarOver ? colors.danger : undefined,
              })}
              {macro({
                key: 'fat',
                icon: 'fat',
                label: t('food.fat'),
                grams: totals.fat,
                bar: fatRef > 0 ? totals.fat / fatRef : null,
                barColor: fatOver ? colors.warning : colors.primary,
                detail: t('food.saturatedOf', { value: g(totals.saturatedFat) }),
                detailColor: satOver ? colors.danger : undefined,
              })}
            </View>
          </View>
          {explain ? (
            <View
              style={{
                gap: spacing.xs,
                padding: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: colors.primarySoft,
              }}
            >
              {explanation[explain].map((line) => (
                <AppText key={line} variant="callout">
                  {line}
                </AppText>
              ))}
            </View>
          ) : null}
          <WaterBar total={water} target={waterTarget} onPress={() => setWaterOpen(true)} />
          <NutrientList totals={totals} profile={refProfile} />
          <Button label={t('food.askCoach')} icon="coach" variant="secondary" onPress={askCoach} />
          <SourcesLink topic="energy" />
        </Card>

        {/* Pasti */}
        {FOOD_MEALS.map((meal) => {
          const items = (entries ?? []).filter((e) => e.meal === meal);
          const kcal = foodRepository.totals(items).calories;
          return (
            <Card key={meal}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Icon name={MEAL_ICONS[meal]} size={16} color={colors.primary} />
                </View>
                <AppText variant="headline" style={{ flex: 1 }}>
                  {t(`food.meals.${meal}`)}
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
              {!custom && estimated?.adjustment ? (
                <AppText variant="caption" tone="textMuted">
                  {estimated.paceKgWeek
                    ? t(estimated.adjustment < 0 ? 'food.targetPaceLose' : 'food.targetPaceGain', {
                        kcal: num(Math.abs(estimated.adjustment), locale, 0),
                        pace: num(estimated.paceKgWeek, locale, 2),
                      })
                    : t(estimated.adjustment < 0 ? 'food.targetDeficit' : 'food.targetSurplus', {
                        kcal: num(Math.abs(estimated.adjustment), locale, 0),
                      })}
                </AppText>
              ) : null}
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
          {canWriteToHealthHere() ? (
            <SwitchRow
              label={t(Platform.OS === 'ios' ? 'food.writeHealth' : 'food.writeHealthAndroid')}
              description={
                settings.healthSourceConnectedAt
                  ? t('food.writeHealthHint')
                  : t(
                      Platform.OS === 'ios'
                        ? 'food.writeHealthNotConnected'
                        : 'food.writeHealthNotConnectedAndroid',
                    )
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
        <Card>
          <TrackerSettings />
        </Card>
      </Screen>
      <WaterQuickAdd
        day={day}
        visible={waterOpen}
        defaultTarget={waterDefault}
        onClose={() => setWaterOpen(false)}
        onChange={() => void load()}
      />
    </>
  );
}
