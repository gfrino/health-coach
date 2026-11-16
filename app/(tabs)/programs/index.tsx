import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, EmptyState, Icon, NavRow, ProgressBar, Screen } from '@/components';
import { GoalCard } from '@/goals/GoalCard';
import { haptic } from '@/lib/haptics';
import { CATEGORY_ICONS } from '@/programs/ProgramItemRow';
import {
  ProgramTodayList,
  programDayLabel,
  progressLabel,
  todayProgress,
} from '@/programs/ProgramTodayList';
import { ProgramWeekNav } from '@/programs/ProgramWeekNav';
import { usePrograms, type ProgramView } from '@/programs/usePrograms';
import { useTheme } from '@/theme';

/** Tab "Programmi": piani creati dal coach o dall'utente, con le azioni di oggi da spuntare. */
export default function ProgramsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { active, finished, toggle, selectDay } = usePrograms();

  const create = () => {
    haptic.tap();
    router.push('/programs/new');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('tabs.programs') }} />
      <Screen
        menu
        title={t('tabs.programs')}
        titleAction={
          <Pressable
            onPress={create}
            accessibilityRole="button"
            accessibilityLabel={t('programs.new')}
            hitSlop={10}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primarySoft,
            }}
          >
            <Icon name="add" color={colors.primary} />
          </Pressable>
        }
      >
        <GoalCard />
        {active === null ? null : active.length === 0 && finished.length === 0 ? (
          <EmptyState
            icon="programs"
            title={t('programs.emptyTitle')}
            body={t('programs.emptyBody')}
            action={{ label: t('programs.new'), onPress: create }}
          />
        ) : (
          <>
            {active.length === 0 ? (
              <Card tone="soft">
                <AppText variant="callout">{t('programs.noActive')}</AppText>
              </Card>
            ) : (
              active.map((v, i) => (
                <ProgramCard
                  key={v.program.id}
                  view={v}
                  onToggle={toggle}
                  onSelectDay={(day) => void selectDay(v.program, day)}
                  first={i === 0}
                />
              ))
            )}
            {finished.length ? (
              <View style={{ gap: spacing.xs }}>
                <AppText variant="headline">{t('programs.finished')}</AppText>
                <Card>
                  {finished.map((p, i) => (
                    <NavRow
                      key={p.id}
                      first={i === 0}
                      label={p.title}
                      value={t(`programs.status.${p.status}`)}
                      onPress={() =>
                        router.push({ pathname: '/programs/[id]', params: { id: p.id } })
                      }
                    />
                  ))}
                </Card>
              </View>
            ) : null}
          </>
        )}
      </Screen>
    </>
  );
}

/** Programmi aperti/chiusi a fisarmonica: lo stato resta finché l'app è aperta. */
const expandedState = new Map<string, boolean>();

function ProgramCard({
  view,
  onToggle,
  onSelectDay,
  first,
}: {
  view: ProgramView;
  onToggle: ReturnType<typeof usePrograms>['toggle'];
  onSelectDay: (day: string) => void;
  first: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { program, day } = view;
  const { total, done: doneCount } = todayProgress(view);
  const label = progressLabel(view, t, i18n.language);
  // Di default è aperto solo il primo programma.
  const [expanded, setExpanded] = useState(() => expandedState.get(program.id) ?? first);
  const toggleExpanded = () => {
    haptic.select();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    expandedState.set(program.id, !expanded);
    setExpanded(!expanded);
  };
  const open = () => {
    haptic.tap();
    router.push({ pathname: '/programs/[id]', params: { id: program.id } });
  };

  return (
    <Card>
      <Pressable
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? t('programs.collapse') : t('programs.expand')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={CATEGORY_ICONS[program.category]} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="headline">{program.title}</AppText>
          <AppText variant="caption" tone="textMuted">
            {programDayLabel(program, day, t, i18n.language)}
          </AppText>
        </View>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={14} color={colors.textMuted} />
      </Pressable>

      {total ? (
        <View style={{ gap: spacing.xs }}>
          <ProgressBar value={doneCount / total} label={label} />
          <AppText variant="caption" tone="textMuted">
            {label}
          </AppText>
        </View>
      ) : null}

      {expanded ? (
        <>
          <ProgramWeekNav view={view} onSelect={onSelectDay} />
          <ProgramTodayList view={view} onToggle={onToggle} />
          <Pressable
            onPress={open}
            accessibilityRole="button"
            accessibilityHint={t('programs.openHint')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 44,
              paddingTop: spacing.xs,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppText variant="callout" tone="primary" style={{ fontWeight: '600' }}>
              {t('programs.showDetails')}
            </AppText>
            <Icon name="chevronRight" size={14} color={colors.primary} />
          </Pressable>
        </>
      ) : null}
    </Card>
  );
}
