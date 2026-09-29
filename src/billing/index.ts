import { featureFlags } from '@/config/featureFlags';

/**
 * Modulo billing predisposto ma disattivato nella v1.0 (featureFlags.billingEnabled = false).
 * L'implementazione (RevenueCat o expo-iap) e il modello entitlement arrivano con la prima integrazione a pagamento.
 */
export const isBillingEnabled = () => featureFlags.billingEnabled;
