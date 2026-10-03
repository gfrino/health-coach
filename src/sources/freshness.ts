/**
 * Quando sono stati letti l'ultima volta i totali di oggi da Apple Salute / Health Connect.
 * Modulo senza dipendenze native: il coach lo usa per dire al modello quanto sono recenti i dati.
 */
let todayTotalsAt: number | null = null;

export const getTodayTotalsAt = () => todayTotalsAt;
export const setTodayTotalsAt = (ms: number) => {
  todayTotalsAt = ms;
};
