import type { AppSettings } from '@/config/settingsSchema';
import {
  getDb,
  healthDataRepository,
  healthQueries,
  notificationRepository,
  programRepository,
  type Db,
} from '@/db';
import i18n from '@/i18n';
import { localIsoDate } from '@/lib/dates';
import { useSettingsStore } from '@/store/settingsStore';

import { loadProgramContext } from '@/programs/summary';

import {
  checkinCandidate,
  checkinSlots,
  firstSentence,
  SCHEDULED_KINDS,
  type CheckinSlot,
} from './digests';
import {
  parseTime,
  pickNotification,
  type NotificationCandidate,
  type ProactiveInput,
} from './rules';

/**
 * Controllo proattivo dopo ogni sincronizzazione (apertura, background, aggiornamenti di Apple
 * Salute): se c'è qualcosa di utile da dire, una notifica LOCALE. Nessun server, nessun dato fuori
 * dal telefono. Toccandola si apre il coach con la domanda già pronta (`data.ask`).
 */

const DAY = 24 * 60 * 60 * 1000;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function loadProactiveInput(
  db: Db,
  now: Date,
): Promise<Omit<ProactiveInput, 'prefs'>> {
  const to = now.getTime() + 1;
  const today = localIsoDate(now);
  const from30 = to - 30 * DAY;
  const nights = (await healthDataRepository.nightsBetween(db, from30, to)).map((n) => ({
    day: n.day,
    asleepMin: n.asleepMin,
    endAt: n.endAt,
  }));
  const steps = (await healthQueries.dailyMetric(db, 'steps', to - 15 * DAY, to)).days;
  const past = steps.filter((d) => d.day < today);
  const rhr = (await healthQueries.dailyMetric(db, 'restingHeartRate', from30, to)).days;
  const hrv = (await healthQueries.dailyMetric(db, 'hrv', from30, to)).days;
  const cut7 = localIsoDate(new Date(to - 7 * DAY));
  const last7 = (xs: { day: string; value: number }[]) =>
    avg(xs.filter((d) => d.day > cut7).map((d) => d.value));
  return {
    now,
    today,
    nights,
    stepsToday: steps.find((d) => d.day === today)?.value ?? null,
    steps7: avg(past.slice(-7).map((d) => d.value)),
    stepsPrev7: past.length >= 14 ? avg(past.slice(-14, -7).map((d) => d.value)) : null,
    rhr7: last7(rhr),
    rhr30: avg(rhr.map((d) => d.value)),
    hrv7: last7(hrv),
    hrv30: avg(hrv.map((d) => d.value)),
    baselineDays: Math.min(rhr.length, hrv.length || rhr.length),
    sent: await notificationRepository.recentNotifications(db, to - 8 * DAY),
  };
}

/** Testi tradotti della notifica e domanda da porre al coach quando la si tocca. */
export function notificationText(c: NotificationCandidate) {
  const t = i18n.t.bind(i18n) as (key: string, opts?: Record<string, unknown>) => string;
  const locale = i18n.language;
  const p: Record<string, unknown> = { ...c.params };
  for (const k of ['steps', 'usual'] as const)
    if (typeof p[k] === 'number') p[k] = (p[k] as number).toLocaleString(locale);
  const variant = typeof c.params.variant === 'string' ? `_${c.params.variant}` : '';
  return {
    title: t(`proactive.${c.kind}.title`, p),
    body: t(`proactive.${c.kind}.body${variant}`, p),
    ask: t(`proactive.${c.kind}.ask`, p),
  };
}

type NotificationsModule = typeof import('expo-notifications');

function notificationsModule(): NotificationsModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as NotificationsModule;
}

const tr = (key: string, opts?: Record<string, unknown>) =>
  (i18n.t.bind(i18n) as (k: string, o?: Record<string, unknown>) => string)(key, opts);

const CHECKIN_PREFIX = 'checkin:';

/** Testo della notifica di un check-in programmato (dati veri se già disponibili). */
async function checkinContent(
  db: Db,
  slot: CheckinSlot,
  input: Omit<ProactiveInput, 'now' | 'sent'>,
  programsLeft: number,
): Promise<{ title: string; body: string; ask: string }> {
  const candidate = checkinCandidate(slot, input);
  if (slot.kind === 'morning') {
    const ask = tr('proactive.morning.ask');
    const ready = slot.day === input.today ? await programRepository.getCheckin(db, slot.id) : null;
    if (ready?.summary) return { title: tr('proactive.morning.title'), body: ready.summary, ask };
    if (candidate) return { ...notificationText(candidate), ask };
    return { title: tr('proactive.morning.title'), body: tr('proactive.checkin.morningBody'), ask };
  }
  if (candidate?.kind === 'weekly') return notificationText(candidate);
  const weekly = new Date(`${slot.day}T12:00:00`).getDay() === 0 && input.prefs.reports.weekly;
  if (weekly)
    return {
      title: tr('proactive.weekly.title'),
      body: tr('proactive.checkin.weeklyBody'),
      ask: tr('proactive.weekly.ask'),
    };
  return {
    title: tr('proactive.daily.title'),
    body:
      slot.day === input.today && programsLeft > 0
        ? tr('proactive.checkin.eveningPrograms', { count: programsLeft })
        : tr('proactive.checkin.eveningBody'),
    ask: tr('proactive.daily.ask'),
  };
}

/**
 * Riprogramma i check-in dei prossimi giorni con i testi aggiornati. In modalità passiva (o
 * senza permesso) li toglie. Sicuro da chiamare spesso: sono al massimo 14 notifiche.
 */
