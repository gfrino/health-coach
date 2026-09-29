import Svg, { Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

interface Props {
  values: (number | null)[];
  width?: number;
  height?: number;
  /** Etichetta accessibile (es. "Passi ultimi 7 giorni: …"). */
  accessibilityLabel: string;
}

/** Barre dei 7 giorni; l'ultima (oggi) evidenziata. Nessun dato = barra vuota. */
export function Sparkline({ values, width = 112, height = 36, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const max = Math.max(...values.map((v) => v ?? 0), 1);
  const gap = 4;
  const barW = (width - gap * (values.length - 1)) / values.length;
  return (
    <Svg
      width={width}
      height={height}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {values.map((v, i) => {
        const h = v == null ? 3 : Math.max(3, (v / max) * height);
        const last = i === values.length - 1;
        return (
          <Rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            rx={Math.min(3, barW / 2)}
            fill={v == null ? colors.surfaceAlt : last ? colors.primary : colors.primarySoft}
          />
        );
      })}
    </Svg>
  );
}
