import CarVoice from 'car-voice';
import { useEffect, useState } from 'react';

import i18n from '@/i18n';
import { bootstrapHeadless } from '@/lib/bootstrap';

import { CarVoiceController } from './CarVoiceController';

/**
 * Radice React Native senza finestra, montata dalla scena CarPlay (plugins/withCarPlay.js) con
 * il nome "AlbACar". Funziona anche con il telefono bloccato e l'app mai aperta: apre il DB e le
 * impostazioni come i task in background, poi monta solo il coach vocale.
 */
export function CarRoot() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    bootstrapHeadless()
      .then(() => setReady(true))
      .catch(() => void CarVoice?.showMessage(i18n.t('car.startError')));
  }, []);
  return ready ? <CarVoiceController /> : null;
}
