/**
 * Feature flag compilati nell'app. Attivabili anche via EAS Update (sono solo JS).
 */
export const featureFlags = {
  /** Acquisti in-app per le integrazioni a pagamento: disattivato nella v1.0. */
  billingEnabled: false,
  /** Push remote per annunci non sanitari (richiede backend configurato). */
  remotePushAnnouncements: false,
} as const;
