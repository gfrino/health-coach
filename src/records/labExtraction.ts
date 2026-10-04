import { create } from 'zustand';

import { toAIError } from '@/ai/errors';
import type { AppSettings } from '@/config/settingsSchema';
import { getDb, labReportRepository } from '@/db';
import type { LabResultInput } from '@/db/repositories/labReportRepository';
import { deviceLanguageCodes, resolveLanguage } from '@/i18n';

import { loadAttachmentContent } from './attachmentContent';

/**
 * Lettura dei referti con l'AI scelta dall'utente: valori degli esami (nome, valore, unità,
 * intervallo di riferimento) e un breve riassunto, salvati nel DB cifrato. Così il coach li
 * conosce sempre e può confrontarli nel tempo. Con l'AI del telefono il testo di PDF e foto
 * è letto sul dispositivo (vedi deviceText.ts): nulla esce dal telefono.
 */

const LANGUAGE_NAMES = { it: 'Italian', en: 'English', de: 'German', fr: 'French' } as const;
/** L'AI del telefono ha poco contesto: si invia solo l'inizio dei documenti lunghi. */
const DEVICE_MAX_CHARS = 6000;

export interface ParsedExtraction {
  reportDate: string | null;
  labName: string | null;
  summary: string | null;
  results: LabResultInput[];
}

/**
 * Formato a righe, per tutti i modelli: molto più corto del JSON (una riga per valore invece
 * di un oggetto con sette campi), quindi la risposta arriva in pochi secondi anche per referti
 * con decine di misure. Il modello sul telefono, piccolo, sbaglia spesso la sintassi del JSON.
 * Nessun giudizio sui valori: i limiti li confronta l'app.
 * `detailed`: riassunto con i risultati principali (modelli online); sul telefono una frase.
 */
export function linesExtractionInstruction(language: string, detailed: boolean): string {
  return [
    'Read the health document below and copy its data in EXACTLY this format, nothing else:',
    'DATE: the date of the exam or of the period covered, as YYYY-MM-DD, or none',
    'LAB: the laboratory, clinic or device maker, or none',
    detailed
      ? `SUMMARY: 2–4 short sentences in ${language}: what the document is and its key findings (values out of range, diagnoses, conclusions). Facts only, no advice.`
      : `SUMMARY: one sentence in ${language} saying what kind of document this is. Do not judge the values.`,
    'VALUES:',
    'name | value | unit | reference range as written',
    'name is the measurement (e.g. Weight, LDL cholesterol, Daily steps), never the patient.',
    'The value is the number only, with a dot for decimals and no thousands separators (1930, not 1,930). If it is not a number, write it as in the document (e.g. negative, <0.5).',
    'Leave the reference range empty if the document has none.',
    'Write one line per measured value, copied exactly from the document. Never invent values.',
  ].join('\n');
}

/** Intervallo di riferimento dal testo: "13.0 – 17.0", "3,5-20", "< 200", "≥ 40". */
export function parseRange(text: string | null): { low: number | null; high: number | null } {
  if (!text) return { low: null, high: null };
  const t = text.replace(/,/g, '.').replace(/\s+/g, ' ').trim();
  const n = String.raw`(-?\d+(?:\.\d+)?)`;
  const between = new RegExp(`^${n}\\s*(?:-|–|—|to|a|bis|à)\\s*${n}`, 'i').exec(t);
  if (between) return { low: Number(between[1]), high: Number(between[2]) };
  const upper = new RegExp(`^(?:<|≤|<=|max\\.?|up to|fino a)\\s*${n}`, 'i').exec(t);
  if (upper) return { low: null, high: Number(upper[1]) };
  const lower = new RegExp(`^(?:>|≥|>=|min\\.?)\\s*${n}`, 'i').exec(t);
  if (lower) return { low: Number(lower[1]), high: null };
  return { low: null, high: null };
}

/** Risposta a righe del modello sul telefono. */
export function parseDeviceExtraction(text: string): ParsedExtraction | null {
  const field = (key: string) => {
    const m = new RegExp(`^\\s*\\**${key}\\**\\s*:\\s*(.+)$`, 'im').exec(text);
    const v = m?.[1]?.trim() ?? '';
    return v && !/^(none|null|n\/a|-)$/i.test(v) ? v : null;
  };
  const results: LabResultInput[] = [];
  for (const line of text.split('\n')) {
    const parts = line
      .replace(/^[\s*•-]+/, '')
      .split('|')
      .map((p) => p.trim());
    if (parts.length < 2 || !parts[0] || /^name$/i.test(parts[0])) continue;
    const value = num(parts[1]);
    const valueText = value === null ? str(parts[1], 60) : null;
    if (value === null && !valueText) continue;
    const refText = str(parts[3], 60);
    const range = parseRange(refText);
    results.push({
      name: parts[0].slice(0, 120),
      value,
      valueText,
      unit: str(parts[2], 30),
      refLow: range.low,
      refHigh: range.high,
      refText,
    });
    if (results.length >= 200) break;
  }
  const date = field('DATE');
  const summary = field('SUMMARY');
  if (!results.length && !summary) return null;
  return {
    reportDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    labName: field('LAB')?.slice(0, 120) ?? null,
    summary: summary?.slice(0, 600) ?? null,
    results,
  };
}

