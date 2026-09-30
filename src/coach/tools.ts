import type { ToolCall, ToolDefinition } from '@/ai/types';
import { healthDataRepository, healthQueries, journalRepository, type Db } from '@/db';
import { DAY_MS } from '@/lib/dates';
import { METRIC_UNITS, SleepStage } from '@/sources/model';
import { stageMinutes } from '@/sources/sleep';

/**
 * Funzioni locali esposte al modello via tool calling: interrogano il DB cifrato sul
 * dispositivo e restituiscono SOLO il risultato aggregato richiesto.
 */

/** Metriche interrogabili + i due tipi "speciali" (notti di sonno e allenamenti). */
const METRIC_TYPES = [
  ...Object.keys(METRIC_UNITS).filter((k) => k !== 'sleepStage'),
  'sleep',
  'workouts',
];
const MAX_RANGE_DAYS = 400;
const DATE = { type: 'string', description: 'Date in YYYY-MM-DD format (local time).' };

export const COACH_TOOLS: ToolDefinition[] = [
  {
    name: 'get_metric',
    description:
      'Daily values of one health metric between two dates (sum per day for cumulative metrics such as steps, average for sampled ones such as heart rate). "sleep" returns one row per night (hours asleep and stage minutes); "workouts" returns the list of workouts.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: METRIC_TYPES, description: 'Metric identifier.' },
        from: DATE,
        to: DATE,
      },
      required: ['type', 'from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_lab_results',
    description:
      'History of a laboratory test (e.g. "cholesterol", "ferritin", "HbA1c") with values and reference ranges.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the lab test, in any language.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_journal',
    description:
      "The user's journal entries (mood 1-5, energy 1-5, notes, symptoms, tags) between two dates.",
    parameters: {
      type: 'object',
      properties: { from: DATE, to: DATE },
      required: ['from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'save_journal_entry',
    description:
      "Write in the user's health journal what they told you about how they feel: mood, energy, symptoms, and short notes (sleep quality, meals, stress, events). Omit entry_id to create a new entry; pass the id of an entry (from get_journal or a previous save) to update it — only the fields you send change. Use the user's own words, briefly, in their language.",
    parameters: {
      type: 'object',
      properties: {
        entry_id: { type: 'string', description: 'Id of the entry to update. Omit to create.' },
        date: { ...DATE, description: 'Day of the entry (YYYY-MM-DD). Default: today.' },
        mood: { type: 'integer', minimum: 1, maximum: 5, description: '1 = very bad … 5 = great.' },
        energy: {
          type: 'integer',
          minimum: 1,
          maximum: 5,
          description: '1 = exhausted … 5 = full of energy.',
        },
        symptoms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Symptoms mentioned, e.g. "headache", "bloating".',
        },
        text: { type: 'string', description: 'Short note in the user’s language.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional keywords.' },
      },
      additionalProperties: false,
    },
  },
];

class ToolInputError extends Error {}

function parseDate(v: unknown, field: string): number {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new ToolInputError(`"${field}" must be a date in YYYY-MM-DD format`);
  }
  const t = new Date(`${v}T00:00:00`).getTime();
  if (Number.isNaN(t)) throw new ToolInputError(`"${field}" is not a valid date`);
  return t;
}

function parseRange(args: Record<string, unknown>): [number, number] {
  const from = parseDate(args.from, 'from');
  const to = parseDate(args.to, 'to') + DAY_MS; // "to" incluso
  if (to <= from) throw new ToolInputError('"to" must not be before "from"');
  if (to - from > MAX_RANGE_DAYS * DAY_MS)
    throw new ToolInputError(`range longer than ${MAX_RANGE_DAYS} days`);
  return [from, to];
}

export interface ToolOutcome {
  content: string;
  isError: boolean;
}

