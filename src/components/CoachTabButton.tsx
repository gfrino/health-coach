import type { ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

interface Props {
  onPress?: ((e: GestureResponderEvent) => void) | null;
  onLongPress?: ((e: GestureResponderEvent) => void) | null;
  accessibilityState?: { selected?: boolean };
  children?: ReactNode;
}

const SIZE = 62;

/**
 * Tab del Coach al centro della barra: un cerchio più grande che esce in parte sopra la barra,
 * con il bordo del colore della barra (sembra "ritagliato"). L'etichetta resta sotto, come le altre.
 */
export function CoachTabButton({ onPress, onLongPress, accessibilityState }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const selected = !!accessibilityState?.selected;
  return (
    <Pressable
      onPress={onPress ?? undefined}
      onLongPress={onLongPress ?? undefined}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={t('tabs.coach')}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 }}
    >
      <View
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          marginTop: -SIZE / 2 - 4,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          borderWidth: 4,
          borderColor: colors.tabBar,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        }}
      >
        <Icon name="coach" color={colors.onPrimary} size={28} />
      </View>
      <AppText
        variant="caption"
        style={{
          fontSize: 10,
          lineHeight: 13,
          marginTop: 2,
          fontWeight: '600',
          color: selected ? colors.primary : colors.textMuted,
        }}
        maxFontSizeMultiplier={1.3}
      >
        {t('tabsShort.coach')}
      </AppText>
    </Pressable>
  );
}
