import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Icon, ProgressBar } from '@/components';
import { getDb, profileRepository } from '@/db';
import { haptic } from '@/lib/haptics';
import { num } from '@/lib/units';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import { loadWeightGoal, type WeightGoalProgress } from './progress';

const LB_PER_KG = 2.20462;

/**
 * Obiettivo di peso in primo piano: da dove si è partiti, quanto manca, andamento e data prevista.
 * Se l'utente vuole perdere/prendere peso ma non ha fissato un obiettivo, invita a farlo.
 */
export function GoalCard() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const lb = useSettingsStore((s) => s.settings.units.weight === 'lb');
  const [state, setState] = useState<
    { goal: WeightGoalProgress | null; wantsWeight: boolean } | undefined
  >(undefined);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const db = await getDb();
        const [goal, profile] = await Promise.all([
          loadWeightGoal(db).catch(() => null),
          profileRepository.getProfile(db),
        ]);
        if (active)
          setState({
            goal,
            wantsWeight:
              profile.goals.includes('loseWeight') || profile.goals.includes('gainWeight'),
          });
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const openProfile = () => {
    haptic.tap();
    router.navigate('/profile');
  };
  if (!state || (!state.goal && !state.wantsWeight)) return null;

  const unit = lb ? 'lb' : 'kg';
  const w = (kg: number, d = 1) => `${num(lb ? kg * LB_PER_KG : kg, i18n.language, d)} ${unit}`;
  const date = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  const g = state.goal;
  // Finché il peso non è cambiato "da 77,5 a 77,5" non dice niente: solo peso attuale e quanto manca.
  const progressText = g
    ? Math.abs(g.startKg - g.currentKg) >= 0.1
      ? t('goal.progress', { start: w(g.startKg), now: w(g.currentKg), left: w(g.remainingKg) })
      : t('goal.progressNow', { now: w(g.currentKg), left: w(g.remainingKg) })
    : '';

  return (
    <Pressable
      onPress={openProfile}
      accessibilityRole="button"
      accessibilityHint={t('goal.editHint')}
    >
      {({ pressed }) => (
        <Card tone="soft" style={{ opacity: pressed ? 0.7 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="scale" size={20} color={colors.primary} />
            <AppText variant="headline" style={{ flex: 1 }}>
              {g ? t('goal.title', { target: w(g.targetKg) }) : t('goal.setTitle')}
            </AppText>
            <Icon name="chevronRight" size={14} color={colors.textMuted} />
          </View>
          {!g ? (
            <AppText variant="callout" tone="textMuted">
              {t('goal.setBody')}
            </AppText>
          ) : g.reached ? (
            <AppText variant="callout">{t('goal.reached', { now: w(g.currentKg) })}</AppText>
          ) : (
            <>
              <ProgressBar value={g.done} label={progressText} />
              <AppText variant="callout">{progressText}</AppText>
              <AppText variant="caption" tone="textMuted">
                {g.trendKgWeek === null
                  ? t('goal.noTrend')
                  : g.etaDate
                    ? t('goal.trendEta', {
                        trend: `${g.trendKgWeek > 0 ? '+' : ''}${w(g.trendKgWeek, 2)}`,
                        eta: date(g.etaDate),
                      })
                    : t(
                        g.trendNote === 'flat'
                          ? 'goal.trendFlat'
                          : g.trendNote === 'slow'
                            ? 'goal.trendSlow'
                            : 'goal.trendWrong',
                        { trend: `${g.trendKgWeek > 0 ? '+' : ''}${w(g.trendKgWeek, 2)}` },
                      )}
                {g.targetDate && g.neededKgWeek !== null
                  ? ` ${t(g.onTrack === false ? 'goal.behind' : 'goal.needed', {
                      needed: w(g.neededKgWeek, 2),
                      date: date(g.targetDate),
                    })}`
                  : ''}
              </AppText>
              {g.tooFast ? (
                <AppText variant="caption" tone="warning">
                  {t('goal.tooFast')}
                </AppText>
              ) : null}
            </>
          )}
        </Card>
      )}
    </Pressable>
  );
}
