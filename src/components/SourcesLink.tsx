import { router, usePathname } from 'expo-router';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { SourceTopic } from '@/health/sources';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

interface Props {
  /** Tema da mostrare per primo nella pagina delle fonti. */
  topic?: SourceTopic;
}

/** Link discreto "Fonti scientifiche" vicino alle informazioni di salute (App Store 1.4.1). */
export function SourcesLink({ topic }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  // La pagina delle fonti sta nella tab Impostazioni: "from" permette di tornare qui con la freccia.
  const from = usePathname();
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/settings/sources', params: topic ? { topic, from } : { from } })
      }
      accessibilityRole="link"
      accessibilityLabel={t('citations.link')}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name="sources" size={14} color={colors.primary} />
      <AppText variant="caption" tone="primary">
        {t('citations.link')}
      </AppText>
    </Pressable>
  );
}
