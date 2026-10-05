import type { ChatMessage } from '@/ai/types';
import type { CoachConfig, SupportedLanguage } from '@/config/settingsSchema';
import { localIsoDate } from '@/lib/dates';
import { extraMeasuresSection, type CycleInfo, type ExtraMeasure } from './extraMeasuresText';

import { dietGuideText } from './diets';
import type { Insights } from './insights';
import {
  ANSWER_GUIDE,
  coachIdentity,
  GETTING_TO_KNOW,
  MEMORY_RULE,
  JOURNAL_RULE,
  MEDICAL_PROMPTS,
  SAFETY_RULES,
  TONE_PROMPTS,
  LANGUAGE_NAMES,
} from './prompts';

/**
 * Composizione del contesto inviato al provider a ogni richiesta (le API sono stateless:
 * la memoria la gestisce l'app). Principio di minimizzazione: solo dati aggregati e solo
 * le sezioni che contengono qualcosa.
 */

export interface ProfileContext {
  sex?: 'female' | 'male' | 'other' | null;
  birthDate?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goals?: string[];
  conditions?: { name: string; notes?: string | null }[];
  medications?: {
    name: string;
    kind: 'medication' | 'supplement';
    dosage?: string | null;
    frequency?: string | null;
  }[];
  allergies?: { substance: string; reaction?: string | null }[];
}

export interface MetricSummary {
  label: string;
  unit: string;
  avg7?: number | null;
  avg30?: number | null;
  last?: number | null;
  trend?: 'up' | 'down' | 'stable' | null;
}

export interface LabHighlight {
  name: string;
  value: number | string;
  unit?: string | null;
  refLow?: number | null;
  refHigh?: number | null;
  date: string;
}

export interface JournalContext {
  date: string;
  mood?: number | null;
  energy?: number | null;
  text?: string | null;
  tags?: string[];
  symptoms?: string[];
}

export interface ProgramContext {
  id: string;
  title: string;
  goal: string | null;
  day: number;
  durationDays: number | null;
  /** Percentuale di azioni quotidiane fatte negli ultimi 7 giorni (null se appena iniziato). */
  adherence7: number | null;
  items: { id: string; title: string; frequency: 'daily' | 'once'; done: boolean }[];
}

export interface CoachContextInput {
  coach: CoachConfig;
  language: SupportedLanguage;
  profile?: ProfileContext;
  /** Fatti ricordati sull'utente (id per aggiornarli con il tool remember). */
  memoryFacts?: { id: string; text: string }[];
  summaries?: { date: string; text: string }[];
  metrics?: MetricSummary[];
  anomalies?: string[];
  /** Osservazioni già calcolate dall'app (confronti, giudizi, focus). */
  insights?: Insights;
  labs?: LabHighlight[];
  journal?: JournalContext[];
  /** Documenti della Cartella salute (solo elenco; il contenuto si apre con read_document). */
  records?: {
    id: string;
    title: string;
    date: string | null;
    kind: string;
    /** Riassunto scritto dall'AI quando ha letto il documento. */
    summary?: string | null;
  }[];
  /** Programmi attivi con le azioni e le spunte di oggi. */
  programs?: ProgramContext[];
  /** Ricette salvate (titolo, pasto, preferita, quante volte cucinata). */
  recipes?: { id: string; title: string; meal: string; favorite: boolean; cooked: number }[];
  /** Diario alimentare: voci di oggi, media dei giorni registrati, obiettivo calcolato dall'app. */
  food?: FoodContext | null;
  /** Altre misure di salute presenti (VO2 max, grasso corporeo, acqua…) e ciclo mestruale. */
  extras?: ExtraMeasure[];
  cycle?: CycleInfo | null;
  /** Prompt ridotto per i modelli sul telefono (contesto ~4K token). */
  compact?: boolean;
  /** Quando sono stati letti i totali di oggi dalla sorgente (null = non noto). */
  todayTotalsAt?: number | null;
  /** Data corrente (YYYY-MM-DD) e ora locale: in fondo al prompt per non invalidare la cache. */
  now: Date;
}

