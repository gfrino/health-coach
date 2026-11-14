import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components';
import { itemScheduled, type ProgramItem } from '@/db/repositories/programRepository';
import { useTheme } from '@/theme';

import { ProgramItemRow } from './ProgramItemRow';
import type { ProgramView } from './usePrograms';

/** Azioni previste oggi e quante sono fatte (le altre restano visibili ma non contano). */
export function todayProgress(view: ProgramView) {
  const planned = view.program.items.filter((i) => itemScheduled(i, view.today));
  return { total: planned.length, done: planned.filter((i) => view.done.has(i.id)).length };
}

/** Elenco delle azioni: prima quelle di oggi, poi (più chiare) quelle previste in altri giorni. */
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
