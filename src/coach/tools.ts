import type { ToolCall, ToolDefinition } from '@/ai/types';
import {
  healthDataRepository,
  healthQueries,
  journalRepository,
  labReportRepository,
  memoryRepository,
  programRepository,
  foodRepository,
  recipeRepository,
  type Db,
} from '@/db';
import type { FoodEntry } from '@/db/repositories/foodRepository';
import { FOOD_MEALS } from '@/db/repositories/foodRepository';
import { PROGRAM_CATEGORIES } from '@/db/repositories/programRepository';
import { RECIPE_MEALS } from '@/db/repositories/recipeRepository';
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
      "Write in the user's health journal what they told you about how they feel: mood, energy, symptoms, and short notes (sleep quality, stress, events; food goes in log_food). Omit entry_id to create a new entry; pass the id of an entry (from get_journal or a previous save) to update it — only the fields you send change. Use the user's own words, briefly, in their language.",
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
  {
    name: 'remember',
    description:
      "Save, update or delete a lasting fact about the user in your memory (routine, work and schedule, family, food likes and dislikes, sports, what they tried and whether it worked, motivations). Short third-person sentence in the user's language. To change or remove a fact, pass its id from WHAT YOU REMEMBER.",
    parameters: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'The fact, e.g. "Works night shifts on weekends".' },
        fact_id: { type: 'string', description: 'Id of an existing fact to update or delete.' },
        delete: { type: 'boolean', description: 'true to delete the fact with fact_id.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_recipe',
    description:
      "Save a recipe in the user's Recipes tab. Use it when the user asks for a recipe or a meal idea they want to keep. It MUST respect their allergies and intolerances, diet, conditions and tastes. Metric quantities, in the user's language.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string', description: 'One sentence on why it suits the user.' },
        meal: { type: 'string', enum: [...RECIPE_MEALS] },
        servings: { type: 'integer', minimum: 1, maximum: 20 },
        prep_minutes: { type: 'integer', minimum: 1, maximum: 600 },
        ingredients: {
          type: 'array',
          items: { type: 'string' },
          description: 'One per item, with quantity, e.g. "200 g chickpeas".',
        },
        steps: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      },
      required: ['title', 'ingredients', 'steps'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_recipe',
    description:
      'Change one of the saved recipes (ids from SAVED RECIPES): any field you send replaces the old one; favorite marks it as a favourite.',
    parameters: {
      type: 'object',
      properties: {
        recipe_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        meal: { type: 'string', enum: [...RECIPE_MEALS] },
        servings: { type: 'integer', minimum: 1, maximum: 20 },
        prep_minutes: { type: 'integer', minimum: 1, maximum: 600 },
        ingredients: { type: 'array', items: { type: 'string' } },
        steps: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        favorite: { type: 'boolean' },
      },
      required: ['recipe_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_food',
    description:
      "Log in the user's food diary (Food tab) what they ate or drank. Split it into foods, estimate calories and macros for the portion they said (a typical portion if they gave none). Use it whenever the user tells you what they ate; check FOOD TODAY first so you never log the same thing twice.",
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 15,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Short food name in the user’s language.' },
              quantity: { type: 'string', description: 'e.g. "2 eggs", "120 g", "1 slice".' },
              calories: { type: 'number', description: 'Estimated kcal for that quantity.' },
              protein: { type: 'number', description: 'Grams.' },
              carbs: { type: 'number', description: 'Grams.' },
              fat: { type: 'number', description: 'Grams.' },
            },
            required: ['name', 'calories'],
            additionalProperties: false,
          },
        },
        meal: { type: 'string', enum: [...FOOD_MEALS], description: 'Default: from the time.' },
        eaten_at: {
          type: 'string',
          description: 'When they ate, local time "YYYY-MM-DD HH:MM". Default: now.',
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_food_entry',
    description:
      'Remove a wrong entry from the food diary (ids from FOOD TODAY or get_food_log), e.g. when the user says they did not eat it or you logged it twice.',
    parameters: {
      type: 'object',
      properties: { entry_id: { type: 'string' } },
      required: ['entry_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_food_log',
    description:
      'Read the food diary: daily calories and macros for a period, and the foods of one day.',
    parameters: {
      type: 'object',
      properties: {
        from: { ...DATE, description: 'First day (YYYY-MM-DD). Default: 7 days ago.' },
        to: { ...DATE, description: 'Last day (YYYY-MM-DD). Default: today.' },
        day: { ...DATE, description: 'Day whose single foods you want (YYYY-MM-DD).' },
      },
      additionalProperties: false,
    },
  },
];

class ToolInputError extends Error {}

/**
 * Apple Salute per le voci del diario alimentare create o cancellate dal coach. Registrati
 * all'avvio da src/food/healthWrite.ts: qui niente moduli nativi (i tool girano anche nei test).
 */
let onFoodLogged: ((entryId: string) => Promise<void>) | null = null;
let onFoodDeleted: ((entry: FoodEntry) => Promise<void>) | null = null;

export function setFoodHealthHooks(hooks: {
  logged: (entryId: string) => Promise<void>;
  deleted: (entry: FoodEntry) => Promise<void>;
}) {
  onFoodLogged = hooks.logged;
  onFoodDeleted = hooks.deleted;
}

/** "YYYY-MM-DD HH:MM" (o con la T) in ora locale → millisecondi; null se non valido o nel futuro. */
export function parseLocalDateTime(v: unknown, now = Date.now()): number | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(v.trim());
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 12),
    Number(m[5] ?? 0),
  );
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  // Un orario poco più avanti di adesso (orologi, arrotondamenti) diventa adesso.
  return t > now + 15 * 60 * 1000 ? null : Math.min(t, now);
}

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
      case 'remember': {
        const id = typeof args.fact_id === 'string' && args.fact_id ? args.fact_id : null;
        if (id && args.delete === true) {
          await memoryRepository.deleteFact(db, id);
          return ok({ deleted: true });
        }
        if (typeof args.fact !== 'string' || !args.fact.trim())
          throw new ToolInputError('"fact" is required');
        if (id) {
          if (!(await memoryRepository.updateFact(db, id, args.fact)))
            throw new ToolInputError('fact not found: use an id from WHAT YOU REMEMBER');
          return ok({ updated: true, fact_id: id });
        }
        return ok({ saved: true, fact_id: await memoryRepository.addFact(db, args.fact) });
      }
      case 'create_recipe': {
        if (typeof args.title !== 'string' || !args.title.trim())
          throw new ToolInputError('"title" is required');
        const ingredients = recipeRepository.cleanLines(args.ingredients);
        const steps = recipeRepository.cleanLines(args.steps, 40, 600);
        if (!ingredients.length || !steps.length)
          throw new ToolInputError('"ingredients" and "steps" need at least one line');
        const id = await recipeRepository.createRecipe(
          db,
          {
            title: args.title,
            description: typeof args.description === 'string' ? args.description : null,
            meal: recipeRepository.asMeal(args.meal),
            servings: typeof args.servings === 'number' ? args.servings : null,
            prepMinutes: typeof args.prep_minutes === 'number' ? args.prep_minutes : null,
            ingredients,
            steps,
            tags: recipeRepository.cleanLines(args.tags, 4, 40),
          },
          'coach',
        );
        return ok({ created: true, recipe_id: id, note: 'Shown in the Recipes tab.' });
      }
      case 'update_recipe': {
        const id = typeof args.recipe_id === 'string' ? args.recipe_id : '';
        if (!id || !(await recipeRepository.getRecipe(db, id)))
          throw new ToolInputError('recipe not found: use an id from SAVED RECIPES');
        const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
        const n = (v: unknown) => (typeof v === 'number' ? v : undefined);
        await recipeRepository.updateRecipe(db, id, {
          title: str(args.title),
          description: str(args.description),
          meal: args.meal !== undefined ? recipeRepository.asMeal(args.meal) : undefined,
          servings: n(args.servings),
          prepMinutes: n(args.prep_minutes),
          ingredients: Array.isArray(args.ingredients) ? (args.ingredients as string[]) : undefined,
          steps: Array.isArray(args.steps) ? (args.steps as string[]) : undefined,
          tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
          favorite: typeof args.favorite === 'boolean' ? args.favorite : undefined,
        });
        return ok({ updated: true, recipe_id: id });
      }
      case 'log_food': {
        const items = Array.isArray(args.items) ? args.items : [];
        if (!items.length) throw new ToolInputError('"items" needs at least one food');
        const eatenAt = parseLocalDateTime(args.eaten_at) ?? Date.now();
        const meal =
          args.meal !== undefined
            ? foodRepository.asFoodMeal(args.meal)
            : foodRepository.mealForTime(new Date(eatenAt));
        const num = (v: unknown) => (typeof v === 'number' ? v : null);
        const ids: string[] = [];
        for (const raw of items.slice(0, 15)) {
          const it = (raw ?? {}) as Record<string, unknown>;
          if (typeof it.name !== 'string' || !it.name.trim()) continue;
          ids.push(
            await foodRepository.createEntry(
              db,
              {
                name: it.name,
                quantity: typeof it.quantity === 'string' ? it.quantity : null,
                calories: num(it.calories),
                protein: num(it.protein),
                carbs: num(it.carbs),
                fat: num(it.fat),
                meal,
                eatenAt,
              },
              'coach',
            ),
          );
        }
        if (!ids.length) throw new ToolInputError('every item needs a "name"');
        for (const id of ids) void onFoodLogged?.(id);
        const day = await foodRepository.listDay(db, localIsoDate(new Date(eatenAt)));
        return ok({
          logged: ids.length,
          entry_ids: ids,
          meal,
          day_total_kcal: foodRepository.totals(day).calories,
          note: 'Shown in the Food tab, where the user can correct it. Values are estimates.',
        });
      }
      case 'delete_food_entry': {
        const id = typeof args.entry_id === 'string' ? args.entry_id : '';
        const entry = id ? await foodRepository.getEntry(db, id) : null;
        if (!entry) throw new ToolInputError('entry not found: use an id from FOOD TODAY');
        await onFoodDeleted?.(entry);
        await foodRepository.deleteEntry(db, id);
        return ok({ deleted: true });
      }
      case 'get_food_log': {
        const today = localIsoDate(new Date());
        const to = typeof args.to === 'string' ? args.to : today;
        const from =
          typeof args.from === 'string'
            ? args.from
            : localIsoDate(new Date(Date.now() - 6 * DAY_MS));
        const days = await foodRepository.dailyTotals(db, from, to);
        const day = typeof args.day === 'string' ? args.day : null;
        const foods = day
          ? (await foodRepository.listDay(db, day)).map((e) => ({
              id: e.id,
              meal: e.meal,
              name: e.name,
              quantity: e.quantity,
              kcal: e.calories,
            }))
          : undefined;
        return ok({ from, to, days, ...(day ? { day, foods } : {}) });
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
