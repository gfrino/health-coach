import type { ChatMessage } from '@/ai/types';
import type { CoachConfig, SupportedLanguage } from '@/config/settingsSchema';
import { localIsoDate } from '@/lib/dates';

import { dietGuideText } from './diets';
import type { Insights } from './insights';
import {
  ANSWER_GUIDE,
  coachIdentity,
  JOURNAL_RULE,
  MEDICAL_PROMPTS,
  SAFETY_RULES,
  TONE_PROMPTS,
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
  memoryFacts?: string[];
  summaries?: { date: string; text: string }[];
  metrics?: MetricSummary[];
  anomalies?: string[];
  /** Osservazioni già calcolate dall'app (confronti, giudizi, focus). */
  insights?: Insights;
  labs?: LabHighlight[];
  journal?: JournalContext[];
  /** Documenti della Cartella salute (solo elenco; il contenuto si apre con read_document). */
  records?: { id: string; title: string; date: string | null; kind: string }[];
  /** Programmi attivi con le azioni e le spunte di oggi. */
  programs?: ProgramContext[];
  /** Prompt ridotto per i modelli sul telefono (contesto ~4K token). */
  compact?: boolean;
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
    return `- ${l.date} ${l.name}: ${l.value}${l.unit ? ` ${l.unit}` : ''}${range}`;
  });
  return `RECENT LAB RESULTS OUT OF RANGE\n${lines.join('\n')}`;
}

function recordsSection(
  records: CoachContextInput['records'],
  compact: boolean | undefined,
): string | null {
  if (!records?.length) return null;
  const list = (compact ? records.slice(0, 5) : records.slice(0, 25)).map(
    (r) => `- [${r.id}] ${r.title}${r.date ? ` — ${r.date}` : ''} (${r.kind})`,
  );
  const how = compact
    ? 'You cannot open these documents with the on-device model: if the user asks about one, say it is saved and that an online AI model (Settings) can read it.'
    : 'When the user asks about a report, exam, test result or document (e.g. "my latest Withings report"), call read_document with its id and base your answer on its contents. Never say you cannot see a document listed here.';
  return `HEALTH RECORDS (documents the user saved in the app, newest first)\n${list.join('\n')}\n${how}`;
}

function journalSection(journal: JournalContext[] | undefined): string | null {
  if (!journal?.length) return null;
  const lines = journal.map((j) => {
    const bits = [
      j.mood != null ? `mood ${j.mood}/5` : null,
      j.energy != null ? `energy ${j.energy}/5` : null,
      j.tags?.length ? `tags: ${j.tags.join(', ')}` : null,
    ].filter(Boolean);
    const text = j.text ? ` — "${j.text.slice(0, 280)}"` : '';
    return `- ${j.date}: ${bits.join(', ')}${text}`;
  });
  return `RECENT JOURNAL ENTRIES\n${lines.join('\n')}`;
}

/**
 * Dichiara esplicitamente quali dati MANCANO: i modelli (soprattutto quelli piccoli sul telefono)
 * altrimenti tendono a inventare valori plausibili. Messo in fondo, vicino alla domanda.
 */
export function dataAvailabilitySection(input: CoachContextInput): string {
  const missing: string[] = [];
  if (!input.metrics?.length && !input.anomalies?.length && !input.insights?.lines.length)
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

export function composeSystemPrompt(full: CoachContextInput): string {
  const input: CoachContextInput = full.compact
    ? {
        ...full,
        memoryFacts: full.memoryFacts?.slice(0, 5),
        summaries: full.summaries?.slice(0, 1),
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
      ? `WHAT YOU REMEMBER ABOUT THE USER\n${input.memoryFacts.map((f) => `- ${f}`).join('\n')}`
      : null,
    input.summaries?.length
      ? `SUMMARIES OF PREVIOUS CONVERSATIONS\n${input.summaries.map((s) => `- ${s.date}: ${s.text}`).join('\n')}`
      : null,
    insightsSection(input.insights, input.anomalies),
    // I modelli sul telefono hanno poco contesto: bastano le osservazioni già calcolate.
    input.compact && input.insights?.lines.length ? null : metricsSection(input.metrics, []),
    labsSection(input.labs),
    recordsSection(input.records, input.compact),
    journalSection(input.journal),
    programsSection(input.programs, input.compact),
    dataAvailabilitySection(input),
    ANSWER_GUIDE,
    // Il modello sul telefono non ha tool: niente regole sul diario.
    input.compact ? null : JOURNAL_RULE,
    input.compact ? null : PROGRAM_RULE,
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