/**
 * Numero dal testo, con i separatori delle migliaia quando non sono ambigui:
 * "9,676" e "1'930" → migliaia; "3,5" → 3.5; "1,020" resta 1.02 (può essere un decimale,
 * es. il peso specifico delle urine); "1.234.567" e "1.930,5" → migliaia con punto.
 */
export function parseNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let t = v.trim().replace(/[\s'’]/g, '');
  if (!t) return null;
  const comma = /^-?(\d{1,3})((?:,\d{3})+)(\.\d+)?$/.exec(t);
  const dot = /^-?\d{1,3}((?:\.\d{3})+)(,\d+)?$/.exec(t);
  if (comma && (comma[2]!.length > 4 || comma[3] || !['0', '1'].includes(comma[1]!)))
    t = t.replace(/,/g, '');
  else if (dot && (dot[1]!.length > 4 || dot[2])) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
const num = parseNumber;
const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/** Legge la risposta del modello in modo tollerante (JSON anche dentro ```json … ```). */
export function parseExtraction(text: string): ParsedExtraction | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const date = str(data.report_date, 10);
  const results: LabResultInput[] = [];
  for (const raw of Array.isArray(data.results) ? data.results : []) {
    const r = raw as Record<string, unknown>;
    const name = str(r.name, 120);
    if (!name) continue;
    const value = num(r.value);
    const valueText = value === null ? (str(r.value_text, 60) ?? str(r.value, 60)) : null;
    if (value === null && !valueText) continue;
    const refText = str(r.ref_text, 60);
    let refLow = num(r.ref_low);
    let refHigh = num(r.ref_high);
    if (refLow === null && refHigh === null) ({ low: refLow, high: refHigh } = parseRange(refText));
    results.push({ name, value, valueText, unit: str(r.unit, 30), refLow, refHigh, refText });
    if (results.length >= 200) break;
  }
  return {
    reportDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    labName: str(data.lab_name, 120),
    summary: str(data.summary, 1200),
    results,
  };
}

/** Referti in lettura (per l'interfaccia) e contatore per ricaricare i dati dopo. */
export const useExtractionStore = create<{
  running: Record<string, true>;
  version: number;
  /** Perché l'ultima lettura non è riuscita (mostrato all'utente, utile per capire il problema). */
  failures: Record<string, ExtractionFailure>;
  /** Valori già letti durante la lettura in corso (la risposta arriva un pezzo alla volta). */
  progress: Record<string, number>;
}>(() => ({ running: {}, version: 0, failures: {}, progress: {} }));

function setProgress(reportId: string, count: number | null) {
  useExtractionStore.setState((s) => {
    const progress = { ...s.progress };
    if (count === null) delete progress[reportId];
    else progress[reportId] = count;
    return { progress };
  });
}

/** Righe "nome | valore | …" complete nel testo ricevuto finora (l'ultima può essere a metà). */
export function countValueLines(text: string): number {
  const complete = text.split('\n').slice(0, -1);
  return complete.filter((l) => {
    const [name, value] = l.replace(/^[\s*•-]+/, '').split('|');
    return value !== undefined && !!name?.trim() && !/^name$/i.test(name.trim());
  }).length;
}

export interface ExtractionFailure {
  /** Codice AIError, oppure 'timeout' / 'unparseable' / 'unreadable'. */
  code: string;
  detail?: string;
}

function setFailure(reportId: string, failure: ExtractionFailure | null) {
  useExtractionStore.setState((s) => {
    const failures = { ...s.failures };
    if (failure) failures[reportId] = failure;
    else delete failures[reportId];
    return { failures };
  });
}

/** Tempo massimo per leggere un referto. */
/** Lettura bloccata: nessun pezzo di risposta da così tanto tempo. */
const EXTRACTION_IDLE_MS = 60_000;
/** Tetto assoluto, anche se la risposta continua ad arrivare. */
const EXTRACTION_MAX_MS = 240_000;

export type ExtractionOutcome = 'ok' | 'no_ai' | 'unreadable' | 'failed';

/** Legge il referto e salva valori e riassunto. Una sola lettura alla volta per referto. */
export async function extractReport(
  settings: AppSettings,
  reportId: string,
): Promise<ExtractionOutcome> {
  if (!settings.ai.provider || !settings.ai.model) return 'no_ai';
  if (useExtractionStore.getState().running[reportId]) return 'ok';
  useExtractionStore.setState((s) => ({ running: { ...s.running, [reportId]: true } }));
  setFailure(reportId, null);
  const db = await getDb();
  const startedAt = Date.now();
  const timeout = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const report = await labReportRepository.getReport(db, reportId);
    if (!report) return 'failed';
    await labReportRepository.setExtractionStatus(db, reportId, 'pending');

    // Import pigro: evita il ciclo chatEngine → attachmentContent → labExtraction.
    const { resolveAI } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/coach/chatEngine') as typeof import('@/coach/chatEngine');
    const { provider, model, apiKey } = await resolveAI(settings);
    const device = provider.id === 'device';
    const content = await loadAttachmentContent(
      [{ reportId, title: report.title, mimeType: report.mimeType ?? '' }],
      { vision: provider.supportsVision(model), pdf: !device, preferText: 'all' },
    );
    if (__DEV__)
      console.warn(
        `[referti] ${provider.id}/${model}: immagini ${content.images.length}, pdf ${content.documents.length}, testi ${content.texts.length}, illeggibili ${content.unreadable.length}`,
      );
    if (!content.images.length && !content.documents.length && !content.texts.length) {
      await labReportRepository.setExtractionStatus(db, reportId, 'failed');
      setFailure(reportId, { code: 'unreadable' });
      return 'unreadable';
    }
    const language = LANGUAGE_NAMES[resolveLanguage(settings.language, deviceLanguageCodes())];
    const texts = content.texts.map(
      (d) =>
        `--- Document "${d.name}" ---\n${device ? d.text.slice(0, DEVICE_MAX_CHARS) : d.text}\n--- End of document ---`,
    );
    // Mai una rotella infinita: oltre il limite la lettura risulta non riuscita (si può riprovare).
    // Il limite vale per le pause, non per il totale: la risposta arriva un pezzo alla volta e
    // ogni pezzo fa ripartire il conteggio. Intanto si mostra quanti valori sono già stati letti.
    const restartIdle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => timeout.abort(), EXTRACTION_IDLE_MS);
    };
    restartIdle();
    maxTimer = setTimeout(() => timeout.abort(), EXTRACTION_MAX_MS);
    let streamed = '';
    let shown = 0;
    const onToken = (delta: string) => {
      restartIdle();
      streamed += delta;
      const count = countValueLines(streamed);
      if (count !== shown) {
        shown = count;
        setProgress(reportId, count);
      }
    };
    const result = await provider.sendMessage(
      {
        system:
          'You extract data from health documents for the user, accurately and without inventing anything.',
      },
      [
        {
          role: 'user',
          content: [
            linesExtractionInstruction(language, !device),
            ...texts,
          ].join('\n\n'),
          images: content.images.length ? content.images : undefined,
          documents: content.documents.length ? content.documents : undefined,
        },
      ],
      // Copiare valori è un compito semplice: poco ragionamento, risposta in pochi secondi.
      { apiKey, model, quick: true, maxOutputTokens: 12000, signal: timeout.signal, onToken },
    );
    // Righe; se un modello risponde comunque in JSON, si legge anche quello.
    const parsed =
      parseDeviceExtraction(result.text) ?? (device ? null : parseExtraction(result.text));
    if (!parsed) {
      if (__DEV__) console.warn(`[referti] risposta non leggibile: ${JSON.stringify(result.text)}`);
      await labReportRepository.setExtractionStatus(db, reportId, 'failed');
      setFailure(reportId, {
        code: 'unparseable',
        detail: `${result.stopReason} · ${result.text.slice(0, 120)}`,
      });
      return 'failed';
    }
    await labReportRepository.saveExtraction(db, reportId, parsed);
    if (__DEV__)
      console.warn(
        `[referti] letto in ${Math.round((Date.now() - startedAt) / 1000)} s: ${parsed.results.length} valori`,
      );
    return 'ok';
  } catch (e) {
    const err = toAIError(e);
    console.warn(`[referti] lettura non riuscita: ${err.code} ${err.message}`);
    setFailure(
      reportId,
      timeout.signal.aborted
        ? { code: 'timeout' }
        : { code: err.code, detail: err.message.slice(0, 200) },
    );
    await labReportRepository.setExtractionStatus(db, reportId, 'failed').catch(() => undefined);
    return 'failed';
  } finally {
    clearTimeout(timer);
    clearTimeout(maxTimer);
    setProgress(reportId, null);
    useExtractionStore.setState((s) => {
      const running = { ...s.running };
      delete running[reportId];
      return { running, version: s.version + 1 };
    });
  }
}

let backfilling = false;

/** Referti mai letti (aggiunti prima di questa funzione): il coach li legge uno alla volta. */
export async function extractUnreadReports(settings: AppSettings): Promise<void> {
  if (backfilling || !settings.ai.provider || !settings.ai.model) return;
  backfilling = true;
  try {
    const db = await getDb();
    const unread = (await labReportRepository.listReports(db)).filter(
      (r) => r.extractionStatus === 'none',
    );
    for (const r of unread) await extractReport(settings, r.id);
  } finally {
    backfilling = false;
  }
}
