import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { AIError } from '@/ai/errors';
import { toAIError } from '@/ai/errors';
import { buildSystemPrompt, refreshHealthData, resolveAI, runCoachTurn } from '@/coach/chatEngine';
import { VOICE_RULE } from '@/coach/prompts';
import { COACH_TOOLS, executeTool } from '@/coach/tools';
import { conversationRepository, getDb } from '@/db';
import { resolveLanguage, deviceLanguageCodes } from '@/i18n';
import { useSettingsStore } from '@/store/settingsStore';

import { speechLocale } from './locale';
import { OpenAIRealtimeSession, type RealtimeState } from './realtime/openaiRealtime';
import { speak, stopSpeaking } from './speak';
import { useVoiceInput } from './useVoiceInput';

export type VoiceEngine = 'realtime' | 'loop';
export type ConversationState = RealtimeState | 'idle';

/** Quanti scambi della chat esistente passano alla sessione vocale. */
const HISTORY_TURNS = 12;

/**
 * Conversazione a voce continua con il coach.
 * - OpenAI: Realtime API (voce naturale, si può interrompere).
 * - Altri provider e AI sul telefono: ascolto → risposta → lettura → di nuovo ascolto,
 *   con riconoscimento e sintesi vocale del telefono.
 * Tutto ciò che viene detto finisce nella conversazione della chat.
 */
export function useVoiceConversation(
  conversationId: string | null,
  onConversationCreated: (id: string) => void,
) {
  const settings = useSettingsStore((s) => s.settings);
  const language = resolveLanguage(settings.language, deviceLanguageCodes());
  const locale = speechLocale(language);
  const engine: VoiceEngine = settings.ai.provider === 'openai' ? 'realtime' : 'loop';

  const [state, setState] = useState<ConversationState>('idle');
  const [userText, setUserText] = useState('');
  const [coachText, setCoachText] = useState('');
  const [tool, setTool] = useState<string | null>(null);
  const [error, setError] = useState<AIError | null>(null);
  const [muted, setMuted] = useState(false);

  const convRef = useRef(conversationId);
  const session = useRef<OpenAIRealtimeSession | null>(null);
  const active = useRef(false);
  /** Sessione realtime chiusa perché l'app è andata in background: riparte al ritorno. */
  const pausedRef = useRef(false);

  const ensureConversation = useCallback(async () => {
    if (convRef.current) return convRef.current;
    const db = await getDb();
    const id = await conversationRepository.createConversation(db, {
      provider: settings.ai.provider,
      model: settings.ai.model,
    });
    convRef.current = id;
    onConversationCreated(id);
    return id;
  }, [settings.ai.provider, settings.ai.model, onConversationCreated]);

  const save = useCallback(
    async (role: 'user' | 'assistant', content: string) => {
      const id = await ensureConversation();
      const db = await getDb();
      await conversationRepository.addMessage(db, { conversationId: id, role, content });
      if (role === 'user') {
        const conv = await conversationRepository.getConversation(db, id);
        if (conv && !conv.title)
          await conversationRepository.setConversationMeta(db, id, { title: content.slice(0, 60) });
      }
    },
    [ensureConversation],
  );

  // ——— Modalità "loop" (qualsiasi AI) ———
  const listenAgain = useRef<() => void>(() => undefined);
  const voice = useVoiceInput(locale, (text) => {
    if (!active.current) return;
    setUserText(text);
    setCoachText('');
    setState('thinking');
    void (async () => {
      try {
        const id = await ensureConversation();
        const res = await runCoachTurn(settings, id, text, {
          onText: (t) => setCoachText(t),
          onToolUse: (name) => setTool(name),
        });
        setTool(null);
        if (!active.current) return;
        setCoachText(res.text);
        setState('speaking');
        speak(res.text, locale, () => {
          if (active.current) listenAgain.current();
        });
      } catch (e) {
        setError(toAIError(e));
        setState('idle');
      }
    })();
  });
  const startListening = voice.start;
  useEffect(() => {
    listenAgain.current = () => {
      setState('listening');
      void startListening();
    };
  }, [startListening]);
  // Silenzio o errore del riconoscimento: si torna in attesa di un tocco.
  useEffect(() => {
    if (engine === 'loop' && voice.error && active.current) setState('idle');
  }, [engine, voice.error]);

  // ——— Avvio / fine ———
  const start = useCallback(async () => {
    setError(null);
    active.current = true;
    if (engine === 'loop') {
      listenAgain.current();
      return;
    }
    const db = await getDb();
    const { apiKey } = await resolveAI(settings).catch((e: unknown) => {
      setError(toAIError(e));
      return { apiKey: '' };
    });
    if (!apiKey) return;
    await refreshHealthData();
    const instructions = `${await buildSystemPrompt(db, settings, new Date())}\n\n${VOICE_RULE}`;
    const stored = convRef.current
      ? await conversationRepository.listMessages(db, convRef.current)
      : [];
    const history = stored
      .filter((m) => m.status === 'complete' && m.content.trim())
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, text: m.content.slice(0, 2000) }));

    const s = new OpenAIRealtimeSession(
      {
        apiKey,
        instructions,
        tools: COACH_TOOLS,
        language,
        history,
        executeTool: async (call) => executeTool(await getDb(), call),
      },
      {
        onState: (st) => {
          setState(st);
          if (st !== 'thinking') setTool(null);
        },
        onUserTranscript: (text) => {
          setUserText(text);
          setCoachText('');
          void save('user', text);
        },
        onAssistantTranscript: (text, final) => {
          setCoachText(text);
          if (final) void save('assistant', text);
        },
        onToolUse: (name) => setTool(name),
        // Con l'app in background (schermo spento, altra app) iOS taglia l'audio: non è un
        // problema di rete. La conversazione si riprende al ritorno.
        onError: (e) => {
          if (AppState.currentState !== 'active') pausedRef.current = true;
          else setError(e);
        },
      },
    );
    session.current = s;
    await s.start();
  }, [engine, settings, language, save]);

  const stop = useCallback(() => {
    active.current = false;
    session.current?.stop();
    session.current = null;
    voice.stop();
    stopSpeaking();
    setState('ended');
  }, [voice]);

  // Realtime: in background l'audio si ferma; si chiude la sessione e si riprende al ritorno
  // (con la cronologia della chat, quindi il coach sa dove eravate rimasti).
  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  }, [start]);
  useEffect(() => {
    if (engine !== 'realtime') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' && active.current && session.current) {
        pausedRef.current = true;
        session.current.stop();
        session.current = null;
      } else if (next === 'active' && pausedRef.current && active.current) {
        pausedRef.current = false;
        void startRef.current();
      }
    });
    return () => sub.remove();
  }, [engine]);

  /** Tocco sull'orb: interrompe il coach (loop), riprende ad ascoltare o riprova dopo un errore. */
  const tap = useCallback(() => {
    if (engine === 'realtime') {
      if (error) void start();
      return;
    }
    if (state === 'speaking') {
      stopSpeaking();
      listenAgain.current();
    } else if (state === 'idle') {
      active.current = true;
      listenAgain.current();
    } else if (state === 'listening') {
      voice.stop();
    }
  }, [engine, state, voice, error, start]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      session.current?.setMuted(!m);
      return !m;
    });
  }, []);

  useEffect(
    () => () => {
      active.current = false;
      session.current?.stop();
      stopSpeaking();
    },
    [],
  );

  return {
    engine,
    state,
    userText: engine === 'loop' && state === 'listening' ? voice.transcript : userText,
    coachText,
    tool,
    error,
    voiceError: voice.error,
    muted,
    start,
    stop,
    tap,
    toggleMute,
  };
}
