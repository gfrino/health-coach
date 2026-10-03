import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  Card,
  EmptyState,
  Icon,
  ProgressBar,
  Screen,
  SegmentedControl,
  TextField,
} from '@/components';
import { getDb, programRepository } from '@/db';
import type { ItemFrequency, Program } from '@/db/repositories/programRepository';
import { haptic } from '@/lib/haptics';
import { refreshCheckins } from '@/proactive/notifier';
import { CATEGORY_ICONS, ProgramItemRow } from '@/programs/ProgramItemRow';
import { useProgram } from '@/programs/usePrograms';
import { MAX_FONT_SCALE, useTheme } from '@/theme';

interface DraftItem {
  id: string | null;
  title: string;
  details: string;
  frequency: ItemFrequency;
}

interface Draft {
  title: string;
  goal: string;
  items: DraftItem[];
}

const toDraft = (p: Program): Draft => ({
  title: p.title,
  goal: p.goal ?? '',
  items: p.items.map((i) => ({
    id: i.id,
    title: i.title,
    details: i.details ?? '',
    frequency: i.frequency,
  })),
});

/** Salva le modifiche: titolo/obiettivo, azioni nuove, modificate e tolte. */
async function saveDraft(p: Program, d: Draft) {
  const db = await getDb();
  await programRepository.updateProgram(db, p.id, { title: d.title, goal: d.goal });
  const kept = new Set(d.items.map((i) => i.id).filter(Boolean));
  for (const old of p.items) if (!kept.has(old.id)) await programRepository.removeItem(db, old.id);
  for (const it of d.items) {
    if (!it.title.trim()) {
      if (it.id) await programRepository.removeItem(db, it.id);
      continue;
    }
    const input = { title: it.title, details: it.details, frequency: it.frequency };
    if (it.id) await programRepository.updateItem(db, it.id, input);
    else await programRepository.addItem(db, p.id, input);
  }
}

