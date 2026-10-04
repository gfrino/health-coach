import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, ChipGroup, Screen, TextField } from '@/components';
import { toAIError } from '@/ai/errors';
import { completeOnce } from '@/coach/chatEngine';
import { getDb, recipeRepository } from '@/db';
import { haptic } from '@/lib/haptics';
import { parseRecipe, recipeInstruction } from '@/recipes/generate';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'] as const;
const TIMES = ['15', '30', '60', 'any'] as const;
const SERVINGS = ['1', '2', '4'] as const;

/** Nuova ricetta: la crea il coach (con l'AI scelta) oppure la si scrive da sé. */
export default function NewRecipeScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const hasAI = !!settings.ai.provider && !!settings.ai.model;
  const [meal, setMeal] = useState<(typeof MEALS)[number]>('dinner');
  const [time, setTime] = useState<(typeof TIMES)[number]>('30');
  const [servings, setServings] = useState<(typeof SERVINGS)[number]>('2');
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState<'ai' | 'manual' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = (id: string, edit = false) =>
    router.replace({ pathname: '/recipes/[id]', params: edit ? { id, edit: '1' } : { id } });

  const generate = async () => {
    setBusy('ai');
    setError(null);
    try {
      const text = await completeOnce(
        settings,
        recipeInstruction({
          wish,
          meal,
          maxMinutes: time === 'any' ? null : Number(time),
          servings: Number(servings),
        }),
      );
      const recipe = parseRecipe(text);
      if (!recipe) throw new Error('parse');
      const id = await recipeRepository.createRecipe(
        await getDb(),
        { ...recipe, meal: recipe.meal === 'any' ? meal : recipe.meal },
        'coach',
      );
      haptic.success();
      open(id);
    } catch (e) {
      haptic.error();
      const err = e instanceof Error && e.message === 'parse' ? null : toAIError(e);
      setError(
        err && err.code !== 'unknown'
          ? t(`ai.errors.${err.code}` as 'ai.errors.unknown')
          : t('recipes.generateFailed'),
      );
    } finally {
      setBusy(null);
    }
  };

  const manual = async () => {
    setBusy('manual');
    const id = await recipeRepository.createRecipe(await getDb(), {
      title: wish.trim().split('\n')[0]?.slice(0, 80) || t('recipes.untitled'),
      meal,
      servings: Number(servings),
      prepMinutes: time === 'any' ? null : Number(time),
    });
    setBusy(null);
    open(id, true);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('recipes.new') }} />
      <Screen
        footer={
          <View style={{ gap: spacing.sm }}>
            {hasAI ? (
              <Button
                label={t('recipes.generate', { name: settings.coach.name })}
                onPress={() => void generate()}
                loading={busy === 'ai'}
                disabled={busy !== null}
              />
            ) : null}
            <Button
              label={t('recipes.createManual')}
              variant={hasAI ? 'ghost' : 'primary'}
              onPress={() => void manual()}
              disabled={busy !== null}
            />
          </View>
        }
      >
        <AppText variant="callout" tone="textMuted">
          {hasAI ? t('recipes.newIntro', { name: settings.coach.name }) : t('recipes.newIntroNoAI')}
        </AppText>
        <TextField
          label={t('recipes.wish')}
          value={wish}
          onChangeText={setWish}
          placeholder={t('recipes.wishPlaceholder')}
          multiline
        />
        <ChipGroup
          label={t('recipes.meal')}
          value={meal}
          onChange={setMeal}
          options={MEALS.map((m) => ({ value: m, label: t(`recipes.meals.${m}`) }))}
        />
        <ChipGroup
          label={t('recipes.time')}
          value={time}
          onChange={setTime}
          options={TIMES.map((x) => ({
            value: x,
            label: x === 'any' ? t('recipes.anyTime') : t('recipes.minutes', { count: Number(x) }),
          }))}
        />
        <ChipGroup
          label={t('recipes.servings')}
          value={servings}
          onChange={setServings}
          options={SERVINGS.map((x) => ({ value: x, label: x }))}
        />
        {busy === 'ai' ? (
          <Card tone="soft">
            <AppText variant="callout">
              {t('recipes.generating', { name: settings.coach.name })}
            </AppText>
          </Card>
        ) : null}
        {error ? (
          <Card tone="warning">
            <AppText variant="callout">{error}</AppText>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
