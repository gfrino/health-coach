/**
 * Design tokens: palette calma e morbida, pensata per contrasto WCAG AA
 * (testo normale ≥ 4.5:1 su background e surface — verificato in __tests__/contrast.test.ts).
 */

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  info: string;
  tabBar: string;
  overlay: string;
}

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#F6F4EF',
    surface: '#FFFFFF',
    surfaceAlt: '#EFECE5',
    border: '#E1DDD3',
    text: '#1D2320',
    textMuted: '#555D58',
    primary: '#3A7560',
    onPrimary: '#FFFFFF',
    primarySoft: '#E1EEE7',
    danger: '#A8322B',
    dangerSoft: '#F8E3E1',
    warning: '#7F5500',
    warningSoft: '#F7EDD6',
    success: '#2B6E48',
    info: '#2C5F87',
    tabBar: '#FFFFFF',
    overlay: 'rgba(20, 23, 26, 0.4)',
  },
  dark: {
    background: '#14171A',
    surface: '#1C2024',
    surfaceAlt: '#252A2F',
    border: '#30363C',
    text: '#EEF0EE',
    textMuted: '#A7AFAA',
    primary: '#7CC4A4',
    onPrimary: '#0E1F17',
    primarySoft: '#1F3329',
    danger: '#F2B8B5',
    dangerSoft: '#3A1F1E',
    warning: '#F0C36B',
    warningSoft: '#3A2F17',
    success: '#8FD5A6',
    info: '#9CC7EA',
    tabBar: '#1C2024',
    overlay: 'rgba(0, 0, 0, 0.55)',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Scala tipografica. Le dimensioni sono "base": il sistema le scala con
 * Dynamic Type / dimensione carattere (allowFontScaling resta attivo).
 */
export const typography = {
  largeTitle: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Limite di scala per evitare layout rotti con dimensioni di accessibilità estreme. */
export const MAX_FONT_SCALE = 2;
