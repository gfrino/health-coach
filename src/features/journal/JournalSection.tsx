import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, EmptyState, Icon } from '@/components';
import { getDb, journalRepository } from '@/db';
import type { JournalEntry } from '@/db/repositories/journalRepository';
import { useTheme } from '@/theme';

import { emojiFor, ENERGY_EMOJI, MOOD_EMOJI } from './scale';

const openEntry = (id: string) => router.push({ pathname: '/journal/[id]', params: { id } });
export const newJournalEntry = () => openEntry('new');

/** Diario: voci scritte dall'utente o annotate dal coach durante la chat. */
export function JournalSection() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDb()
        .then((db) => journalRepository.listEntries(db))
        .then((list) => active && setEntries(list));
      return () => {
        active = false;
      };
    }, []),
  );

  if (!entries) return null;

  const howItWorks = (
    <Card>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Icon name="sparkles" color={colors.primary} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="headline">{t('journal.howTitle')}</AppText>
          <AppText variant="callout" tone="textMuted">
            {t('journal.howBody')}
          </AppText>
        </View>
      </View>
    </Card>
  );

  if (!entries.length) {
    return (
      <View style={{ gap: spacing.lg }}>
        <EmptyState icon="journal" title={t('journal.emptyTitle')} body={t('journal.emptyBody')} />
        <Button label={t('journal.addFirst')} onPress={newJournalEntry} />
        {howItWorks}
      </View>
    );
  }

  const dayLabel = (ms: number) =>
    new Date(ms).toLocaleDateString(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  const time = (ms: number) =>
    new Date(ms).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  const days = entries.map((e) => dayLabel(e.entryAt));
  return (
    <View style={{ gap: spacing.sm }}>
      {/* La spiegazione resta in cima finché il diario è quasi vuoto. */}
      {entries.length < 3 ? howItWorks : null}
      {entries.map((e, i) => {
        const day = days[i] ?? '';
        const header = day !== days[i - 1] ? day : null;
        const mood = emojiFor(MOOD_EMOJI, e.mood);
        const energy = emojiFor(ENERGY_EMOJI, e.energy);
        return (
          <View key={e.id} style={{ gap: spacing.sm }}>
            {header ? (
              <AppText
                variant="caption"
                tone="textMuted"
                style={{ marginTop: spacing.md, textTransform: 'capitalize' }}
              >
                {header}
              </AppText>
            ) : null}
            <Pressable
              onPress={() => openEntry(e.id)}
              accessibilityRole="button"
              accessibilityLabel={[
                day,
                e.mood != null ? t('journal.moodA11y', { value: e.mood }) : null,
                e.energy != null ? t('journal.energyA11y', { value: e.energy }) : null,
                e.symptoms.join(', '),
                e.text,
              ]
                .filter(Boolean)
                .join('. ')}
              style={({ pressed }) => ({
                gap: spacing.sm,
                padding: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {mood ? <AppText variant="title">{mood}</AppText> : null}
                {energy ? <AppText variant="title">{energy}</AppText> : null}
                <View style={{ flex: 1 }} />
                {e.source === 'coach' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="sparkles" size={14} color={colors.primary} />
                    <AppText variant="caption" tone="primary">
                      {t('journal.byCoach')}
                    </AppText>
                  </View>
                ) : null}
                <AppText variant="caption" tone="textMuted">
                  {time(e.entryAt)}
                </AppText>
              </View>
              {e.symptoms.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {e.symptoms.map((s) => (
                    <View
                      key={s}
                      style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                        borderRadius: radius.pill,
                        backgroundColor: colors.warningSoft,
                      }}
                    >
                      <AppText variant="caption">{s}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
              {e.text ? (
                <AppText variant="callout" numberOfLines={4}>
                  {e.text}
                </AppText>
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
