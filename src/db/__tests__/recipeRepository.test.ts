import { migrate } from '@/db/migrate';
import * as recipeRepository from '@/db/repositories/recipeRepository';
import { missingRequested, parseRecipe, recipeInstruction } from '@/recipes/generate';
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
      requested: [],
      warning: null,
    });
    expect(parseRecipe('TITLE: x')).toBeNull();
  });

  it('la richiesta viene prima della dieta e gli ingredienti chiesti vanno verificati', () => {
    const prompt = recipeInstruction({
      wish: 'riso e semi di chia',
      meal: 'lunch',
      maxMinutes: 30,
      servings: 2,
    });
    expect(prompt).toContain('MY REQUEST (most important): riso e semi di chia');
    expect(prompt).toMatch(/my request comes first/);
    expect(prompt).toContain('REQUESTED:');

    const r = parseRecipe(
      [
        'TITLE: Budino di chia',
        'REQUESTED: riso, semi di chia',
        'INGREDIENTS:',
        '- 30 g semi di chia',
        '- 200 ml latte di cocco',
        'STEPS:',
        '1. Mescola e lascia riposare.',
      ].join('\n'),
    );
    expect(r?.requested).toEqual(['riso', 'semi di chia']);
    expect(missingRequested(r!, r!.requested)).toEqual(['riso']);
    expect(
      missingRequested({ ingredients: ['150 g riso basmati', '2 pomodori'] }, ['riso', 'pomodoro']),
    ).toEqual([]);

    // Tolto per allergia e segnalato: è avvisato, non si richiede di nuovo.
    const allergy = parseRecipe(
      [
        'TITLE: Insalata',
        'REQUESTED: noci, rucola',
        'WARNING: Ho tolto le noci perché sei allergico.',
        'INGREDIENTS:',
        '- 50 g rucola',
        'STEPS:',
        '1. Condisci.',
      ].join('\n'),
    );
    expect(allergy?.warning).toBe('Ho tolto le noci perché sei allergico.');
    expect(missingRequested(allergy!, allergy!.requested)).toEqual([]);
    expect(prompt).toContain('WARNING:');

    const retry = recipeInstruction({
      wish: 'riso',
      meal: 'lunch',
      maxMinutes: null,
      servings: 1,
      missing: ['riso'],
    });
    expect(retry).toContain('Your previous recipe left out: riso');
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
