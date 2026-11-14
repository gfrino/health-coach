import { Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, type AppIconName } from '@/components';
import type { ProgramCategory, ProgramItem } from '@/db/repositories/programRepository';
import { useTheme } from '@/theme';

import type { Weekday } from './schedule';

/** Nomi brevi dei giorni nella lingua dell'app ("lun, mer, ven"). */
export function weekdaysLabel(days: Weekday[], language: string): string {
  // 1 gennaio 2024 era un lunedì.
  return days
    .map((d) => new Date(2024, 0, d).toLocaleDateString(language, { weekday: 'short' }))
    .join(', ');
}

export const CATEGORY_ICONS: Record<ProgramCategory, AppIconName> = {
  sleep: 'sleep',
  activity: 'workout',
  nutrition: 'leaf',
  stress: 'calm',
  weight: 'scale',
  general: 'programs',
};

/** Azione di un programma con la spunta (tocco su tutta la riga). */
export function ProgramItemRow({
  item,
  done,
  onToggle,
  auto = false,
  scheduled = true,
}: {
  item: ProgramItem;
  done: boolean;
  onToggle: (done: boolean) => void;
  /** Spuntata dall'app (allenamento o passi). */
  auto?: boolean;
  /** Prevista oggi: le azioni di altri giorni si mostrano più chiare. */
  scheduled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const source = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={() => onToggle(!done)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={item.title}
      accessibilityHint={item.frequency === 'once' ? t('programs.once') : t('programs.daily')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
        minHeight: 44,
        opacity: pressed ? 0.6 : scheduled || done ? 1 : 0.55,
      })}
    >
      <View style={{ paddingTop: 1 }}>
        <Icon
          name={done ? 'checkCircle' : 'circle'}
          size={24}
          color={done ? colors.primary : colors.textMuted}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText
          variant="body"
          tone={done ? 'textMuted' : 'text'}
          style={done ? { textDecorationLine: 'line-through' } : undefined}
        >
          {item.title}
        </AppText>
        {item.details ? (
          <AppText variant="caption" tone="textMuted">
            {item.details}
          </AppText>
        ) : null}
        {item.frequency === 'once' ? (
          <AppText variant="caption" tone="primary">
            {t('programs.once')}
          </AppText>
        ) : item.days ? (
          <AppText variant="caption" tone="primary">
            {weekdaysLabel(item.days, i18n.language)}
          </AppText>
        ) : null}
        {done && auto ? (
          <AppText variant="caption" tone="success">
            {t('programs.autoDone', { source })}
          </AppText>
        ) : !done && item.auto && scheduled ? (
          <AppText variant="caption" tone="textMuted">
            {t('programs.autoHint', { source })}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}
