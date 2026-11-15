import { macroGuide } from '../macroGuide';

describe('macroGuide', () => {
  it('senza dieta usa le fasce EFSA e i 90 g di zuccheri UE', () => {
    const g = macroGuide('none', 2000, 100);
    expect(g.carbs).toMatchObject({ net: false, min: 225, max: 300, basis: 'efsa' });
    expect(g.sugar).toEqual({ max: 90, basis: 'eu' });
    expect(g.fat).toMatchObject({ max: 78, basis: 'efsa' });
  });

  it('con Healthy Keto: carboidrati netti sotto 50 g, zuccheri al 5%, grassi senza tetto', () => {
    const g = macroGuide('healthyKeto', 2050, 125);
    expect(g.carbs).toMatchObject({ net: true, max: 50, strict: true, basis: 'keto' });
    expect(g.sugar).toEqual({ max: 26, basis: 'who5' });
    // (2050 − 125×4 − 50×4) / 9 = 150
    expect(g.fat).toEqual({ max: null, target: 150, basis: 'fuel' });
  });

  it('mediterranea: grassi fino al 40%', () => {
    expect(macroGuide('mediterranean', 2000, null).fat.max).toBe(89);
  });

  it('low-carb: 50–130 g, carnivora 20 g netti', () => {
    expect(macroGuide('lowCarb', 2000, 100).carbs).toMatchObject({ min: 50, max: 130 });
    expect(macroGuide('carnivore', 2000, 100).carbs).toMatchObject({ net: true, max: 20 });
  });
});
