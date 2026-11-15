import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getDb, programRepository } from '@/db';
import type { Program, ProgramItem } from '@/db/repositories/programRepository';
import { haptic } from '@/lib/haptics';
import { localIsoDate } from '@/lib/dates';
import { refreshCheckins } from '@/proactive/notifier';
import { useSyncStore } from '@/sources/syncService';

import { autoCheckPrograms } from './autoCheck';
import { addDays, buildWeek, dayInProgram, weekStart, type WeekDay } from './week';

export interface ProgramView {
  program: Program;
  /** Azioni fatte nel giorno mostrato (le "una volta" se fatte in qualsiasi giorno). */
  done: Set<string>;
  /** Tra quelle fatte, quelle spuntate dall'app da un allenamento o dai passi. */
  auto: Set<string>;
  /** Giorno mostrato (oggi, o un giorno passato scelto nella settimana). */
  today: string;
  /** Il giorno mostrato è oggi? */
  isToday: boolean;
  /** Giorno del programma del giorno mostrato (1 = primo). */
  day: number;
  /** Settimana (lun–dom) del giorno mostrato, con previste e fatte per giorno. */
  week: WeekDay[];
}

async function view(p: Program, day: string): Promise<ProgramView> {
  const db = await getDb();
  const realToday = localIsoDate(new Date());
  const start = weekStart(day);
  const [checks, weekChecks] = await Promise.all([
    programRepository.dayChecks(db, p.items, day),
    programRepository.checksBetween(db, p.items, start, addDays(start, 6)),
  ]);
  return {
    program: p,
    done: new Set(checks.keys()),
    auto: new Set([...checks].filter(([, s]) => s === 'auto').map(([id]) => id)),
    today: day,
    isToday: day === realToday,
    day: programRepository.programDay(p, day),
    week: buildWeek(p, day, realToday, weekChecks),
  };
}

/** Spunta / toglie la spunta del giorno mostrato; i check-in programmati si aggiornano. */
async function toggleItem(item: ProgramItem, day: string, done: boolean) {
  const db = await getDb();
  await programRepository.setItemDone(db, item, day, done);
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
  const week = v.week.map((d) =>
    d.day === v.today && item.frequency === 'daily' && v.done.has(item.id) !== done
      ? { ...d, done: Math.max(0, d.done + (done ? 1 : -1)) }
      : d,
  );
  return { ...v, done: next, auto, week };
};

/** Giorno scelto per ogni programma (resta finché l'app è aperta); di default oggi. */
const selectedDays = new Map<string, string>();

function shownDay(p: Program, today: string): string {
  const d = selectedDays.get(p.id);
  return d && dayInProgram(p, d, today) ? d : today;
}

/** Ricarica quando una sincronizzazione finisce: nuovi allenamenti possono aver spuntato azioni. */
function useReloadAfterSync(reload: () => Promise<void>) {
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void reload();
  }, [lastSyncAt, reload]);
}

/** Elenco dei programmi (attivi con le spunte del giorno mostrato, poi conclusi). */
export function usePrograms() {
  const [active, setActive] = useState<ProgramView[] | null>(null);
  const [finished, setFinished] = useState<Program[]>([]);

  const reload = useCallback(async () => {
    const db = await getDb();
    const today = localIsoDate(new Date());
    await autoCheckPrograms(db).catch(() => 0);
    const all = await programRepository.listPrograms(db);
    const views = await Promise.all(
      all.filter((p) => p.status === 'active').map((p) => view(p, shownDay(p, today))),
    );
    setActive(views);
    setFinished(all.filter((p) => p.status !== 'active'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  useReloadAfterSync(reload);

  const toggle = (item: ProgramItem, done: boolean) => {
    const v = active?.find((x) => x.program.id === item.programId);
    setActive((cur) => cur?.map((x) => withToggled(x, item, done)) ?? cur);
    void toggleItem(item, v?.today ?? localIsoDate(new Date()), done);
  };

  /** Mostra un altro giorno di un programma (settimana e spunte di quel giorno). */
  const selectDay = useCallback(async (program: Program, day: string) => {
    selectedDays.set(program.id, day);
    const next = await view(program, day);
    setActive((cur) => cur?.map((x) => (x.program.id === program.id ? next : x)) ?? cur);
  }, []);

  return { active, finished, reload, toggle, selectDay };
}

/** Un programma con le spunte del giorno mostrato. `null` = non trovato, `undefined` = in caricamento. */
export function useProgram(id: string) {
  const [state, setState] = useState<ProgramView | null | undefined>(undefined);

  const reload = useCallback(async () => {
    const db = await getDb();
    await autoCheckPrograms(db).catch(() => 0);
    const p = await programRepository.getProgram(db, id);
    setState(p ? await view(p, shownDay(p, localIsoDate(new Date()))) : null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  useReloadAfterSync(reload);

  const toggle = (item: ProgramItem, done: boolean) => {
    const day = state?.today ?? localIsoDate(new Date());
    setState((cur) => (cur ? withToggled(cur, item, done) : cur));
    void toggleItem(item, day, done);
  };

  const selectDay = useCallback(async (program: Program, day: string) => {
    selectedDays.set(program.id, day);
    setState(await view(program, day));
  }, []);

  return { view: state, reload, toggle, selectDay };
}
