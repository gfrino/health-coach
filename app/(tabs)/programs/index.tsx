import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, EmptyState, Icon, NavRow, ProgressBar, Screen } from '@/components';
import { haptic } from '@/lib/haptics';
import { CATEGORY_ICONS, ProgramItemRow } from '@/programs/ProgramItemRow';
import { usePrograms, type ProgramView } from '@/programs/usePrograms';
import { useTheme } from '@/theme';

/** Tab "Programmi": piani creati dal coach o dall'utente, con le azioni di oggi da spuntare. */
export default function ProgramsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { active, finished, toggle } = usePrograms();

  const create = () => {
    haptic.tap();
    router.push('/programs/new');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('tabs.programs') }} />
      <Screen
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
              active.map((v) => <ProgramCard key={v.program.id} view={v} onToggle={toggle} />)
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

function ProgramCard({
  view,
  onToggle,
}: {
  view: ProgramView;
  onToggle: ReturnType<typeof usePrograms>['toggle'];
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { program, done, day } = view;
  const total = program.items.length;
  const doneCount = program.items.filter((i) => done.has(i.id)).length;
  const open = () => {
    haptic.tap();
    router.push({ pathname: '/programs/[id]', params: { id: program.id } });
  };

  return (
    <Card>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityHint={t('programs.openHint')}
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
            {program.durationDays
              ? t('programs.dayOf', {
                  day: Math.min(day, program.durationDays),
                  total: program.durationDays,
                })
              : t('programs.day', { day })}
          </AppText>
        </View>
        <Icon name="chevronRight" size={14} color={colors.textMuted} />
      </Pressable>

      {total ? (
        <View style={{ gap: spacing.xs }}>
          <ProgressBar
            value={doneCount / total}
            label={t('programs.todayProgress', { done: doneCount, total })}
          />
          <AppText variant="caption" tone="textMuted">
            {t('programs.todayProgress', { done: doneCount, total })}
          </AppText>
        </View>
      ) : null}

      <View>
        {program.items.map((item) => (
          <ProgramItemRow
            key={item.id}
            item={item}
            done={done.has(item.id)}
            onToggle={(d) => onToggle(item, d)}
          />
        ))}
      </View>
    </Card>
  );
}
