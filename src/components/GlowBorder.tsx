import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

interface Props {
  children: ReactNode;
  /** Se false, nessun effetto. */
  active?: boolean;
  /** Spessore del bordo luminoso. */
  width?: number;
  /** Durata di un giro completo della luce lungo il bordo. */
  durationMs?: number;
}

/** Diametro del punto di luce: grande e molto sfumato, così il passaggio è morbido. */
const GLOW = 90;

/**
 * Luce che scorre lungo il contorno di un elemento (es. il primo passo da fare): un punto
 * luminoso molto sfumato percorre il perimetro a velocità costante, sopra un bordo tenue fisso.
 * Il contenuto copre il centro, quindi la luce si vede solo nel sottile bordo esterno.
 * Con "Riduci movimento" attivo resta solo il bordo fisso.
 */
export function GlowBorder({ children, active = true, width = 2, durationMs = 4200 }: Props) {
  const { colors, radius } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [progress] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!active || reduceMotion || !size.w) return;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, durationMs, progress, size.w]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w !== size.w || h !== size.h) setSize({ w, h });
  };

  if (!active) return <>{children}</>;

  // Percorso del centro della luce lungo il perimetro, a velocità costante.
  const { w, h } = size;
  const perimeter = 2 * (w + h) || 1;
  const stops = [0, w / perimeter, (w + h) / perimeter, (2 * w + h) / perimeter, 1];
  const half = GLOW / 2;
  const translateX = progress.interpolate({
    inputRange: stops,
    outputRange: [-half, w - half, w - half, -half, -half],
  });
  const translateY = progress.interpolate({
    inputRange: stops,
    outputRange: [-half, -half, h - half, h - half, -half],
  });

  return (
    <View
      onLayout={onLayout}
      style={{ borderRadius: radius.md + width, padding: width, overflow: 'hidden' }}
    >
      {/* Bordo tenue sempre visibile. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.primary,
          opacity: 0.35,
        }}
      />
      {w > 0 && !reduceMotion ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: GLOW,
            height: GLOW,
            transform: [{ translateX }, { translateY }],
          }}
        >
          <Svg width={GLOW} height={GLOW}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
                <Stop offset="0.25" stopColor="#FFFFFF" stopOpacity="0.6" />
                <Stop offset="0.55" stopColor={colors.primary} stopOpacity="0.35" />
                <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={half} cy={half} r={half} fill="url(#glow)" />
          </Svg>
        </Animated.View>
      ) : null}
      {children}
    </View>
  );
}
