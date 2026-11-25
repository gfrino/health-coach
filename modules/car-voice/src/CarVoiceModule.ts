import { NativeModule, requireOptionalNativeModule } from 'expo';

/** Stati del template vocale di CarPlay (massimo 5, imposto da Apple). */
export type CarVoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

/** Tocchi sullo schermo dell'auto. */
export type CarAction = 'start' | 'tap' | 'mute' | 'end';

/** Testi già tradotti, mandati da JS (il nativo non conosce la lingua scelta nell'app). */
export interface CarVoiceTexts {
  appTitle: string;
  talk: string;
  states: Record<CarVoiceState, string>;
  ok: string;
}

type Events = {
  onAction: (e: { action: CarAction }) => void;
  onConnection: (e: { connected: boolean }) => void;
  /** AlbA entra o esce dal primo piano sullo schermo dell'auto (l'auto resta collegata). */
  onVisibility: (e: { visible: boolean }) => void;
};

declare class CarVoiceModule extends NativeModule<Events> {
  isConnected(): boolean;
  /** AlbA in primo piano su CarPlay. Assente nelle build precedenti alla 1.44.2. */
  isVisible?(): boolean;
  setTexts(texts: CarVoiceTexts): Promise<void>;
  /** Mostra il template vocale (se non è già visibile) e attiva lo stato. */
  setState(state: CarVoiceState, muted: boolean): Promise<void>;
  /** Avviso sullo schermo dell'auto (es. AI non configurata). */
  showMessage(message: string): Promise<void>;
  /** Chiude il template vocale e torna alla schermata iniziale. */
  close(): Promise<void>;
}

/** `null` su Android, nei test e nelle build senza CarPlay. */
export default requireOptionalNativeModule<CarVoiceModule>('CarVoice');
