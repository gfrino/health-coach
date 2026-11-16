import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { AppText } from '@/components';
import { itemScheduled, type Program, type ProgramItem } from '@/db/repositories/programRepository';
import { localIsoDate } from '@/lib/dates';
import { useTheme } from '@/theme';

import { ProgramItemRow } from './ProgramItemRow';
import type { ProgramView } from './usePrograms';
import { lastProgramDay } from './week';

/**
 * "Giorno 3 di 7", o "Finito il 15 nov · 7 giorni" se la durata è passata (prima restava
 * "Giorno 7 di 7" per sempre e sembrava ancora in corso).
 */
export function programDayLabel(program: Program, day: number, t: TFunction, language: string) {
  if (!program.durationDays) return t('programs.day', { day });
  const today = localIsoDate(new Date());
  const last = lastProgramDay(program, today);
  if (last < today) {
    const date = new Date(`${last}T12:00:00`).toLocaleDateString(language, {
      day: 'numeric',
      month: 'short',
    });
    return t('programs.endedOn', { date, total: program.durationDays });
  }
  return t('programs.dayOf', {
    day: Math.min(day, program.durationDays),
    total: program.durationDays,
  });
}

/** Azioni previste oggi e quante sono fatte (le altre restano visibili ma non contano). */
export function todayProgress(view: ProgramView) {
  const planned = view.program.items.filter((i) => itemScheduled(i, view.today));
  return { total: planned.length, done: planned.filter((i) => view.done.has(i.id)).length };
}

/** "1 di 1 fatte oggi" o, per un giorno passato, "1 di 1 fatte dom 8 nov". */
export function progressLabel(view: ProgramView, t: TFunction, language: string) {
  const { total, done } = todayProgress(view);
  if (view.isToday) return t('programs.todayProgress', { done, total });
  const date = new Date(`${view.today}T12:00:00`).toLocaleDateString(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return t('programs.dayProgress', { done, total, date });
}

/** Elenco delle azioni: prima quelle del giorno mostrato, poi (più chiare) quelle previste in altri giorni. */
export function ProgramTodayList({
  view,
  onToggle,
}: {
  view: ProgramView;
  onToggle: (item: ProgramItem, done: boolean) => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const planned = view.program.items.filter((i) => itemScheduled(i, view.today));
  const other = view.program.items.filter((i) => !itemScheduled(i, view.today));
  const row = (item: ProgramItem, scheduled: boolean) => (
    <ProgramItemRow
      key={item.id}
      item={item}
      done={view.done.has(item.id)}
      auto={view.auto.has(item.id)}
      scheduled={scheduled}
      onToggle={(d) => onToggle(item, d)}
    />
  );
  return (
    <View>
      {planned.map((i) => row(i, true))}
      {other.length ? (
        <>
          <AppText
            variant="caption"
            tone="textMuted"
            style={{ marginTop: spacing.sm, textTransform: 'uppercase' }}
          >
            {t('programs.otherDays')}
          </AppText>
          {other.map((i) => row(i, false))}
        </>
      ) : null}
    </View>
  );
}