async function scheduleCheckins(
  Notifications: NotificationsModule,
  db: Db,
  input: Omit<ProactiveInput, 'now' | 'sent'>,
  now: Date,
): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((n) => n.identifier.startsWith(CHECKIN_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  const slots = checkinSlots(input.prefs, now);
  if (!slots.length) return;
  const programs = await loadProgramContext(db, now);
  const programsLeft = programs
    .flatMap((p) => p.items)
    .filter((i) => i.frequency === 'daily' && !i.done).length;
  for (const slot of slots) {
    const text = await checkinContent(db, slot, input, programsLeft);
    await Notifications.scheduleNotificationAsync({
      identifier: `${CHECKIN_PREFIX}${slot.id}`,
      content: {
        title: text.title,
        body: text.body,
        data: { ask: text.ask, kind: slot.kind, checkinId: slot.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: slot.at },
    });
  }
  if (__DEV__) {
    const first = slots[0];
    console.warn(
      `[proactive] ${slots.length} check-in programmati; prossimo ${first?.id} alle ${first?.at.toLocaleTimeString()}`,
    );
  }
}

const MORNING_INSTRUCTION = `Write my morning check-in. Analyse last night's sleep (duration, stages and timing compared to my usual), my recovery signals (resting heart rate, HRV) and yesterday's activity, plus my active programs if any. Then give 2–3 concrete suggestions for today. Max 130 words, warm and direct.
The FIRST sentence must be a self-contained summary under 110 characters, without markdown: it is shown in the notification.`;

const ANALYSIS_TIMEOUT_MS = 25_000;
const ANALYSIS_RETRY_MS = 30 * 60 * 1000;
let lastAnalysisAttempt = 0;

/**
 * Analisi del mattino: appena la notte è sincronizzata, il coach (AI scelta dall'utente, sul
 * telefono o con la sua chiave) prepara il check-in come conversazione. La notifica delle
 * ore X ne mostra la prima frase; toccandola si apre l'analisi completa.
 */
async function prepareMorningCheckin(
  db: Db,
  settings: AppSettings,
  input: Omit<ProactiveInput, 'sent'>,
): Promise<void> {
  const { now, today, nights, prefs } = input;
  const id = `morning:${today}`;
  const last = nights.at(-1);
  if (!settings.ai.provider || !settings.ai.model) return;
  if (!last || last.day !== today || now.getTime() < last.endAt + 20 * 60 * 1000) return;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes > parseTime(prefs.morningCheckinTime) + 4 * 60) return;
  if (await programRepository.getCheckin(db, id)) return;
  if (Date.now() - lastAnalysisAttempt < ANALYSIS_RETRY_MS) return;
  lastAnalysisAttempt = Date.now();

  const { generateCheckin } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/coach/chatEngine') as typeof import('@/coach/chatEngine');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
  try {
    const title = tr('proactive.checkin.conversationTitle', {
      date: now.toLocaleDateString(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    });
    const res = await generateCheckin(settings, title, MORNING_INSTRUCTION, controller.signal);
    await programRepository.saveCheckin(db, id, res.conversationId, firstSentence(res.text));
  } finally {
    clearTimeout(timer);
  }
}

let running = false;
let rerun = false;

/**
 * Dopo ogni sincronizzazione (e all'apertura): prepara l'analisi del mattino, riprogramma i
 * check-in con i dati aggiornati e, se c'è un avviso importante, lo invia subito.
 */
export async function runProactiveCheck(db: Db, now = new Date()): Promise<string | null> {
  if (running) {
    // Dati appena sincronizzati mentre un controllo è in corso: si ripete subito dopo.
    rerun = true;
    return null;
  }
  running = true;
  try {
    const { settings } = useSettingsStore.getState();
    if (!settings.onboardingCompleted) return null;
    const Notifications = notificationsModule();
    const proactive = settings.proactivity.mode === 'proactive';
    const perm = await Notifications.getPermissionsAsync();
    const base = { ...(await loadProactiveInput(db, now)), prefs: settings.proactivity };
    if (!proactive || !perm.granted) {
      await scheduleCheckins(
        Notifications,
        db,
        { ...base, prefs: { ...base.prefs, mode: 'passive' } },
        now,
      );
      return null;
    }

    await prepareMorningCheckin(db, settings, base).catch((e: unknown) => {
      if (__DEV__) console.warn('[proactive] analisi del mattino non riuscita', e);
    });
    await scheduleCheckins(Notifications, db, base, now);

    const pick = pickNotification(base, SCHEDULED_KINDS);
    if (!pick) return null;

    const text = notificationText(pick);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: text.title,
        body: text.body,
        data: { ask: text.ask, kind: pick.kind },
      },
      trigger: null,
    });
    await notificationRepository.logNotification(db, {
      id: pick.id,
      kind: pick.kind,
      sentAt: now.getTime(),
    });
    return pick.id;
  } catch (e) {
    // Mai bloccare la sincronizzazione per una notifica.
    if (__DEV__) console.warn('[proactive]', e);
    return null;
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      void runProactiveCheck(db);
    }
  }
}

/** Riprogramma i check-in (es. dopo aver cambiato orari o spuntato azioni) senza sincronizzare. */
export async function refreshCheckins(): Promise<void> {
  try {
    await runProactiveCheck(await getDb());
  } catch {
    // ignorato
  }
}

/** Chiede il permesso una volta, se il coach è in modalità proattiva. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const perm = await Notifications.getPermissionsAsync();
    if (perm.granted) return true;
    if (!perm.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}
