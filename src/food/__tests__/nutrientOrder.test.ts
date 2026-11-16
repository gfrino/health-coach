import { moveId, orderRows } from '../nutrientOrder';

const rows = ['fiber', 'saturatedFat', 'sodium', 'vitaminC', 'unsaturatedFat'].map((id) => ({
  id,
}));
const ids = (r: { id: string }[]) => r.map((x) => x.id);

describe('ordine dei nutrienti', () => {
  it("senza ordine salvato resta quello dell'app", () => {
    expect(ids(orderRows(rows, undefined))).toEqual(ids(rows));
  });

  it('i grassi insaturi si spostano sotto i saturi e restano lì', () => {
    let order = ids(rows);
    order = moveId(order, 'unsaturatedFat', -1);
    order = moveId(order, 'unsaturatedFat', -1);
    expect(order).toEqual(['fiber', 'saturatedFat', 'unsaturatedFat', 'sodium', 'vitaminC']);
    expect(ids(orderRows(rows, order))).toEqual(order);
    // Ai bordi non si sposta.
    expect(moveId(order, 'fiber', -1)).toEqual(order);
    expect(moveId(order, 'vitaminC', 1)).toEqual(order);
  });

  it('le voci nuove vanno in fondo, quelle tolte si ignorano', () => {
    const saved = ['sodium', 'removed', 'fiber'];
    expect(ids(orderRows(rows, saved))).toEqual([
      'sodium',
      'fiber',
      'saturatedFat',
      'vitaminC',
      'unsaturatedFat',
    ]);
  });
});