/** Dettaglio di un programma: spunte di oggi, modifica, chiedi al coach, concludi o elimina. */
export default function ProgramScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const params = useLocalSearchParams<{ id: string; edit?: string }>();
  const { view, reload, toggle } = useProgram(params.id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  // Programma appena creato a mano: si apre subito in modifica (una volta sola).
  const [autoEdited, setAutoEdited] = useState(false);
  if (params.edit && view && !autoEdited) {
    setAutoEdited(true);
    setDraft(toDraft(view.program));
  }

  if (view === undefined) return null;
  if (view === null) {
    return (
      <Screen>
        <EmptyState icon="programs" title={t('programs.notFound')} body="" />
      </Screen>
    );
  }

  const { program, done, day } = view;
  const editing = draft !== null;
  const total = program.items.length;
  const doneCount = program.items.filter((i) => done.has(i.id)).length;

  const finishEditing = async () => {
    if (!draft) return;
    setSaving(true);
    await saveDraft(program, draft);
    await reload();
    setSaving(false);
    setDraft(null);
    haptic.success();
    void refreshCheckins();
  };

  const setStatus = async (status: Program['status']) => {
    const db = await getDb();
    await programRepository.updateProgram(db, program.id, { status });
    haptic.success();
    await reload();
    void refreshCheckins();
  };

  const remove = () =>
    Alert.alert(t('programs.deleteTitle'), t('programs.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await programRepository.deleteProgram(db, program.id);
          haptic.success();
          void refreshCheckins();
          router.back();
        },
      },
    ]);

  const askCoach = () => {
    haptic.tap();
    router.navigate({
      pathname: '/coach',
      params: {
        new: String(Date.now()),
        ask: t('programs.askCoachPrompt', { title: program.title }),
      },
    });
  };

  const setItem = (index: number, patch: Partial<DraftItem>) =>
    setDraft((d) =>
      d ? { ...d, items: d.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) } : d,
    );

  const inputStyle = {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: editing ? t('programs.editTitle') : '',
          headerRight: () => (
            <Pressable
              onPress={() => {
                haptic.tap();
                if (editing) void finishEditing();
                else setDraft(toDraft(program));
              }}
              disabled={saving}
              accessibilityRole="button"
              hitSlop={8}
              style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}
            >
              <AppText variant="callout" tone="primary" style={{ fontWeight: '600' }}>
                {editing ? t('common.done') : t('common.edit')}
              </AppText>
            </Pressable>
          ),
        }}
      />
      <Screen>
        {editing && draft ? (
          <>
            <TextField
              label={t('programs.titleLabel')}
              value={draft.title}
              onChangeText={(title) => setDraft({ ...draft, title })}
            />
            <TextField
              label={t('programs.goalLabel')}
              value={draft.goal}
              onChangeText={(goal) => setDraft({ ...draft, goal })}
              multiline
            />
            <AppText variant="headline">{t('programs.actions')}</AppText>
            {draft.items.map((it, index) => (
              <Card key={it.id ?? `new-${index}`}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <TextInput
                    value={it.title}
                    onChangeText={(title) => setItem(index, { title })}
                    placeholder={t('programs.actionPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel={t('programs.actionPlaceholder')}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}
                    style={[inputStyle, { flex: 1, fontWeight: '600' }]}
                  />
                  <Pressable
                    onPress={() => {
                      haptic.select();
                      setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.removeItem', { item: it.title })}
                    hitSlop={8}
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="trash" size={18} color={colors.danger} />
                  </Pressable>
                </View>
                <TextInput
                  value={it.details}
                  onChangeText={(details) => setItem(index, { details })}
                  placeholder={t('programs.detailsPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={t('programs.detailsPlaceholder')}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  multiline
                  style={inputStyle}
                />
                <SegmentedControl
                  value={it.frequency}
                  onChange={(frequency) => setItem(index, { frequency })}
                  segments={[
                    { value: 'daily', label: t('programs.daily') },
                    { value: 'once', label: t('programs.once') },
                  ]}
                />
              </Card>
            ))}
            <Button
              label={t('programs.addAction')}
              variant="secondary"
              onPress={() => {
                haptic.tap();
                setDraft({
                  ...draft,
                  items: [...draft.items, { id: null, title: '', details: '', frequency: 'daily' }],
                });
              }}
            />
            <Button
              label={t('common.save')}
              onPress={() => void finishEditing()}
              loading={saving}
            />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  backgroundColor: colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={CATEGORY_ICONS[program.category]} size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="title">{program.title}</AppText>
                <AppText variant="caption" tone="textMuted">
                  {[
                    program.status === 'active'
                      ? program.durationDays
                        ? t('programs.dayOf', {
                            day: Math.min(day, program.durationDays),
                            total: program.durationDays,
                          })
                        : t('programs.day', { day })
                      : t(`programs.status.${program.status}`),
                    program.source === 'coach' ? t('programs.byCoach') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
            </View>
            {program.goal ? <AppText variant="body">{program.goal}</AppText> : null}

            <Card>
              {total ? (
                <>
                  <AppText variant="headline">{t('programs.today')}</AppText>
                  <ProgressBar
                    value={doneCount / total}
                    label={t('programs.todayProgress', { done: doneCount, total })}
                  />
                  <View>
                    {program.items.map((item) => (
                      <ProgramItemRow
                        key={item.id}
                        item={item}
                        done={done.has(item.id)}
                        onToggle={(d) => toggle(item, d)}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <AppText variant="callout" tone="textMuted">
                  {t('programs.noActions')}
                </AppText>
              )}
            </Card>

            <Button label={t('programs.askCoach')} variant="secondary" onPress={askCoach} />
            {program.status === 'active' ? (
              <Button
                label={t('programs.markCompleted')}
                variant="ghost"
                onPress={() => void setStatus('completed')}
              />
            ) : (
              <Button
                label={t('programs.restart')}
                variant="ghost"
                onPress={() => void setStatus('active')}
              />
            )}
            <Button label={t('programs.delete')} variant="danger" onPress={remove} />
          </>
        )}
      </Screen>
    </>
  );
}
