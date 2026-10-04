import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, ChipGroup, Screen } from '@/components';
import { foodRepository, getDb } from '@/db';
import { FOOD_MEALS, type FoodEntry, type FoodMeal } from '@/db/repositories/foodRepository';
import { FoodItemFields, fromDraft, toDraft, type FoodDraft } from '@/food/FoodItemFields';
import { removeFoodEntryFromHealth, syncFoodEntryToHealth } from '@/food/healthWrite';
import { haptic } from '@/lib/haptics';
import { useSettingsStore } from '@/store/settingsStore';

/** Modifica o elimina un alimento del diario (anche quelli registrati dal coach). */
export default function FoodEntryScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const coachName = useSettingsStore((s) => s.settings.coach.name);
  const [entry, setEntry] = useState<FoodEntry | null>(null);
  const [draft, setDraft] = useState<FoodDraft | null>(null);
  const [meal, setMeal] = useState<FoodMeal>('snack');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const e = await foodRepository.getEntry(await getDb(), id);
      setEntry(e);
      if (e) {
        setDraft(toDraft(e));
        setMeal(e.meal);
      }
    })();
  }, [id]);

  if (!entry || !draft) return null;

  const save = async () => {
    const v = fromDraft(draft);
    if (!v.name) return;
    setBusy(true);
    await foodRepository.updateEntry(await getDb(), entry.id, { ...v, meal });
    haptic.success();
    void syncFoodEntryToHealth(entry.id);
    router.back();
  };

  const remove = () =>
    Alert.alert(t('food.deleteTitle'), t('food.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await removeFoodEntryFromHealth(entry);
          await foodRepository.deleteEntry(await getDb(), entry.id);
          haptic.success();
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: t('food.edit') }} />
      <Screen
        footer={
          <Button
            label={t('common.save')}
            onPress={() => void save()}
            loading={busy}
            disabled={!draft.name.trim() || busy}
          />
        }
      >
        <AppText variant="caption" tone="textMuted">
          {[
            new Date(entry.eatenAt).toLocaleString(i18n.language, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }),
            entry.source === 'coach' ? t('food.byCoach', { name: coachName }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        <ChipGroup
          label={t('food.meal')}
          value={meal}
          onChange={setMeal}
          options={FOOD_MEALS.map((m) => ({ value: m, label: t(`food.meals.${m}`) }))}
        />
        <FoodItemFields value={draft} onChange={setDraft} />
        <Button label={t('food.delete')} variant="ghost" onPress={remove} />
      </Screen>
    </>
  );
}
