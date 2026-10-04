import { migrate } from '@/db/migrate';
import * as recipeRepository from '@/db/repositories/recipeRepository';
import { parseRecipe } from '@/recipes/generate';
import { createTestDb } from '@/test/nodeSqliteDb';

import { executeTool } from '@/coach/tools';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/db', () => ({
  recipeRepository: jest.requireActual('@/db/repositories/recipeRepository'),
}));

describe('ricette', () => {
  it("legge la ricetta a righe generata dall'AI", () => {
    const r = parseRecipe(
      [
        'TITLE: Zuppa di ceci',
        'DESCRIPTION: Ricca di fibre, adatta al tuo LDL.',
        'MEAL: Dinner',
        'SERVINGS: 2 porzioni',
        'TIME: 25 minuti',
        'TAGS: vegetariana, veloce',
        'INGREDIENTS:',
        '- 240 g ceci cotti',
        '- 1 carota',
        'STEPS:',
        '1. Soffriggi la carota.',
        '2. Aggiungi i ceci.',
      ].join('\n'),
    );
    expect(r).toEqual({
      title: 'Zuppa di ceci',
      description: 'Ricca di fibre, adatta al tuo LDL.',
      meal: 'dinner',
      servings: 2,
      prepMinutes: 25,
      tags: ['vegetariana', 'veloce'],
      ingredients: ['240 g ceci cotti', '1 carota'],
      steps: ['Soffriggi la carota.', 'Aggiungi i ceci.'],
    });
    expect(parseRecipe('TITLE: x')).toBeNull();
  });

  it('crea dal coach, aggiorna, preferita, cucinata, elimina', async () => {
    const db = createTestDb();
    await migrate(db);
    const created = await executeTool(db, {
      id: 'c',
      name: 'create_recipe',
      arguments: {
        title: 'Porridge',
        meal: 'breakfast',
        ingredients: ["40 g fiocchi d'avena", ''],
        steps: ['Cuoci nel latte'],
      },
    });
    const { recipe_id } = JSON.parse(created.content) as { recipe_id: string };
    let r = (await recipeRepository.getRecipe(db, recipe_id))!;
    expect(r).toMatchObject({
      meal: 'breakfast',
      source: 'coach',
      ingredients: ["40 g fiocchi d'avena"],
    });

    await executeTool(db, {
      id: 'u',
      name: 'update_recipe',
      arguments: { recipe_id, favorite: true, servings: 2 },
    });
    await recipeRepository.markCooked(db, recipe_id);
    r = (await recipeRepository.getRecipe(db, recipe_id))!;
    expect(r).toMatchObject({
      favorite: true,
      servings: 2,
      cookedCount: 1,
      steps: ['Cuoci nel latte'],
    });
    expect(
      (
        await executeTool(db, {
          id: 'x',
          name: 'create_recipe',
          arguments: { title: 'x', ingredients: [], steps: [] },
        })
      ).isError,
    ).toBe(true);
    await recipeRepository.deleteRecipe(db, recipe_id);
    expect(await recipeRepository.listRecipes(db)).toEqual([]);
  });
});
