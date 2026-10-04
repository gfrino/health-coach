import 'react-native-reanimated';

import { ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { ShareIntentProvider } from 'expo-share-intent';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StartupError } from '@/components/StartupError';
import { NotificationRouter } from '@/proactive/NotificationRouter';
import { ShareIntentImporter } from '@/records/ShareIntentImporter';
import { HealthSyncManager } from '@/sources/HealthSyncManager';
import { bootstrap } from '@/lib/bootstrap';
// Registra il salvataggio in Apple Salute delle voci del diario alimentare create dal coach.
import '@/food/healthWrite';
import { useSettingsStore } from '@/store/settingsStore';
import { AppThemeProvider, toNavigationTheme, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

type BootState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: unknown };

export default function RootLayout() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    bootstrap()
      .then(() => !cancelled && setBoot({ status: 'ready' }))
      .catch((error: unknown) => !cancelled && setBoot({ status: 'error', error }))
      .finally(() => SplashScreen.hideAsync().catch(() => undefined));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setBoot({ status: 'loading' });
    setAttempt((a) => a + 1);
  };

  return (
    <ShareIntentProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppThemeProvider>
            {boot.status === 'error' ? (
              <StartupError error={boot.error} onRetry={retry} />
            ) : boot.status === 'ready' ? (
              <RootNavigator />
            ) : null}
          </AppThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const onboardingCompleted = useSettingsStore((s) => s.settings.onboardingCompleted);

  return (
    <ThemeProvider value={toNavigationTheme(theme)}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <ShareIntentImporter />
      <HealthSyncManager />
      <NotificationRouter />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!onboardingCompleted}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboardingCompleted}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
