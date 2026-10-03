import type { ToolCall, ToolDefinition } from '@/ai/types';
import {
  healthDataRepository,
  healthQueries,
  journalRepository,
  labReportRepository,
  programRepository,
  type Db,
} from '@/db';
import { PROGRAM_CATEGORIES } from '@/db/repositories/programRepository';
import { parseProgramItems } from '@/programs/parse';
import type { MessageAttachment } from '@/db/repositories/conversationRepository';
import { DAY_MS, localIsoDate } from '@/lib/dates';
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
const PROGRAM_ITEM = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'The action, short and concrete.' },
    details: { type: 'string', description: 'One line on how or why.' },
    frequency: {
      type: 'string',
      enum: ['daily', 'once'],
      description: 'daily = a habit to tick every day; once = a single step.',
    },
  },
  required: ['title'],
  additionalProperties: false,
} as const;

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
    name: 'read_document',
    description:
      "Open one document from the user's health records (lab reports, medical reports, Withings/doctor PDFs, photos of results) to read its contents. Use the id from the HEALTH RECORDS list. The document is shown to you right after this call.",
    parameters: {
      type: 'object',
      properties: {
        report_id: { type: 'string', description: 'Id of the document from HEALTH RECORDS.' },
      },
      required: ['report_id'],
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
  {
    name: 'create_program',
    description:
      "Create a program in the Programs tab: a plan with concrete actions the user ticks off (daily habits or one-time steps). Use it when the user asks for a plan/routine/program or accepts one you proposed. Write in the user's language.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title, e.g. "Better sleep in 14 days".' },
        goal: { type: 'string', description: 'One sentence: what the program aims for.' },
        category: { type: 'string', enum: [...PROGRAM_CATEGORIES] },
        duration_days: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          description: 'Length in days. Omit for an open-ended program.',
        },
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 12,
          description: '3–7 concrete actions.',
          items: PROGRAM_ITEM,
        },
      },
      required: ['title', 'items'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_program',
    description:
      'Change one of the ACTIVE PROGRAMS: rename it, change the goal, mark it completed or archived, add actions, edit or remove actions (ids from ACTIVE PROGRAMS). Only the fields you send change.',
    parameters: {
      type: 'object',
      properties: {
        program_id: { type: 'string' },
        title: { type: 'string' },
        goal: { type: 'string' },
        status: { type: 'string', enum: ['active', 'completed', 'archived'] },
        add_items: { type: 'array', items: PROGRAM_ITEM },
        update_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { item_id: { type: 'string' }, ...PROGRAM_ITEM.properties },
            required: ['item_id'],
            additionalProperties: false,
          },
        },
        remove_item_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['program_id'],
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
  /** Documento della Cartella da mostrare al modello (contenuto inviato nel messaggio seguente). */
  attachment?: MessageAttachment;
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
      case 'read_document': {
        if (typeof args.report_id !== 'string' || !args.report_id)
          throw new ToolInputError('"report_id" is required');
        const report = await labReportRepository.getReport(db, args.report_id);
        if (!report) throw new ToolInputError('document not found: use an id from HEALTH RECORDS');
        return {
          content: JSON.stringify({
            ok: true,
            title: report.title,
            date: report.reportDate,
            note: 'The document content follows in the next message.',
          }),
          isError: false,
          attachment: {
            reportId: report.id,
            title: report.title,
            mimeType: report.mimeType ?? '',
          },
        };
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
      case 'create_program': {
        if (typeof args.title !== 'string' || !args.title.trim())
          throw new ToolInputError('"title" is required');
        const items = parseProgramItems(args.items);
        if (!items.length) throw new ToolInputError('"items" needs at least one action');
        const duration =
          typeof args.duration_days === 'number' && args.duration_days >= 1
            ? Math.min(365, Math.round(args.duration_days))
            : null;
        const id = await programRepository.createProgram(
          db,
          {
            title: args.title.slice(0, 80),
            goal: typeof args.goal === 'string' ? args.goal.slice(0, 300) : null,
            category: programRepository.asCategory(args.category),
            startDay: localIsoDate(new Date()),
            durationDays: duration,
            items,
          },
          'coach',
        );
        const created = await programRepository.getProgram(db, id);
        return ok({
          created: true,
          program_id: id,
          item_ids: created?.items.map((i) => ({ id: i.id, title: i.title })),
          note: 'Shown in the Programs tab, where the user can tick actions and edit it.',
        });
      }
      case 'update_program': {
        const id = typeof args.program_id === 'string' ? args.program_id : '';
        const program = id ? await programRepository.getProgram(db, id) : null;
        if (!program) throw new ToolInputError('program not found: use an id from ACTIVE PROGRAMS');
        const status = args.status;
        await programRepository.updateProgram(db, id, {
          title: typeof args.title === 'string' ? args.title.slice(0, 80) : undefined,
          goal: typeof args.goal === 'string' ? args.goal.slice(0, 300) : undefined,
          status:
            status === 'active' || status === 'completed' || status === 'archived'
              ? status
              : undefined,
        });
        const own = new Set(program.items.map((i) => i.id));
        if (Array.isArray(args.remove_item_ids))
          for (const itemId of args.remove_item_ids)
            if (typeof itemId === 'string' && own.has(itemId))
              await programRepository.removeItem(db, itemId);
        if (Array.isArray(args.update_items))
          for (const u of args.update_items as Record<string, unknown>[]) {
            if (typeof u?.item_id !== 'string' || !own.has(u.item_id)) continue;
            await programRepository.updateItem(db, u.item_id, {
              title: typeof u.title === 'string' ? u.title.slice(0, 120) : undefined,
              details: typeof u.details === 'string' ? u.details.slice(0, 300) : undefined,
              frequency:
                u.frequency === 'once' || u.frequency === 'daily' ? u.frequency : undefined,
            });
          }
        for (const item of parseProgramItems(args.add_items))
          await programRepository.addItem(db, id, item);
        return ok({ updated: true, program_id: id });
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
