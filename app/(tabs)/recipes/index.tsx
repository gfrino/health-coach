import { router, useFocusEffect } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, ChipGroup, EmptyState, Icon, Screen } from '@/components';
import { getDb, recipeRepository } from '@/db';
import type { Recipe, RecipeMeal } from '@/db/repositories/recipeRepository';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

type Filter = 'all' | 'favorites' | Exclude<RecipeMeal, 'any'>;
const FILTERS: Filter[] = ['all', 'favorites', 'breakfast', 'lunch', 'dinner', 'snack', 'dessert'];

/** Tab "Ricette": create dal coach o scritte dall'utente, sempre su misura. */
export default function RecipesScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    setRecipes(await recipeRepository.listRecipes(await getDb()));
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const create = () => {
    haptic.tap();
    router.push('/recipes/new');
  };
  const toggleFavorite = async (r: Recipe) => {
    haptic.select();
    await recipeRepository.updateRecipe(await getDb(), r.id, { favorite: !r.favorite });
    await load();
  };

  const shown = (recipes ?? []).filter((r) =>
    filter === 'all' ? true : filter === 'favorites' ? r.favorite : r.meal === filter,
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('tabs.recipes') }} />
      <Screen
        menu
        title={t('tabs.recipes')}
        titleAction={
          <Pressable
            onPress={create}
            accessibilityRole="button"
            accessibilityLabel={t('recipes.new')}
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
        {recipes === null ? null : recipes.length === 0 ? (
          <EmptyState
            icon="recipes"
            title={t('recipes.emptyTitle')}
            body={t('recipes.emptyBody')}
            action={{ label: t('recipes.new'), onPress: create }}
          />
        ) : (
          <>
            <ChipGroup
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({ value: f, label: t(`recipes.filters.${f}`) }))}
            />
            {shown.length ? (
              shown.map((r) => (
                <Card key={r.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                    <Pressable
                      style={({ pressed }) => ({ flex: 1, gap: 4, opacity: pressed ? 0.6 : 1 })}
                      onPress={() => {
                        haptic.tap();
                        router.push({ pathname: '/recipes/[id]', params: { id: r.id } });
                      }}
                      accessibilityRole="button"
                    >
                      <AppText variant="headline">{r.title}</AppText>
                      <AppText variant="caption" tone="textMuted">
                        {[
                          r.meal !== 'any' ? t(`recipes.meals.${r.meal}`) : null,
                          r.prepMinutes ? t('recipes.minutes', { count: r.prepMinutes }) : null,
                          r.cookedCount ? t('recipes.cookedTimes', { count: r.cookedCount }) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </AppText>
                      {r.description ? (
                        <AppText variant="callout" numberOfLines={2}>
                          {r.description}
                        </AppText>
                      ) : null}
                    </Pressable>
                    <Pressable
                      onPress={() => void toggleFavorite(r)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: r.favorite }}
                      accessibilityLabel={t('recipes.favorite')}
                      hitSlop={10}
                      style={{
                        width: 40,
                        height: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon
                        name={r.favorite ? 'heart' : 'heartOutline'}
                        size={20}
                        color={r.favorite ? colors.danger : colors.textMuted}
                      />
                    </Pressable>
                  </View>
                </Card>
              ))
            ) : (
              <AppText variant="callout" tone="textMuted">
                {t('recipes.noneInFilter')}
              </AppText>
            )}
          </>
        )}
      </Screen>
    </>
  );
}
