import * as Speech from 'expo-speech';

import { toSpeakable } from './speakable';

/** Lettura con la sintesi vocale del sistema: avviene sul telefono. */
export function speak(markdown: string, locale: string, onDone?: () => void) {
  Speech.stop();
  Speech.speak(toSpeakable(markdown), {
    language: locale,
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}

export const stopSpeaking = () => Speech.stop();
