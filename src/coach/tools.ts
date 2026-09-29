import type { ToolCall, ToolDefinition } from '@/ai/types';
import { healthQueries, type Db } from '@/db';
import { DAY_MS } from '@/lib/dates';
import { HEALTH_DATA_TYPES } from '@/sources/healthDataTypes';

/**
 * Funzioni locali esposte al modello via tool calling: interrogano il DB cifrato sul
 * dispositivo e restituiscono SOLO il risultato aggregato richiesto.
 */

const METRIC_TYPES = HEALTH_DATA_TYPES.map((t) => t.id).filter(
  (id) => id !== 'workouts' && id !== 'sleep',
);
const MAX_RANGE_DAYS = 400;
const DATE = { type: 'string', description: 'Date in YYYY-MM-DD format (local time).' };

export const COACH_TOOLS: ToolDefinition[] = [
  {
    name: 'get_metric',
    description:
      'Daily values of one health metric between two dates (sum per day for cumulative metrics such as steps, average for sampled ones such as heart rate).',
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
      default:
        return { content: JSON.stringify({ error: `unknown tool: ${call.name}` }), isError: true };
    }
  } catch (e) {
    const message =
      e instanceof ToolInputError ? e.message : 'internal error while reading local data';
    return { content: JSON.stringify({ error: message }), isError: true };
  }
}

const ok = (value: unknown): ToolOutcome => ({ content: JSON.stringify(value), isError: false });
