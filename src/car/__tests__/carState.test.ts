import { carStateOf, commandFor } from '../carState';

const base = {
  onboarded: true,
  engine: 'realtime' as const,
  state: 'listening' as const,
  muted: false,
  hasError: false,
};

describe('carStateOf', () => {
  it('mostra lo stato della conversazione', () => {
    expect(carStateOf({ state: 'speaking', muted: false, hasError: false })).toBe('speaking');
    expect(carStateOf({ state: 'connecting', muted: false, hasError: false })).toBe('connecting');
  });

  it('fine, errore e microfono spento diventano "in pausa"', () => {
    expect(carStateOf({ state: 'ended', muted: false, hasError: false })).toBe('idle');
    expect(carStateOf({ state: 'listening', muted: true, hasError: false })).toBe('idle');
    expect(carStateOf({ state: 'thinking', muted: false, hasError: true })).toBe('idle');
  });
});

describe('commandFor', () => {
  it('senza configurazione chiede di aprire l’app sul telefono', () => {
    expect(commandFor('start', { ...base, onboarded: false, state: 'idle' })).toBe('setup');
    expect(commandFor('end', { ...base, onboarded: false })).toBe('end');
  });

  it('"Parla" avvia solo se la conversazione è ferma o in errore', () => {
    expect(commandFor('start', { ...base, state: 'idle' })).toBe('start');
    expect(commandFor('start', { ...base, state: 'ended' })).toBe('start');
    expect(commandFor('start', base)).toBe('none');
    expect(commandFor('start', { ...base, hasError: true })).toBe('start');
  });

  it('microfono: riattiva se in pausa, riprova dopo un errore', () => {
    expect(commandFor('tap', { ...base, muted: true })).toBe('unmute');
    expect(commandFor('tap', { ...base, hasError: true })).toBe('start');
    expect(commandFor('tap', base)).toBe('none');
    expect(commandFor('tap', { ...base, engine: 'loop', state: 'speaking' })).toBe('tap');
    expect(commandFor('tap', { ...base, engine: 'loop', state: 'ended' })).toBe('start');
  });

  it('pausa: Realtime spegne il microfono, la voce del telefono si ferma', () => {
    expect(commandFor('mute', base)).toBe('mute');
    expect(commandFor('mute', { ...base, muted: true })).toBe('unmute');
    expect(commandFor('mute', { ...base, engine: 'loop', state: 'listening' })).toBe('pause');
    expect(commandFor('mute', { ...base, engine: 'loop', state: 'ended' })).toBe('none');
  });
});
