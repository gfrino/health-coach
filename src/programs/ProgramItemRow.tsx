import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, type AppIconName } from '@/components';
import type { ProgramCategory, ProgramItem } from '@/db/repositories/programRepository';
import { useTheme } from '@/theme';

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
}: {
  item: ProgramItem;
  done: boolean;
  onToggle: (done: boolean) => void;
}) {
  const { t } = useTranslation();
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
        opacity: pressed ? 0.6 : 1,
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
        ) : null}
      </View>
    </Pressable>
  );
}
