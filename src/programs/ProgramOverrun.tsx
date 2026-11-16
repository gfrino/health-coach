import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button } from '@/components';
import { getDb, programRepository } from '@/db';
import type { Program } from '@/db/repositories/programRepository';
import { haptic } from '@/lib/haptics';
import { localIsoDate } from '@/lib/dates';
import { refreshCheckins } from '@/proactive/notifier';
import { useTheme } from '@/theme';

import { overrunEnd } from './week';

/**
 * Programma attivo oltre la durata prevista: chi lo segue ancora lo continua senza scadenza
 * (tornano anche le spunte automatiche), altrimenti lo segna come concluso.
 */
export function ProgramOverrun({
  program,
  onChanged,
}: {
  program: Program;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const end = overrunEnd(program, localIsoDate(new Date()));
  if (!end) return null;
  const date = new Date(`${end}T12:00:00`).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
  });

  const save = async (patch: { durationDays?: null; status?: 'completed' }) => {
    const db = await getDb();
    await programRepository.updateProgram(db, program.id, patch);
    haptic.success();
    void refreshCheckins();
    onChanged();
  };

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.primarySoft,
      }}
    >
      <AppText variant="callout">
        {t('programs.overrun', { total: program.durationDays, date })}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label={t('programs.overrunContinue')}
            onPress={() => void save({ durationDays: null })}
            compact
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={t('programs.overrunComplete')}
            variant="secondary"
            onPress={() => void save({ status: 'completed' })}
            compact
          />
        </View>
      </View>
    </View>
  );
}
