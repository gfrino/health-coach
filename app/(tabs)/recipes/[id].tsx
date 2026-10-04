import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Icon,
  Screen,
  TextField,
} from '@/components';
import { getDb, recipeRepository } from '@/db';
import { RECIPE_MEALS, type Recipe, type RecipeMeal } from '@/db/repositories/recipeRepository';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

interface Draft {
  title: string;
  description: string;
  meal: RecipeMeal;
  servings: string;
  minutes: string;
  ingredients: string;
  steps: string;
}

const toDraft = (r: Recipe): Draft => ({
  title: r.title,
  description: r.description ?? '',
  meal: r.meal,
  servings: r.servings ? String(r.servings) : '',
  minutes: r.prepMinutes ? String(r.prepMinutes) : '',
  ingredients: r.ingredients.join('\n'),
  steps: r.steps.join('\n'),
});

/** Prima lettera maiuscola (l'AI a volte scrive tutto minuscolo). */
const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);
const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
const int = (s: string) => {
  const n = Number(s.replace(/\D/g, ''));
  return n > 0 ? n : null;
};

/** Dettaglio ricetta: ingredienti, passaggi, preferita, "l'ho cucinata", modifica ed elimina. */
export default function RecipeScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const params = useLocalSearchParams<{ id: string; edit?: string }>();
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [autoEdited, setAutoEdited] = useState(false);

  const load = useCallback(async () => {
    setRecipe(await recipeRepository.getRecipe(await getDb(), params.id));
  }, [params.id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Ricetta appena creata a mano: si apre subito in modifica (una volta sola).
  if (params.edit && recipe && !autoEdited) {
    setAutoEdited(true);
    setDraft(toDraft(recipe));
  }

  if (recipe === undefined) return null;
  if (recipe === null)
    return (
      <Screen>
        <EmptyState icon="recipes" title={t('recipes.notFound')} body="" />
      </Screen>
    );

  const save = async () => {
    if (!draft) return;
    await recipeRepository.updateRecipe(await getDb(), recipe.id, {
      title: draft.title,
      description: draft.description,
      meal: draft.meal,
      servings: int(draft.servings),
      prepMinutes: int(draft.minutes),
      ingredients: lines(draft.ingredients),
      steps: lines(draft.steps),
    });
    haptic.success();
    setDraft(null);
    await load();
  };

  const toggleFavorite = async () => {
    haptic.select();
    await recipeRepository.updateRecipe(await getDb(), recipe.id, { favorite: !recipe.favorite });
    await load();
  };

  const cooked = async () => {
    await recipeRepository.markCooked(await getDb(), recipe.id);
    haptic.success();
    await load();
  };

  const remove = () =>
    Alert.alert(t('recipes.deleteTitle'), t('recipes.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await recipeRepository.deleteRecipe(await getDb(), recipe.id);
          haptic.success();
          router.back();
        },
      },
    ]);

  const askCoach = () => {
    haptic.tap();
    router.navigate({
      pathname: '/coach',
      params: {
        new: String(Date.now()),
        ask: t('recipes.askCoachPrompt', { title: recipe.title }),
      },
    });
  };

  const meta = [
    recipe.meal !== 'any' ? t(`recipes.meals.${recipe.meal}`) : null,
    recipe.servings ? t('recipes.servingsCount', { count: recipe.servings }) : null,
    recipe.prepMinutes ? t('recipes.minutes', { count: recipe.prepMinutes }) : null,
    recipe.source === 'coach' ? t('recipes.byCoach') : null,
  ].filter(Boolean);

  return (
    <>
      <Stack.Screen
        options={{
          title: draft ? t('recipes.editTitle') : '',
          headerRight: () => (
            <Pressable
              onPress={() => {
                haptic.tap();
                if (draft) void save();
                else setDraft(toDraft(recipe));
              }}
              accessibilityRole="button"
              hitSlop={8}
              style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}
            >
              <AppText variant="callout" tone="primary" style={{ fontWeight: '600' }}>
                {draft ? t('common.done') : t('common.edit')}
              </AppText>
            </Pressable>
          ),
        }}
      />
      <Screen>
        {draft ? (
          <>
            <TextField
              label={t('recipes.titleLabel')}
              value={draft.title}
              onChangeText={(title) => setDraft({ ...draft, title })}
            />
            <TextField
              label={t('recipes.descriptionLabel')}
              value={draft.description}
              onChangeText={(description) => setDraft({ ...draft, description })}
              multiline
            />
            <ChipGroup
              label={t('recipes.meal')}
              value={draft.meal}
              onChange={(meal) => setDraft({ ...draft, meal })}
              options={RECIPE_MEALS.map((m) => ({ value: m, label: t(`recipes.meals.${m}`) }))}
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('recipes.servings')}
                  value={draft.servings}
                  onChangeText={(servings) => setDraft({ ...draft, servings })}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('recipes.minutesLabel')}
                  value={draft.minutes}
                  onChangeText={(minutes) => setDraft({ ...draft, minutes })}
                  keyboardType="number-pad"
                />
              </View>
            </View>
            <TextField
              label={t('recipes.ingredients')}
              hint={t('recipes.onePerLine')}
              value={draft.ingredients}
              onChangeText={(ingredients) => setDraft({ ...draft, ingredients })}
              multiline
            />
            <TextField
              label={t('recipes.steps')}
              hint={t('recipes.onePerLine')}
              value={draft.steps}
              onChangeText={(steps) => setDraft({ ...draft, steps })}
              multiline
            />
            <Button label={t('common.save')} onPress={() => void save()} />
            <Button label={t('common.cancel')} variant="ghost" onPress={() => setDraft(null)} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="title">{recipe.title}</AppText>
                {meta.length ? (
                  <AppText variant="caption" tone="textMuted">
                    {meta.join(' · ')}
                  </AppText>
                ) : null}
              </View>
              <Pressable
                onPress={() => void toggleFavorite()}
                accessibilityRole="button"
                accessibilityState={{ selected: recipe.favorite }}
                accessibilityLabel={t('recipes.favorite')}
                hitSlop={10}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon
                  name={recipe.favorite ? 'heart' : 'heartOutline'}
                  size={24}
                  color={recipe.favorite ? colors.danger : colors.textMuted}
                />
              </Pressable>
            </View>
            {recipe.description ? (
              <AppText variant="body">{cap(recipe.description)}</AppText>
            ) : null}

            <Card>
              <AppText variant="headline">{t('recipes.ingredients')}</AppText>
              {recipe.ingredients.length ? (
                recipe.ingredients.map((x, i) => (
                  <AppText key={`${i}-${x}`} variant="body">
                    • {cap(x)}
                  </AppText>
                ))
              ) : (
                <AppText variant="callout" tone="textMuted">
                  {t('recipes.noIngredients')}
                </AppText>
              )}
            </Card>

            <Card>
              <AppText variant="headline">{t('recipes.steps')}</AppText>
              {recipe.steps.length ? (
                recipe.steps.map((x, i) => (
                  <View key={`${i}-${x}`} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <AppText variant="body" tone="primary" style={{ fontWeight: '700' }}>
                      {i + 1}.
                    </AppText>
                    <AppText variant="body" style={{ flex: 1 }}>
                      {cap(x)}
                    </AppText>
                  </View>
                ))
              ) : (
                <AppText variant="callout" tone="textMuted">
                  {t('recipes.noSteps')}
                </AppText>
              )}
            </Card>

            <Button label={t('recipes.cooked')} onPress={() => void cooked()} />
            {recipe.cookedCount ? (
              <AppText variant="caption" tone="textMuted" align="center">
                {t('recipes.cookedInfo', {
                  count: recipe.cookedCount,
                  date: new Date(recipe.lastCookedAt ?? recipe.updatedAt).toLocaleDateString(
                    i18n.language,
                    { day: 'numeric', month: 'long' },
                  ),
                })}
              </AppText>
            ) : null}
            <Button label={t('recipes.askCoach')} variant="secondary" onPress={askCoach} />
            <Button label={t('recipes.delete')} variant="danger" onPress={remove} />
          </>
        )}
      </Screen>
    </>
  );
}
