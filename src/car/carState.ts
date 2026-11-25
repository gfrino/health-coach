import type { CarAction, CarVoiceState } from 'car-voice';

import type { ConversationState, VoiceEngine } from '@/voice/useVoiceConversation';

/**
 * Logica del coach vocale su CarPlay, separata dai componenti per poterla testare.
 * Il template vocale di Apple accetta al massimo 5 stati: "ended" ed errori diventano "idle".
 */
export function carStateOf(v: {
  state: ConversationState;
  muted: boolean;
  hasError: boolean;
}): CarVoiceState {
  if (v.hasError || v.muted || v.state === 'ended') return 'idle';
  return v.state;
}

export type CarCommand = 'setup' | 'start' | 'tap' | 'unmute' | 'mute' | 'pause' | 'end' | 'none';

/** Cosa fare per un tocco sullo schermo dell'auto. */
export function commandFor(
  action: CarAction,
  v: {
    onboarded: boolean;
    engine: VoiceEngine;
    state: ConversationState;
    muted: boolean;
    hasError: boolean;
  },
): CarCommand {
  if (action === 'end') return 'end';
  if (!v.onboarded) return 'setup';
  const stopped = v.state === 'idle' || v.state === 'ended';
  switch (action) {
    case 'start':
      return stopped || v.hasError ? 'start' : 'none';
    case 'tap':
      if (v.muted) return 'unmute';
      if (v.hasError) return 'start';
      if (v.engine === 'realtime') return stopped ? 'start' : 'none';
      return v.state === 'ended' ? 'start' : 'tap';
    case 'mute':
      // Realtime: microfono spento, la sessione resta aperta. Voce del telefono: ci si ferma.
      if (v.engine === 'realtime') return v.muted ? 'unmute' : stopped ? 'none' : 'mute';
      return stopped ? 'none' : 'pause';
    default:
      return 'none';
  }
}

/**
 * La conversazione in auto gira solo con l'auto collegata E AlbA in primo piano sullo schermo
 * dell'auto: uscendo da AlbA su CarPlay l'auto resta collegata, ma il coach deve smettere di ascoltare.
 */
export function carSessionActive(car: { connected: boolean; visible: boolean }): boolean {
  return car.connected && car.visible;
}
