import { Text, type TextProps } from 'react-native';

import { MAX_FONT_SCALE, useTheme, type Palette, type TypographyVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: keyof Pick<
    Palette,
    'text' | 'textMuted' | 'primary' | 'danger' | 'warning' | 'success' | 'onPrimary'
  >;
  align?: 'left' | 'center' | 'right';
}

/** Testo tematizzato; rispetta Dynamic Type / dimensione carattere di sistema. */
export function AppText({ variant = 'body', tone = 'text', align, style, ...rest }: AppTextProps) {
  const { typography, colors } = useTheme();
  const isHeading = variant === 'largeTitle' || variant === 'title';
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      accessibilityRole={isHeading ? 'header' : undefined}
      style={[typography[variant], { color: colors[tone], textAlign: align }, style]}
      {...rest}
    />
  );
}
