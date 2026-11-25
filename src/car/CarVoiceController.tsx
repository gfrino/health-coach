import CarVoice, { type CarAction } from 'car-voice';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '@/store/settingsStore';
import { useVoiceConversation } from '@/voice/useVoiceConversation';

import { carSessionActive, carStateOf, commandFor } from './carState';

const noop = () => undefined;

/**
 * Coach vocale sullo schermo dell'auto: stessa conversazione della modalità vocale del telefono
 * (OpenAI Realtime o voce del telefono), ma i comandi arrivano dai pulsanti di CarPlay e lo stato
 * si mostra nel template vocale di Apple. Si avvia da solo quando l'auto si collega (voice-first).
 */
export function CarVoiceController() {
  const { t } = useTranslation();
  const onboarded = useSettingsStore((s) => s.settings.onboardingCompleted);
  const coachName = useSettingsStore((s) => s.settings.coach.name);
  const [connected, setConnected] = useState(() => CarVoice?.isConnected() ?? false);
  /** AlbA in primo piano sullo schermo dell'auto (l'auto può restare collegata anche fuori da AlbA). */
  const [visible, setVisible] = useState(() => CarVoice?.isVisible?.() ?? true);
  const active = carSessionActive({ connected, visible });
  /** Template vocale aperto (dopo "Parla", fino a "Fine" o a un avviso). */
  const open = useRef(false);
  const v = useVoiceConversation(null, noop, { background: true });
  const carState = carStateOf({ state: v.state, muted: v.muted, hasError: v.error != null });

  // Testi tradotti per i template (lingua scelta nell'app, non quella di sistema).
  useEffect(() => {
    void CarVoice?.setTexts({
      appTitle: 'AlbA',
      talk: t('car.talk'),
      ok: t('car.ok'),
      states: {
        idle: t('car.paused'),
        connecting: t('voiceMode.state.connecting'),
        listening: t('voiceMode.state.listening'),
        thinking: t('voiceMode.state.thinking'),
        speaking: coachName || t('voiceMode.state.speaking'),
      },
    });
  }, [t, coachName]);

  const latest = useRef({ v, onboarded, carState });
  useEffect(() => {
    latest.current = { v, onboarded, carState };
  });

  /** Apre il template vocale sullo stato attuale. */
  const show = useCallback(() => {
    open.current = true;
    void CarVoice?.setState(latest.current.carState, latest.current.v.muted);
  }, []);

  const handle = useCallback(
    (action: CarAction) => {
      const { v: cur, onboarded: ok } = latest.current;
      const command = commandFor(action, {
        onboarded: ok,
        engine: cur.engine,
        state: cur.state,
        muted: cur.muted,
        hasError: cur.error != null,
      });
      switch (command) {
        case 'setup':
          void CarVoice?.showMessage(t('car.setupNeeded'));
          return;
        case 'start':
          show();
          void cur.start();
          return;
        case 'none':
          show();
          return;
        case 'tap':
          cur.tap();
          return;
        case 'mute':
        case 'unmute':
          cur.toggleMute();
          return;
        case 'pause':
          cur.stop();
          return;
        case 'end':
          cur.stop();
          open.current = false;
          void CarVoice?.close();
          return;
      }
    },
    [t, show],
  );

  // Pulsanti dell'auto e collegamento/scollegamento.
  useEffect(() => {
    if (!CarVoice) return;
    const actions = CarVoice.addListener('onAction', ({ action }) => handle(action));
    const connection = CarVoice.addListener('onConnection', (e) => setConnected(e.connected));
    const visibility = CarVoice.addListener('onVisibility', (e) => setVisible(e.visible));
    return () => {
      actions.remove();
      connection.remove();
      visibility.remove();
    };
  }, [handle]);

  // Voice-first: aprendo AlbA su CarPlay si parte subito; uscendo da AlbA (Home di CarPlay,
  // un'altra app) o scollegando l'auto ci si ferma e il microfono si chiude.
  useEffect(() => {
    if (active) {
      handle('start');
      return;
    }
    latest.current.v.stop();
    open.current = false;
  }, [active, handle]);

  useEffect(() => {
    if (open.current && active) void CarVoice?.setState(carState, v.muted);
  }, [active, carState, v.muted]);

  // Errori (AI non configurata, rete…): avviso sullo schermo dell'auto, come sul telefono.
  const errorCode = v.error?.code;
  useEffect(() => {
    if (!errorCode || !active) return;
    open.current = false;
    void CarVoice?.showMessage(t(`ai.errors.${errorCode}` as 'ai.errors.unknown'));
  }, [errorCode, active, t]);

  return null;
}
