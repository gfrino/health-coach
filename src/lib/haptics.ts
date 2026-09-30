import * as Haptics from 'expo-haptics';

/**
 * Feedback aptico sui pulsanti principali. Il sistema lo disattiva da sé se l'utente ha
 * spento le vibrazioni di sistema; gli errori (es. simulatore) vengono ignorati.
 */
const safe = (p: Promise<void>) => void p.catch(() => undefined);

export const haptic = {
  /** Cambio di selezione: tab, segmenti, scelte. */
  select: () => safe(Haptics.selectionAsync()),
  /** Tocco su un'azione: invia, allega, nuova chat, cronologia. */
  tap: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Azione importante: avvio/fine della conversazione a voce, pulsante principale. */
  press: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Esito: salvataggio riuscito o errore. */
  success: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
