import { healthDataRepository, healthQueries, notificationRepository, type Db } from '@/db';
import i18n from '@/i18n';
import { localIsoDate } from '@/lib/dates';
import { useSettingsStore } from '@/store/settingsStore';

import { pickNotification, type NotificationCandidate, type ProactiveInput } from './rules';

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

let running = false;

export async function runProactiveCheck(db: Db, now = new Date()): Promise<string | null> {
  if (running) return null;
  running = true;
  try {
    const { settings } = useSettingsStore.getState();
    if (settings.proactivity.mode !== 'proactive' || !settings.onboardingCompleted) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return null;

    const input = { ...(await loadProactiveInput(db, now)), prefs: settings.proactivity };
    const pick = pickNotification(input);
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
  } catch {
    // Mai bloccare la sincronizzazione per una notifica.
    return null;
  } finally {
    running = false;
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