export function ageFromBirthDate(birthDate: string, now: Date): number | null {
  const d = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function profileSection(p: ProfileContext | undefined, now: Date): string | null {
  if (!p) return null;
  const lines: string[] = [];
  const basics: string[] = [];
  if (p.sex) basics.push(`sex: ${p.sex}`);
  const age = p.birthDate ? ageFromBirthDate(p.birthDate, now) : null;
  if (age !== null) basics.push(`age: ${age}`);
  if (p.heightCm) basics.push(`height: ${fmt(p.heightCm)} cm`);
  if (p.weightKg) basics.push(`weight: ${fmt(p.weightKg)} kg`);
  if (p.heightCm && p.weightKg) basics.push(`BMI: ${fmt(p.weightKg / (p.heightCm / 100) ** 2)}`);
  if (basics.length) lines.push(`- ${basics.join(', ')}`);
  if (p.goals?.length) lines.push(`- Goals: ${p.goals.join('; ')}`);
  if (p.conditions?.length) {
    lines.push(
      `- Conditions: ${p.conditions.map((c) => (c.notes ? `${c.name} (${c.notes})` : c.name)).join('; ')}`,
    );
  }
  const meds = p.medications?.filter((m) => m.kind === 'medication') ?? [];
  const supps = p.medications?.filter((m) => m.kind === 'supplement') ?? [];
  const medText = (m: NonNullable<ProfileContext['medications']>[number]) =>
    [m.name, m.dosage, m.frequency].filter(Boolean).join(' ');
  if (meds.length) lines.push(`- Prescribed medications: ${meds.map(medText).join('; ')}`);
  if (supps.length) lines.push(`- Supplements: ${supps.map(medText).join('; ')}`);
  if (p.allergies?.length) {
    lines.push(
      `- Allergies: ${p.allergies.map((a) => (a.reaction ? `${a.substance} (${a.reaction})` : a.substance)).join('; ')}`,
    );
  }
  return lines.length ? `USER PROFILE\n${lines.join('\n')}` : null;
}

function metricsSection(
  metrics: MetricSummary[] | undefined,
  anomalies: string[] | undefined,
): string | null {
  const lines: string[] = [];
  for (const m of metrics ?? []) {
    const parts: string[] = [];
    if (m.avg7 != null) parts.push(`7-day avg ${fmt(m.avg7)}`);
    if (m.avg30 != null) parts.push(`30-day avg ${fmt(m.avg30)}`);
    if (m.last != null) parts.push(`latest ${fmt(m.last)}`);
    if (m.trend) parts.push(`trend ${m.trend}`);
    if (parts.length) lines.push(`- ${m.label} (${m.unit}): ${parts.join(', ')}`);
  }
  for (const a of anomalies ?? []) lines.push(`- Notable: ${a}`);
  return lines.length ? `HEALTH DATA SNAPSHOT\n${lines.join('\n')}` : null;
}

function insightsSection(
  insights: Insights | undefined,
  anomalies: string[] | undefined,
): string | null {
  if (!insights?.lines.length && !anomalies?.length) return null;
  const lines = [
    ...(insights?.lines ?? []).map((l) => `- ${l}`),
    ...(anomalies ?? []).map((a) => `- Notable: ${a}`),
  ];
  if (insights?.focus) lines.push(`- Suggested focus: ${insights.focus}`);
  const recent = insights?.recent.length
    ? `\n${insights.recent.map((r) => `- ${r}`).join('\n')}`
    : '';
  return `KEY FACTS (computed by the app from the user's data; trust these numbers)\n${lines.join('\n')}${recent}`;
}

function labsSection(labs: LabHighlight[] | undefined): string | null {
  if (!labs?.length) return null;
  const lines = labs.map((l) => {
    const range =
      l.refLow != null || l.refHigh != null
        ? ` (reference ${l.refLow ?? '…'}–${l.refHigh ?? '…'})`
        : '';
    const flag =
      typeof l.value === 'number' && l.refHigh != null && l.value > l.refHigh
        ? ' HIGH'
        : typeof l.value === 'number' && l.refLow != null && l.value < l.refLow
          ? ' LOW'
          : '';
    return `- ${l.date} ${l.name}: ${l.value}${l.unit ? ` ${l.unit}` : ''}${range}${flag}`;
  });
  return `LAB RESULTS (latest value of each test, read from the user's reports; use get_lab_results for the history of a test)\n${lines.join('\n')}\nBase your advice on these real values when relevant, and mention the date of the result.`;
}

function recordsSection(
  records: CoachContextInput['records'],
  compact: boolean | undefined,
): string | null {
  if (!records?.length) return null;
  const list = (compact ? records.slice(0, 5) : records.slice(0, 25)).map((r) => {
    const summary = r.summary ? `\n  Summary: ${r.summary.slice(0, compact ? 240 : 500)}` : '';
    return `- ${compact ? '' : `[${r.id}] `}${r.title}${r.date ? ` — ${r.date}` : ''} (${r.kind})${summary}`;
  });
  const how = compact
    ? 'The summaries and LAB RESULTS above come from these documents: use them. You cannot open the full documents with the on-device model.'
    : 'Each summary and the LAB RESULTS were read from these documents. When the user asks about a report, exam, test result or document (e.g. "my latest Withings report") and you need more detail, call read_document with its id and base your answer on its contents. Never say you cannot see a document listed here. the user asks about a report, exam, test result or document (e.g. "my latest Withings report"), call read_document with its id and base your answer on its contents. Never say you cannot see a document listed here.';
  return `HEALTH RECORDS (documents the user saved in the app, newest first)\n${list.join('\n')}\n${how}`;
}

function journalSection(journal: JournalContext[] | undefined): string | null {
  if (!journal?.length) return null;
  const lines = journal.map((j) => {
    const bits = [
      j.mood != null ? `mood ${j.mood}/5` : null,
      j.energy != null ? `energy ${j.energy}/5` : null,
      j.symptoms?.length ? `symptoms: ${j.symptoms.join(', ')}` : null,
      j.tags?.length ? `tags: ${j.tags.join(', ')}` : null,
    ].filter(Boolean);
    const text = j.text ? ` — "${j.text.slice(0, 280)}"` : '';
    return `- ${j.date}: ${bits.join(', ')}${text}`;
  });
  return `RECENT JOURNAL ENTRIES (what the user wrote about how they feel)\n${lines.join('\n')}`;
}

/**
 * Dichiara esplicitamente quali dati MANCANO: i modelli (soprattutto quelli piccoli sul telefono)
 * altrimenti tendono a inventare valori plausibili. Messo in fondo, vicino alla domanda.
 */
export function dataAvailabilitySection(input: CoachContextInput): string {
  const missing: string[] = [];
  if (
    !input.metrics?.length &&
    !input.anomalies?.length &&
    !input.insights?.lines.length &&
    !input.extras?.length
  )
    missing.push('health measurements (activity, sleep, heart, body)');
  if (!input.labs?.length) missing.push('lab results');
  if (!input.journal?.length) missing.push('journal entries');
  const rule =
    'Only mention values, dates, days or trends that appear explicitly above or in tool results. Never guess or invent them.';
  return missing.length
    ? `DATA AVAILABILITY
Not available: ${missing.join('; ')}. If the user asks about these, say you don't have that data yet and explain how it will appear (connecting Apple Health / Health Connect, adding lab reports, writing in the journal).
${rule}`
    : `DATA AVAILABILITY
${rule}`;
}

const PROGRAM_RULE = `PROGRAMS
When the user asks for a plan, a routine or a program (or agrees to one you proposed), create it with create_program: a short title, the goal, 3–7 concrete, doable actions (daily habits or one-time steps), each with a one-line how-to. Adapt it to their data, conditions, diet and preferences. To change an existing program (add, edit or remove actions, rename, mark it completed) use update_program with ids from ACTIVE PROGRAMS. Tell the user the program is in the Programs tab, where they can tick actions and edit it. When relevant, encourage progress on their active programs.`;

export interface FoodContext {
  today: { id: string; meal: string; name: string; quantity: string | null; kcal: number | null }[];
  todayTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    saturatedFat?: number;
    sodium?: number;
  };
  /** Media sui giorni con voci negli ultimi 7 (oggi escluso). */
  avg7: { calories: number; days: number } | null;
  target: { kcal: number; custom: boolean } | null;
}

