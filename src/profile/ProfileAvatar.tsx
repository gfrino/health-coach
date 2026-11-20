import { useEffect } from 'react';
import { Image, View } from 'react-native';

import { Icon } from '@/components';
import { useTheme } from '@/theme';

import { loadProfilePhoto, useProfilePhoto } from './photo';

/** Foto del profilo in un cerchio; senza foto l'icona della persona. */
export function ProfileAvatar({ size }: { size: number }) {
  const { colors } = useTheme();
  const uri = useProfilePhoto((s) => s.uri);
  useEffect(() => {
    void loadProfilePhoto().catch(() => undefined);
  }, []);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primarySoft,
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Icon name="me" size={size * 0.55} color={colors.primary} />
      )}
    </View>
  );
}
