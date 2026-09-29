import { Stack } from 'expo-router/stack';

import { useTheme } from '@/theme';

/** Stack con header nativo (large title su iOS) usato da ogni tab. */
export function TabStack() {
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
    />
  );
}
