import type { ProfileContext } from '@/coach/context';
import { normalizeGoals } from '@/goals/goals';
import { localIsoDate } from '@/lib/dates';

import { newId } from '../ids';
import type { Db } from '../types';

export interface Profile {
  sex: 'female' | 'male' | 'other' | null;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  /** Chiavi degli obiettivi ('loseWeight', …); testi liberi restano come sono. */
  goals: string[];
  notes: string | null;
  /** Peso da raggiungere (kg), con data facoltativa (AAAA-MM-GG). */
  targetWeightKg: number | null;
  targetDate: string | null;
  /** Peso e giorno in cui l'obiettivo è stato fissato (per il progresso). */
  goalStartWeightKg: number | null;
  goalStartDate: string | null;
}

export interface Condition {
  id: string;
  name: string;
  notes: string | null;
}
export interface Medication {
  id: string;
  name: string;
  kind: 'medication' | 'supplement';
  dosage: string | null;
  frequency: string | null;
}
export interface Allergy {
  id: string;
  substance: string;
  reaction: string | null;
}

const EMPTY: Profile = {
  sex: null,
  birthDate: null,
  heightCm: null,
  weightKg: null,
  goals: [],
  notes: null,
  targetWeightKg: null,
  targetDate: null,
  goalStartWeightKg: null,
  goalStartDate: null,
};

interface ProfileRow {
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goals: string | null;
  notes: string | null;
  target_weight_kg: number | null;
  target_date: string | null;
  goal_start_weight_kg: number | null;
  goal_start_date: string | null;
}

export async function getProfile(db: Db): Promise<Profile> {
  const row = await db.getFirstAsync<ProfileRow>(
    `SELECT sex, birth_date, height_cm, weight_kg, goals, notes, target_weight_kg, target_date,
       goal_start_weight_kg, goal_start_date FROM profile WHERE id = 1`,
    [],
  );
  if (!row) return { ...EMPTY };
  let goals: string[] = [];
  try {
    const parsed: unknown = row.goals ? JSON.parse(row.goals) : [];
    if (Array.isArray(parsed)) goals = parsed.filter((g): g is string => typeof g === 'string');
  } catch {
    goals = [];
  }
  const sex = row.sex === 'female' || row.sex === 'male' || row.sex === 'other' ? row.sex : null;
  return {
    sex,
    birthDate: row.birth_date,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    // Le versioni precedenti salvavano il testo tradotto ("Perdere peso"): si converte in chiave.
    goals: normalizeGoals(goals),
    notes: row.notes,
    targetWeightKg: row.target_weight_kg,
    targetDate: row.target_date,
    goalStartWeightKg: row.goal_start_weight_kg,
    goalStartDate: row.goal_start_date,
  };
}

/**
 * Salva il profilo. Quando il peso obiettivo cambia, il punto di partenza diventa il peso attuale
 * di oggi (se non indicato), così il progresso si misura dal momento in cui l'obiettivo è fissato.
 */
export async function saveProfile(
  db: Db,
  patch: Partial<Profile>,
  today = localIsoDate(new Date()),
): Promise<void> {
  const prev = await getProfile(db);
  const p = { ...prev, ...patch, goals: normalizeGoals(patch.goals ?? prev.goals) };
  if (p.targetWeightKg === null) {
    p.targetDate = null;
    p.goalStartWeightKg = null;
    p.goalStartDate = null;
  } else if (p.targetWeightKg !== prev.targetWeightKg && patch.goalStartWeightKg === undefined) {
    p.goalStartWeightKg = p.weightKg;
    p.goalStartDate = today;
  }
  await db.runAsync(
    `INSERT INTO profile (id, sex, birth_date, height_cm, weight_kg, goals, notes, target_weight_kg,
       target_date, goal_start_weight_kg, goal_start_date, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET sex = excluded.sex, birth_date = excluded.birth_date,
       height_cm = excluded.height_cm, weight_kg = excluded.weight_kg, goals = excluded.goals,
       notes = excluded.notes, target_weight_kg = excluded.target_weight_kg,
       target_date = excluded.target_date, goal_start_weight_kg = excluded.goal_start_weight_kg,
       goal_start_date = excluded.goal_start_date, updated_at = excluded.updated_at`,
    [
      p.sex,
      p.birthDate,
      p.heightCm,
      p.weightKg,
      JSON.stringify(p.goals),
      p.notes,
      p.targetWeightKg,
      p.targetDate,
      p.goalStartWeightKg,
      p.goalStartDate,
      Date.now(),
    ],
  );
}

export const listConditions = (db: Db) =>
  db.getAllAsync<Condition>(
    'SELECT id, name, notes FROM conditions WHERE active = 1 ORDER BY created_at',
    [],
  );

export const listMedications = (db: Db) =>
  db.getAllAsync<Medication>(
    'SELECT id, name, kind, dosage, frequency FROM medications WHERE active = 1 ORDER BY created_at',
    [],
  );

export const listAllergies = (db: Db) =>
  db.getAllAsync<Allergy>('SELECT id, substance, reaction FROM allergies ORDER BY created_at', []);

export async function addCondition(
  db: Db,
  name: string,
  notes: string | null = null,
): Promise<string> {
  const id = newId();
  await db.runAsync('INSERT INTO conditions (id, name, notes, created_at) VALUES (?, ?, ?, ?)', [
    id,
    name.trim(),
    notes,
    Date.now(),
  ]);
  return id;
}

export async function addMedication(
  db: Db,
  m: {
    name: string;
    kind: 'medication' | 'supplement';
    dosage?: string | null;
    frequency?: string | null;
  },
): Promise<string> {
  const id = newId();
  await db.runAsync(
    'INSERT INTO medications (id, name, kind, dosage, frequency, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, m.name.trim(), m.kind, m.dosage ?? null, m.frequency ?? null, Date.now()],
  );
  return id;
}

export async function addAllergy(
  db: Db,
  substance: string,
  reaction: string | null = null,
): Promise<string> {
  const id = newId();
  await db.runAsync(
    'INSERT INTO allergies (id, substance, reaction, created_at) VALUES (?, ?, ?, ?)',
    [id, substance.trim(), reaction, Date.now()],
  );
  return id;
}

export async function removeItem(
  db: Db,
  table: 'conditions' | 'medications' | 'allergies',
  id: string,
) {
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

/** Profilo completo nel formato usato dalla composizione del contesto. */
export async function loadProfileContext(db: Db): Promise<ProfileContext> {
  const [profile, conditions, medications, allergies] = await Promise.all([
    getProfile(db),
    listConditions(db),
    listMedications(db),
    listAllergies(db),
  ]);
  return { ...profile, conditions, medications, allergies };
}
