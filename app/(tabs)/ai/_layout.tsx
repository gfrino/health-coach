export { TabStack as default } from '@/components/TabStack';

/**
 * La schermata principale della tab resta sempre alla base dello stack: aprendo direttamente
 * una sottoschermata (es. un referto arrivato dalla condivisione) si può tornare indietro.
 */
export const unstable_settings = { initialRouteName: 'index' };
