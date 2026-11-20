import type { ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

import { Icon } from './Icon';

interface Props {
  onPress?: ((e: GestureResponderEvent) => void) | null;
  onLongPress?: ((e: GestureResponderEvent) => void) | null;
  accessibilityState?: { selected?: boolean };
  children?: ReactNode;
}

const SIZE = 62;
/**
 * Distanza del cerchio dal fondo della tab. Senza l'etichetta sotto (tolta: l'icona basta, il nome
 * resta per VoiceOver/TalkBack) il cerchio sta 12 pt (circa 2 mm) più in basso di prima.
 */
const LIFT = 5;

/**
 * Tab del Coach al centro della barra: un cerchio più grande che esce in parte sopra la barra,
 * con il bordo del colore della barra (sembra "ritagliato"). Senza etichetta visibile.
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
      style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: LIFT }}
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
    </Pressable>
  );
}
