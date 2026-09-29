import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';

import { stopSpeaking } from './speak';

export type VoiceError = 'permission' | 'unavailable' | 'no-speech' | 'other';

/**
 * Dettatura: trascrizione in tempo reale, testo finale consegnato a `onFinal`.
 * Usa il riconoscimento sul telefono quando disponibile (l'audio non esce dal dispositivo);
 * altrimenti il servizio vocale di sistema (Apple/Google).
 */
export function useVoiceInput(locale: string, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<VoiceError | null>(null);
  const latest = useRef('');
  const triedOnDevice = useRef(false);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    latest.current = text;
    setTranscript(text);
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    const text = latest.current.trim();
    latest.current = '';
    setTranscript('');
    if (text) onFinal(text);
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    // Lingua non installata per il riconoscimento offline: si riprova con quello di sistema.
    if (
      triedOnDevice.current &&
      (e.error === 'language-not-supported' || e.error === 'service-not-allowed')
    ) {
      triedOnDevice.current = false;
      ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
        addsPunctuation: true,
      });
      return;
    }
    if (e.error === 'aborted') return;
    setError(
      e.error === 'not-allowed' ? 'permission' : e.error === 'no-speech' ? 'no-speech' : 'other',
    );
  });

  const start = useCallback(async () => {
    setError(null);
    stopSpeaking();
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError('permission');
      return;
    }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setError('unavailable');
      return;
    }
    const onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    triedOnDevice.current = onDevice;
    ExpoSpeechRecognitionModule.start({
      lang: locale,
      interimResults: true,
      addsPunctuation: true,
      requiresOnDeviceRecognition: onDevice,
    });
  }, [locale]);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);

  return { listening, transcript, error, start, stop, clearError: () => setError(null) };
}
