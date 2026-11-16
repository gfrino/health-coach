import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon } from '@/components';
import { haptic } from '@/lib/haptics';
import { localIsoDate } from '@/lib/dates';
import { useTheme } from '@/theme';

import type { ProgramView } from './usePrograms';
import { defaultProgramDay, shiftWeek } from './week';

const date = (day: string) => new Date(`${day}T12:00:00`);

/**
 * Settimana del programma con le frecce per le settimane prima: ogni giorno mostra se le azioni
 * previste sono state fatte; toccandolo si vedono (e si spuntano) le azioni di quel giorno.
 */
export function ProgramWeekNav({
  view,
  onSelect,
}: {
  view: ProgramView;
  onSelect: (day: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const today = localIsoDate(new Date());
  const prev = shiftWeek(view.program, view.today, today, -1);
  const next = shiftWeek(view.program, view.today, today, 1);
  // Programma finito: il "ritorno" porta all'ultimo giorno invece che a oggi.
  const home = defaultProgramDay(view.program, today);
  const first = view.week[0]!.day;
  const last = view.week[6]!.day;
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
    date(d).toLocaleDateString(i18n.language, o);
  const range = `${fmt(first, { day: 'numeric', month: 'short' })} – ${fmt(last, { day: 'numeric', month: 'short' })}`;

  const go = (day: string | null) => {
    if (!day) return;
    haptic.select();
    onSelect(day);
  };

  const arrow = (dir: 'prev' | 'next', target: string | null) => (
    <Pressable
      onPress={() => go(target)}
      disabled={!target}
      accessibilityRole="button"
      accessibilityLabel={t(dir === 'prev' ? 'programs.prevWeek' : 'programs.nextWeek')}
      accessibilityState={{ disabled: !target }}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: !target ? 0.25 : pressed ? 0.5 : 1,
      })}
    >
      <Icon
        name={dir === 'prev' ? 'chevronLeft' : 'chevronRight'}
        size={14}
        color={colors.primary}
      />
    </Pressable>
  );

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {arrow('prev', prev)}
        <AppText variant="callout" style={{ flex: 1, textAlign: 'center', fontWeight: '600' }}>
          {range}
        </AppText>
        {arrow('next', next)}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {view.week.map((d) => {
          const selected = d.day === view.today;
          const complete = d.planned > 0 && d.done >= d.planned;
          const partial = d.done > 0 && !complete;
          const status = !d.planned
            ? t('programs.dayNothing')
            : t('programs.dayStatus', { done: d.done, total: d.planned });
          return (
            <Pressable
              key={d.day}
              onPress={() => go(d.day)}
              disabled={!d.enabled}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: !d.enabled }}
              accessibilityLabel={`${fmt(d.day, { weekday: 'long', day: 'numeric', month: 'long' })}: ${status}`}
              style={({ pressed }) => ({
                alignItems: 'center',
                gap: 4,
                minWidth: 40,
                paddingVertical: 2,
                opacity: !d.enabled ? 0.3 : pressed ? 0.6 : 1,
              })}
            >
              <AppText variant="caption" tone={d.day === today ? 'primary' : 'textMuted'}>
                {fmt(d.day, { weekday: 'narrow' })}
              </AppText>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected
                    ? colors.primary
                    : complete
                      ? colors.primarySoft
                      : 'transparent',
                  borderWidth: selected || complete ? 0 : 1.5,
                  borderColor: partial ? colors.primary : colors.border,
                }}
              >
                <AppText
                  variant="callout"
                  style={{
                    color: selected ? colors.onPrimary : complete ? colors.primary : colors.text,
                    fontWeight: selected || d.day === today ? '700' : '400',
                  }}
                >
                  {date(d.day).getDate()}
                </AppText>
              </View>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: complete ? colors.primary : 'transparent',
                  borderWidth: partial ? 1.5 : 0,
                  borderColor: colors.primary,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      {view.today !== home ? (
        <Pressable
          onPress={() => go(home)}
          accessibilityRole="button"
          hitSlop={6}
          style={({ pressed }) => ({ alignSelf: 'center', opacity: pressed ? 0.5 : 1 })}
        >
          <AppText variant="caption" tone="primary" style={{ fontWeight: '600' }}>
            {t(home === today ? 'programs.backToToday' : 'programs.backToLast')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
