import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Schiarisce (amount > 0) o scurisce (amount < 0) un colore esadecimale #RRGGBB. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const channel = (shift: number) => {
    const c = (n >> shift) & 0xff;
    const target = amount > 0 ? 255 : 0;
    return Math.round(c + (target - c) * Math.abs(amount));
  };
  const out = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return `#${out.toString(16).padStart(6, '0')}`;
}

/** Foglia stilizzata (con nervatura), disegnata in un riquadro 40×20. */
const LEAF = 'M0 10 C8 0 28 -2 40 10 C28 22 8 20 0 10 Z';
const VEIN = 'M3 10 C14 8 26 8 37 10';

/**
 * Interno dei pulsanti principali: sfumatura di verdi e qualche foglia semitrasparente ai lati,
 * tagliata dagli angoli arrotondati. Solo decorazione: non riceve tocchi né letture vocali.
 */
export function ButtonDecor({ color }: { color: string }) {
  const leaf = shade(color, 0.45);
  const vein = shade(color, 0.15);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="btnGreen" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={shade(color, -0.22)} />
            <Stop offset="0.55" stopColor={color} />
            <Stop offset="1" stopColor={shade(color, 0.22)} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#btnGreen)" />
      </Svg>
      {/* Foglie a sinistra */}
      <Svg
        style={{ position: 'absolute', left: -10, top: -6 }}
        width={64}
        height={64}
        viewBox="0 0 64 64"
      >
        <G opacity={0.32}>
          <G transform="translate(2 40) rotate(-35) scale(1.1)">
            <Path d={LEAF} fill={leaf} />
            <Path d={VEIN} stroke={vein} strokeWidth={1.2} fill="none" />
          </G>
          <G transform="translate(-4 18) rotate(20) scale(0.8)">
            <Path d={LEAF} fill={leaf} />
            <Path d={VEIN} stroke={vein} strokeWidth={1.2} fill="none" />
          </G>
        </G>
      </Svg>
      {/* Foglie a destra */}
      <Svg
        style={{ position: 'absolute', right: -10, bottom: -8 }}
        width={64}
        height={64}
        viewBox="0 0 64 64"
      >
        <G opacity={0.32}>
          <G transform="translate(62 30) rotate(155) scale(1.1)">
            <Path d={LEAF} fill={leaf} />
            <Path d={VEIN} stroke={vein} strokeWidth={1.2} fill="none" />
          </G>
          <G transform="translate(66 56) rotate(200) scale(0.75)">
            <Path d={LEAF} fill={leaf} />
            <Path d={VEIN} stroke={vein} strokeWidth={1.2} fill="none" />
          </G>
        </G>
      </Svg>
    </View>
  );
}
