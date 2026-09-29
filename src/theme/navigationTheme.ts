import { DarkTheme, DefaultTheme, type Theme as NavTheme } from 'expo-router';

import type { Theme } from './ThemeProvider';

/** Allinea i colori di React Navigation (header, tab bar, sfondo) al nostro tema. */
export function toNavigationTheme(theme: Theme): NavTheme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}
