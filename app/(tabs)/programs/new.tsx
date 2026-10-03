import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, ChipGroup, Screen, TextField } from '@/components';
import { toAIError } from '@/ai/errors';
import { completeOnce } from '@/coach/chatEngine';
import { getDb, programRepository } from '@/db';
import { PROGRAM_CATEGORIES, type ProgramCategory } from '@/db/repositories/programRepository';
import { localIsoDate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { parseGeneratedProgram, programInstruction } from '@/programs/generate';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

const DURATIONS = ['7', '14', '30', 'open'] as const;
type Duration = (typeof DURATIONS)[number];

/** Nuovo programma: lo prepara il coach (con l'AI scelta) oppure lo si scrive da sé. */
export default function NewProgramScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const hasAI = !!settings.ai.provider && !!settings.ai.model;
  const [category, setCategory] = useState<ProgramCategory>('sleep');
  const [details, setDetails] = useState('');
  const [duration, setDuration] = useState<Duration>('14');
  const [busy, setBusy] = useState<'ai' | 'manual' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = duration === 'open' ? null : Number(duration);
  const open = (id: string, edit = false) =>
    router.replace({ pathname: '/programs/[id]', params: edit ? { id, edit: '1' } : { id } });

  const generate = async () => {
    setBusy('ai');
    setError(null);
    try {
      const text = await completeOnce(
        settings,
        programInstruction({
          focus: t(`programs.categories.${category}`),
          details,
          durationDays: days,
        }),
      );
      const program = parseGeneratedProgram(text, days);
      if (!program) throw new Error('parse');
      const db = await getDb();
      const id = await programRepository.createProgram(
        db,
        { ...program, startDay: localIsoDate(new Date()) },
        'coach',
      );
      haptic.success();
      open(id);
    } catch (e) {
      haptic.error();
      const err = e instanceof Error && e.message === 'parse' ? null : toAIError(e);
      setError(
        err && err.code !== 'unknown'
          ? t(`ai.errors.${err.code}` as 'ai.errors.unknown')
          : t('programs.generateFailed'),
      );
    } finally {
      setBusy(null);
    }
  };

  const manual = async () => {
    setBusy('manual');
    const db = await getDb();
    const id = await programRepository.createProgram(db, {
      title: details.trim().split('\n')[0]?.slice(0, 80) || t(`programs.categories.${category}`),
      goal: null,
      category,
      startDay: localIsoDate(new Date()),
      durationDays: days,
      items: [],
    });
    setBusy(null);
    open(id, true);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('programs.new') }} />
      <Screen
        footer={
          <View style={{ gap: spacing.sm }}>
            {hasAI ? (
              <Button
                label={t('programs.generate', { name: settings.coach.name })}
                onPress={() => void generate()}
                loading={busy === 'ai'}
                disabled={busy !== null}
              />
            ) : null}
            <Button
              label={t('programs.createManual')}
              variant={hasAI ? 'ghost' : 'primary'}
              onPress={() => void manual()}
              disabled={busy !== null}
            />
          </View>
        }
      >
        <AppText variant="callout" tone="textMuted">
          {hasAI
            ? t('programs.newIntro', { name: settings.coach.name })
            : t('programs.newIntroNoAI')}
        </AppText>
        <ChipGroup
          label={t('programs.focus')}
          value={category}
          onChange={setCategory}
          options={PROGRAM_CATEGORIES.map((c) => ({
            value: c,
            label: t(`programs.categories.${c}`),
          }))}
        />
        <TextField
          label={t('programs.wish')}
          value={details}
          onChangeText={setDetails}
          placeholder={t('programs.wishPlaceholder')}
          multiline
        />
        <ChipGroup
          label={t('programs.duration')}
          value={duration}
          onChange={setDuration}
          options={DURATIONS.map((d) => ({
            value: d,
            label:
              d === 'open' ? t('programs.openEnded') : t('programs.days', { count: Number(d) }),
          }))}
        />
        {busy === 'ai' ? (
          <Card tone="soft">
            <AppText variant="callout">
              {t('programs.generating', { name: settings.coach.name })}
            </AppText>
          </Card>
        ) : null}
        {error ? (
          <Card tone="warning">
            <AppText variant="callout">{error}</AppText>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
