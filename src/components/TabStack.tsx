import type { ReactNode } from 'react';
import { Stack } from 'expo-router/stack';

import { useTheme } from '@/theme';

/** Stack con header nativo usato da ogni tab; `children` per opzioni di singole schermate. */
export function TabStack({ children }: { children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        // Titolo standard: il large title di iOS 27 non viene disegnato con lo ScrollView annidato nello schermo.
        headerLargeTitle: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {children}
    </Stack>
  );
}
