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
    results.push({
      name,
      value,
      valueText,
      unit: str(r.unit, 30),
      refLow: num(r.ref_low),
      refHigh: num(r.ref_high),
      refText: str(r.ref_text, 60),
    });
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
          content: [extractionInstruction(language), ...texts].join('\n\n'),
          images: content.images.length ? content.images : undefined,
          documents: content.documents.length ? content.documents : undefined,
        },
      ],
      { apiKey, model },
    );
    const parsed = parseExtraction(result.text);
    if (!parsed) {
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