const FOOD_RULE = `FOOD DIARY
When the user tells you what they ate or drank (now or earlier today), log it with log_food in the same turn: split it into foods, estimate calories and macros for the portion they said (typical portions if not said), and pick the meal from what they say or the time. Never log something already in FOOD TODAY. Then confirm in one short phrase with the estimated total (e.g. "Logged: about 450 kcal"); they can correct it in the Food tab. Calories are estimates: say "about". Never judge or moralize about food; respect their diet and approach. Relate meals to their goals, labs and calorie target only when useful.`;

export function foodSection(
  food: FoodContext | null | undefined,
  compact?: boolean,
): string | null {
  if (!food) return null;
  const t = food.todayTotals;
  const head = [
    `Today so far: ${t.calories} kcal (protein ${t.protein} g, carbs ${t.carbs} g, fat ${t.fat} g${t.saturatedFat ? ` of which saturated ${t.saturatedFat} g` : ''}${t.fiber ? `, fiber ${t.fiber} g` : ''}${t.sugar ? `, sugar ${t.sugar} g` : ''}${t.sodium ? `, sodium ${t.sodium} mg` : ''}; estimates) in ${food.today.length} foods`,
    food.target
      ? `daily target ${food.target.kcal} kcal (${food.target.custom ? 'set by the user' : 'estimated by the app from profile and activity'})`
      : null,
    food.avg7
      ? `average of the last ${food.avg7.days} logged days: ${food.avg7.calories} kcal`
      : null,
  ]
    .filter(Boolean)
    .join('; ');
  if (compact) return `FOOD DIARY\n${head}.`;
  const lines = food.today.map(
    (f) =>
      `- [${f.id}] ${f.meal}: ${f.name}${f.quantity ? ` (${f.quantity})` : ''}${f.kcal != null ? ` · ${f.kcal} kcal` : ''}`,
  );
  return `FOOD TODAY (food diary, Food tab)\n${head}.${lines.length ? `\n${lines.join('\n')}` : '\nNothing logged yet today.'}`;
}

