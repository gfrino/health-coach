import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, ChipGroup, Icon, Screen, TextField } from '@/components';
import { toAIError } from '@/ai/errors';
import { foodRepository, getDb } from '@/db';
import {
  FOOD_MEALS,
  asFoodMeal,
  mealForTime,
  type FoodEntry,
  type FoodMeal,
} from '@/db/repositories/foodRepository';
import { eatenAtFor } from '@/food/days';
import { estimateFood } from '@/food/estimate';
import {
  FoodItemFields,
  emptyDraft,
  fromDraft,
  toDraft,
  type FoodDraft,
} from '@/food/FoodItemFields';
import { syncFoodEntryToHealth } from '@/food/healthWrite';
import { haptic } from '@/lib/haptics';
import { localIsoDate } from '@/lib/dates';
import { num } from '@/lib/units';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

/**
 * Aggiungi cibo: si scrive cosa si è mangiato e l'AI stima calorie e macronutrienti (anche
 * quella del telefono), oppure si inseriscono i valori a mano o si riprende un alimento recente.
 */
export default function NewFoodScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const locale = i18n.language;
  const params = useLocalSearchParams<{ day?: string; meal?: string }>();
  const settings = useSettingsStore((s) => s.settings);
  const hasAI = !!settings.ai.provider && !!settings.ai.model;
  const day = params.day ?? localIsoDate(new Date());
  const [meal, setMeal] = useState<FoodMeal>(
    params.meal ? asFoodMeal(params.meal) : mealForTime(new Date()),
  );
  const [text, setText] = useState('');
  const [items, setItems] = useState<FoodDraft[]>([]);
  /** Alimento aperto per la modifica (gli altri restano una riga semplice). */
  const [open, setOpen] = useState<number | null>(null);
  const [recent, setRecent] = useState<FoodEntry[]>([]);
  const [busy, setBusy] = useState<'ai' | 'save' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void getDb()
      .then((db) => foodRepository.recentFoods(db, 12))
      .then(setRecent);
  }, []);

  const estimate = async () => {
    if (!text.trim()) return;
    setBusy('ai');
    setNotice(null);
    Keyboard.dismiss();
    try {
      const found = await estimateFood(settings, text);
      if (!found.length) setNotice(t('food.estimateNone'));
      else {
        haptic.success();
        setItems((cur) => [...cur, ...found.map(toDraft)]);
        setText('');
      }
    } catch (e) {
      haptic.error();
      const err = toAIError(e);
      setNotice(
        err.code !== 'unknown'
          ? t(`ai.errors.${err.code}` as 'ai.errors.unknown')
          : t('food.estimateFailed'),
      );
    } finally {
      setBusy(null);
    }
  };

  const valid = items.filter((d) => d.name.trim());

  const save = async () => {
    if (!valid.length) return;
    setBusy('save');
    const db = await getDb();
    const eatenAt = eatenAtFor(day, meal);
    const ids: string[] = [];
    for (const d of valid)
      ids.push(await foodRepository.createEntry(db, { ...fromDraft(d), meal, eatenAt }));
    haptic.success();
    // Apple Salute in sottofondo: il diario non aspetta.
    for (const id of ids) void syncFoodEntryToHealth(id);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: t('food.addTitle') }} />
      <Screen
        footer={
          <Button
            label={valid.length ? t('food.saveCount', { count: valid.length }) : t('common.save')}
            onPress={() => void save()}
            loading={busy === 'save'}
            disabled={!valid.length || busy !== null}
          />
        }
      >
        <ChipGroup
          label={t('food.meal')}
          value={meal}
          onChange={setMeal}
          options={FOOD_MEALS.map((m) => ({ value: m, label: t(`food.meals.${m}`) }))}
        />

        {hasAI ? (
          <View style={{ gap: spacing.sm }}>
            <TextField
              label={t('food.whatAte')}
              value={text}
              onChangeText={setText}
              placeholder={t('food.whatAtePlaceholder')}
              multiline
            />
            <Button
              label={t('food.estimate', { name: settings.coach.name })}
              variant={items.length ? 'secondary' : 'primary'}
              onPress={() => void estimate()}
              loading={busy === 'ai'}
              disabled={!text.trim() || busy !== null}
            />
            {notice ? (
              <AppText variant="callout" tone="textMuted">
                {notice}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {items.map((d, i) => (
          <Card key={i}>
            {open === i ? (
              <>
                <FoodItemFields
                  value={d}
                  onChange={(v) => setItems((cur) => cur.map((x, j) => (j === i ? v : x)))}
                />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t('food.done')}
                      variant="secondary"
                      onPress={() => setOpen(null)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t('food.remove')}
                      variant="ghost"
                      onPress={() => {
                        setItems((cur) => cur.filter((_, j) => j !== i));
                        setOpen(null);
                      }}
                    />
                  </View>
                </View>
              </>
            ) : (
              <Pressable
                onPress={() => setOpen(i)}
                accessibilityRole="button"
                accessibilityHint={t('food.tapToEdit')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontWeight: '600' }}>{d.name || t('food.untitled')}</AppText>
                  {d.quantity ? (
                    <AppText variant="caption" tone="textMuted">
                      {d.quantity}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="callout" style={{ fontWeight: '600' }}>
                  {d.calories ? t('food.kcal', { value: d.calories }) : '–'}
                </AppText>
                <Icon name="edit" color={colors.textMuted} size={16} />
              </Pressable>
            )}
          </Card>
        ))}
        {items.length ? (
          <AppText variant="caption" tone="textMuted">
            {t('food.estimateNote')}
          </AppText>
        ) : null}

        <Button
          label={t('food.addManual')}
          variant="ghost"
          onPress={() => {
            setItems((cur) => [...cur, emptyDraft()]);
            setOpen(items.length);
          }}
        />

        {recent.length ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="headline">{t('food.recent')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {recent.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    haptic.select();
                    setItems((cur) => [...cur, toDraft(r)]);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('food.addRecent', { name: r.name })}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <AppText variant="callout">
                    {r.name}
                    {r.calories != null ? (
                      <AppText variant="callout" tone="textMuted">
                        {` · ${num(r.calories, locale, 0)}`}
                      </AppText>
                    ) : null}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </Screen>
    </>
  );
}
