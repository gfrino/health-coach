import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/store/settingsStore';

import { palettes, radius, spacing, typography, type ColorScheme, type Palette } from './tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

const ThemeContext = createContext<Theme | null>(null);

export function buildTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: palettes[scheme], spacing, radius, typography };
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const preference = useSettingsStore((s) => s.settings.theme);
  const scheme: ColorScheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme deve essere usato dentro <AppThemeProvider>');
  return theme;
}