const RECIPE_RULE = `RECIPES
When the user asks for a recipe or a meal idea they may want to keep, save it with create_recipe (they find it in the Recipes tab). Every recipe must respect their allergies and intolerances, diet and approach, conditions, medications and tastes (see what you remember), and suit their goals and lab results. When suggesting meals, prefer their favourite and most cooked recipes from SAVED RECIPES.`;

export function recipesSection(
  recipes: CoachContextInput['recipes'],
  compact: boolean | undefined,
): string | null {
  if (!recipes?.length) return null;
  const lines = recipes.slice(0, compact ? 6 : 20).map((r) => {
    const bits = [
      r.meal !== 'any' ? r.meal : null,
      r.favorite ? 'favourite' : null,
      r.cooked ? `cooked ${r.cooked}×` : null,
    ].filter(Boolean);
    return `- ${compact ? '' : `[${r.id}] `}${r.title}${bits.length ? ` (${bits.join(', ')})` : ''}`;
  });
  return `SAVED RECIPES (in the Recipes tab)\n${lines.join('\n')}`;
}

export function programsSection(programs: ProgramContext[] | undefined, compact?: boolean) {
  if (!programs?.length) return null;
  const lines = programs.map((p) => {
    const head = `- ${compact ? '' : `[${p.id}] `}"${p.title}"${p.goal ? ` — goal: ${p.goal}` : ''} · day ${p.day}${p.durationDays ? ` of ${p.durationDays}` : ''}${p.adherence7 != null ? ` · last 7 days ${p.adherence7}% done` : ''}`;
    const items = p.items.map(
      (i) =>
        `  - ${compact ? '' : `[${i.id}] `}${i.title} (${i.frequency === 'once' ? 'once' : 'daily'}${i.done ? ', done' + (i.frequency === 'daily' ? ' today' : '') : ''})`,
    );
    return [head, ...items].join('\n');
  });
  return `ACTIVE PROGRAMS\n${lines.join('\n')}`;
}

