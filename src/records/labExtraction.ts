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

export function extractionInstruction(language: string): string {
  return [
    'Read the attached health document (lab report, medical report, imaging, prescription, device report…).',
    'Reply ONLY with JSON, no other text, in this shape:',
    '{"report_date":"YYYY-MM-DD or null","lab_name":"lab or clinic, or null","summary":"…","results":[{"name":"…","value":12.3,"value_text":null,"unit":"mg/dL","ref_low":3.5,"ref_high":20,"ref_text":"3.5-20"}]}',
    `- summary: 2–4 short sentences in ${language}: what the document is and its key findings (values out of range, diagnoses, conclusions). Facts only, no advice.`,
    '- results: EVERY measured value in the document (blood and urine tests, vitals, body composition, scores…), with the name as written. value: a number with a dot as decimal separator, or null with the original in value_text (e.g. "negative", "<0.5"). ref_low/ref_high: numeric limits of the reference range when present, otherwise null; ref_text: the range as written.',
    '- Never invent values: leave out anything that is not in the document. If it contains no measured values, results is [].',
  ].join('\n');
}

/**
 * Il modello sul telefono è piccolo: con il JSON sbaglia spesso la sintassi. Gli si chiede un
 * formato a righe, facile da scrivere e da leggere, e nessun giudizio sui valori (lo fa l'app).
 */
export function deviceExtractionInstruction(language: string): string {
  return [
    'Read the health document below and copy its data in EXACTLY this format, nothing else:',
    'DATE: the date of the exam as YYYY-MM-DD, or none',
    'LAB: the laboratory or clinic, or none',
    `SUMMARY: one sentence in ${language} saying what kind of document this is. Do not judge the values.`,
    'VALUES:',
    'name | value | unit | reference range as written',
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

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.').trim());
    return v.trim() && Number.isFinite(n) ? n : null;
  }
  return null;
};
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
export const useExtractionStore = create<{ running: Record<string, true>; version: number }>(
  () => ({ running: {}, version: 0 }),
);

export type ExtractionOutcome = 'ok' | 'no_ai' | 'unreadable' | 'failed';

/** Legge il referto e salva valori e riassunto. Una sola lettura alla volta per referto. */
export async function extractReport(
  settings: AppSettings,
  reportId: string,
): Promise<ExtractionOutcome> {
  if (!settings.ai.provider || !settings.ai.model) return 'no_ai';
  if (useExtractionStore.getState().running[reportId]) return 'ok';
  useExtractionStore.setState((s) => ({ running: { ...s.running, [reportId]: true } }));
  const db = await getDb();
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
      { vision: provider.supportsVision(model), pdf: !device },
    );
    if (__DEV__)
      console.warn(
        `[referti] ${provider.id}/${model}: immagini ${content.images.length}, pdf ${content.documents.length}, testi ${content.texts.length}, illeggibili ${content.unreadable.length}`,
      );
    if (!content.images.length && !content.documents.length && !content.texts.length) {
      await labReportRepository.setExtractionStatus(db, reportId, 'failed');
      return 'unreadable';
    }
    const language = LANGUAGE_NAMES[resolveLanguage(settings.language, deviceLanguageCodes())];
    const texts = content.texts.map(
      (d) =>
        `--- Document "${d.name}" ---\n${device ? d.text.slice(0, DEVICE_MAX_CHARS) : d.text}\n--- End of document ---`,
    );
    const result = await provider.sendMessage(
      {
        system:
          'You extract data from health documents for the user, accurately and without inventing anything.',
      },
      [
        {
          role: 'user',
          content: [
            device ? deviceExtractionInstruction(language) : extractionInstruction(language),
            ...texts,
          ].join('\n\n'),
          images: content.images.length ? content.images : undefined,
          documents: content.documents.length ? content.documents : undefined,
        },
      ],
      { apiKey, model },
    );
    const parsed = device ? parseDeviceExtraction(result.text) : parseExtraction(result.text);
    if (!parsed) {
      if (__DEV__) console.warn(`[referti] risposta non leggibile: ${JSON.stringify(result.text)}`);
      await labReportRepository.setExtractionStatus(db, reportId, 'failed');
      return 'failed';
    }
    await labReportRepository.saveExtraction(db, reportId, parsed);
    return 'ok';
  } catch (e) {
    const err = toAIError(e);
    console.warn(`[referti] lettura non riuscita: ${err.code}`);
    await labReportRepository.setExtractionStatus(db, reportId, 'failed').catch(() => undefined);
    return 'failed';
  } finally {
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
