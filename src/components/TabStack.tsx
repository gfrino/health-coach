import { Stack } from 'expo-router/stack';

import { useTheme } from '@/theme';

/** Stack con header nativo (large title su iOS) usato da ogni tab. */
export function TabStack() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
