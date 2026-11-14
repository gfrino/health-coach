import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getDb, programRepository } from '@/db';
import type { Program, ProgramItem } from '@/db/repositories/programRepository';
import { haptic } from '@/lib/haptics';
import { localIsoDate } from '@/lib/dates';
import { refreshCheckins } from '@/proactive/notifier';

import { autoCheckPrograms } from './autoCheck';

export interface ProgramView {
  program: Program;
  /** Azioni fatte oggi (le "una volta" se fatte in qualsiasi giorno). */
  done: Set<string>;
  /** Tra quelle fatte, quelle spuntate dall'app da un allenamento o dai passi. */
  auto: Set<string>;
  /** Data di oggi (per sapere quali azioni sono previste oggi). */
  today: string;
  /** Giorno del programma (1 = primo). */
  day: number;
}

async function view(p: Program, today: string): Promise<ProgramView> {
  const db = await getDb();
  const checks = await programRepository.dayChecks(db, p.items, today);
  return {
    program: p,
    done: new Set(checks.keys()),
    auto: new Set([...checks].filter(([, s]) => s === 'auto').map(([id]) => id)),
    today,
    day: programRepository.programDay(p, today),
  };
}

/** Spunta / toglie la spunta di oggi; i check-in programmati si aggiornano (azioni rimaste). */
async function toggleItem(item: ProgramItem, done: boolean) {
  const db = await getDb();
  await programRepository.setItemDone(db, item, localIsoDate(new Date()), done);
  if (done) haptic.success();
  else haptic.select();
  void refreshCheckins();
}

const withToggled = (v: ProgramView, item: ProgramItem, done: boolean): ProgramView => {
  if (v.program.id !== item.programId) return v;
  const next = new Set(v.done);
  const auto = new Set(v.auto);
  auto.delete(item.id);
  if (done) next.add(item.id);
  else next.delete(item.id);
  return { ...v, done: next, auto };
};

/** Elenco dei programmi (attivi con le spunte di oggi, poi conclusi), ricaricato a ogni focus. */
export function usePrograms() {
  const [active, setActive] = useState<ProgramView[] | null>(null);
  const [finished, setFinished] = useState<Program[]>([]);

  const reload = useCallback(async () => {
    const db = await getDb();
    const today = localIsoDate(new Date());
    await autoCheckPrograms(db).catch(() => 0);
    const all = await programRepository.listPrograms(db);
    const views = await Promise.all(
      all.filter((p) => p.status === 'active').map((p) => view(p, today)),
    );
    setActive(views);
    setFinished(all.filter((p) => p.status !== 'active'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const toggle = (item: ProgramItem, done: boolean) => {
    setActive((cur) => cur?.map((v) => withToggled(v, item, done)) ?? cur);
    void toggleItem(item, done);
  };

  return { active, finished, reload, toggle };
}

/** Un programma con le spunte di oggi. `null` = non trovato, `undefined` = in caricamento. */
export function useProgram(id: string) {
  const [state, setState] = useState<ProgramView | null | undefined>(undefined);

  const reload = useCallback(async () => {
    const db = await getDb();
    await autoCheckPrograms(db).catch(() => 0);
    const p = await programRepository.getProgram(db, id);
    setState(p ? await view(p, localIsoDate(new Date())) : null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const toggle = (item: ProgramItem, done: boolean) => {
    setState((cur) => (cur ? withToggled(cur, item, done) : cur));
    void toggleItem(item, done);
  };

  return { view: state, reload, toggle };
}
