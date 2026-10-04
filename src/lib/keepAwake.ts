import { requireOptionalNativeModule } from 'expo';
import { useEffect } from 'react';

/**
 * Schermo sempre acceso (es. durante la conversazione a voce: con lo schermo spento iOS sospende
 * l'app e l'audio si interrompe). Usa il modulo nativo ExpoKeepAwake già incluso con `expo`,
 * senza aggiungere dipendenze native.
 */
const KeepAwake = requireOptionalNativeModule<{
  activate(tag: string): Promise<boolean>;
  deactivate(tag: string): Promise<boolean>;
}>('ExpoKeepAwake');

export function useKeepAwake(tag: string, enabled = true) {
  useEffect(() => {
    if (!enabled || !KeepAwake) return;
    KeepAwake.activate(tag).catch(() => undefined);
    return () => {
      KeepAwake.deactivate(tag).catch(() => undefined);
    };
  }, [tag, enabled]);
}