/** Totali di oggi parziali: il modello deve dire "finora" e l'ora dei dati. */
export function todayTotalsLine(at: number | null | undefined): string | null {
  if (!at) return null;
  const hhmm = new Date(at).toTimeString().slice(0, 5);
  return `TODAY'S TOTALS (steps, calories, distance…) were read from the health app at ${hhmm}: they are partial and keep growing during the day. Say "so far today" and use these numbers or get_metric, never older ones from the conversation.`;
}

export function composeSystemPrompt(full: CoachContextInput): string {
  const input: CoachContextInput = full.compact
    ? {
        ...full,
        memoryFacts: full.memoryFacts?.slice(0, 12),
        summaries: full.summaries?.slice(0, 2),
        journal: full.journal?.slice(0, 3),
        labs: full.labs?.slice(0, 3),
      }
    : full;
  const { coach, language } = input;
  const sections: (string | null)[] = [
    coachIdentity(coach, language),
    `APPROACH\n${MEDICAL_PROMPTS[coach.medicalApproach]}\n${dietGuideText(coach.nutritionApproach, input.compact)}\n${TONE_PROMPTS[coach.tone]}`,
    SAFETY_RULES,
    profileSection(input.profile, input.now),
    input.memoryFacts?.length
      ? `WHAT YOU REMEMBER ABOUT THE USER (from previous conversations)\n${input.memoryFacts.map((f) => `- ${input.compact ? '' : `[${f.id}] `}${f.text}`).join('\n')}`
      : null,
    input.summaries?.length
      ? `SUMMARIES OF PREVIOUS CONVERSATIONS\n${input.summaries.map((s) => `- ${s.date}: ${s.text}`).join('\n')}`
      : null,
    insightsSection(input.insights, input.anomalies),
    // I modelli sul telefono hanno poco contesto: bastano le osservazioni già calcolate.
    input.compact && input.insights?.lines.length ? null : metricsSection(input.metrics, []),
    extraMeasuresSection(input.extras, input.cycle),
    labsSection(input.labs),
    recordsSection(input.records, input.compact),
    journalSection(input.journal),
    programsSection(input.programs, input.compact),
    recipesSection(input.recipes, input.compact),
    foodSection(input.food, input.compact),
    dataAvailabilitySection(input),
    ANSWER_GUIDE,
    // Il modello sul telefono non ha tool: niente regole sul diario.
    input.compact ? null : JOURNAL_RULE,
    input.compact ? null : PROGRAM_RULE,
    input.compact ? null : RECIPE_RULE,
    input.compact ? null : FOOD_RULE,
    input.compact ? null : MEMORY_RULE,
    (input.memoryFacts?.length ?? 0) < 8 ? GETTING_TO_KNOW : null,
    todayTotalsLine(input.todayTotalsAt),
    `LANGUAGE: start in ${LANGUAGE_NAMES[language]}, then reply in the language of the user's latest message.`,
    `CURRENT DATE: ${localIsoDate(input.now)} ${input.now.toTimeString().slice(0, 5)}`,
  ];
  return sections.filter((s): s is string => !!s).join('\n\n');
}

/**
 * Storico recente per il provider: ultimi N messaggi utente/assistente di testo,
 * iniziando sempre da un messaggio utente (requisito di alcuni provider).
 */
export function recentHistory(
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxMessages = 20,
): ChatMessage[] {
  const slice = messages.filter((m) => m.content.trim()).slice(-maxMessages);
  const firstUser = slice.findIndex((m) => m.role === 'user');
  return firstUser === -1
    ? []
    : slice.slice(firstUser).map((m) => ({ role: m.role, content: m.content }));
}