export async function executeTool(db: Db, call: ToolCall): Promise<ToolOutcome> {
  try {
    const args = call.arguments;
    switch (call.name) {
      case 'get_metric': {
        const type = args.type;
        if (
          typeof type !== 'string' ||
          !METRIC_TYPES.includes(type as (typeof METRIC_TYPES)[number])
        ) {
          throw new ToolInputError(`unknown metric type: ${String(type)}`);
        }
        const [from, to] = parseRange(args);
        if (type === 'sleep') {
          const nights = await healthDataRepository.nightsBetween(db, from, to);
          const rows = nights.map((n) => ({
            night_ending: n.day,
            hours_asleep: Math.round((n.asleepMin / 60) * 10) / 10,
            hours_in_bed: n.inBedMin != null ? Math.round((n.inBedMin / 60) * 10) / 10 : null,
            ...sleepStageMinutes(n.stages),
          }));
          return ok(rows.length ? rows : { message: 'No sleep data recorded in the period.' });
        }
        if (type === 'workouts') {
          const rows = await healthDataRepository.workoutsBetween(db, from, to, 100);
          return ok(
            rows.length
              ? rows.map((w) => ({ ...w, date: new Date(w.startAt).toISOString().slice(0, 10) }))
              : { message: 'No workouts recorded in the period.' },
          );
        }
        const res = await healthQueries.dailyMetric(db, type, from, to);
        return ok(
          res.days.length ? res : { message: 'No data recorded for this metric in the period.' },
        );
      }
      case 'get_lab_results': {
        if (typeof args.name !== 'string' || !args.name.trim())
          throw new ToolInputError('"name" is required');
        const rows = await healthQueries.labResultsByName(db, args.name);
        return ok(rows.length ? rows : { message: 'No lab results found with this name.' });
      }
      case 'get_journal': {
        const [from, to] = parseRange(args);
        const rows = await healthQueries.journalRange(db, from, to);
        return ok(rows.length ? rows : { message: 'No journal entries in the period.' });
      }
      case 'save_journal_entry': {
        const input = journalInput(args);
        if (typeof args.entry_id === 'string' && args.entry_id) {
          const updated = await journalRepository.updateEntry(db, args.entry_id, input);
          if (!updated) throw new ToolInputError('entry not found');
          return ok({ saved: true, entry_id: args.entry_id });
        }
        if (input.mood == null && input.energy == null && !input.text && !input.symptoms?.length)
          throw new ToolInputError('nothing to save: give mood, energy, symptoms or text');
        const id = await journalRepository.createEntry(db, input, 'coach');
        return ok({ saved: true, entry_id: id });
      }
      default:
        return { content: JSON.stringify({ error: `unknown tool: ${call.name}` }), isError: true };
    }
  } catch (e) {
    const message =
      e instanceof ToolInputError ? e.message : 'internal error while reading local data';
    return { content: JSON.stringify({ error: message }), isError: true };
  }
}

function journalInput(args: Record<string, unknown>): journalRepository.JournalInput {
  const out: journalRepository.JournalInput = {};
  if (args.date !== undefined) {
    // Mezzogiorno del giorno indicato; oggi → adesso.
    const day = parseDate(args.date, 'date');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    out.entryAt = day === today.getTime() ? Date.now() : day + 12 * 60 * 60 * 1000;
  }
  const scale = (v: unknown, field: string) => {
    if (v === undefined) return undefined;
    if (typeof v !== 'number' || v < 1 || v > 5) throw new ToolInputError(`"${field}" must be 1–5`);
    return v;
  };
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;
  out.mood = scale(args.mood, 'mood');
  out.energy = scale(args.energy, 'energy');
  if (typeof args.text === 'string') out.text = args.text.slice(0, 2000);
  if (args.symptoms !== undefined) out.symptoms = strings(args.symptoms);
  if (args.tags !== undefined) out.tags = strings(args.tags);
  for (const k of Object.keys(out) as (keyof typeof out)[]) if (out[k] === undefined) delete out[k];
  return out;
}

function sleepStageMinutes(stages: { stage: number; startAt: number; endAt: number }[]) {
  const m = stageMinutes(stages);
  return stages.length
    ? {
        deep_min: m[SleepStage.Deep] ?? 0,
        rem_min: m[SleepStage.REM] ?? 0,
        light_min: m[SleepStage.Light] ?? 0,
        awake_min: m[SleepStage.Awake] ?? 0,
      }
    : {};
}

const ok = (value: unknown): ToolOutcome => ({ content: JSON.stringify(value), isError: false });
