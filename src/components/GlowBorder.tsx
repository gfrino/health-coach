import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

interface Props {
  children: ReactNode;
  /** Se false, nessun effetto (il bordo resta invisibile). */
  active?: boolean;
  /** Spessore del bordo luminoso. */
  width?: number;
  /** Durata di un giro completo della luce. */
  durationMs?: number;
}

/**
 * Luce che gira lungo il bordo di un elemento (es. il primo passo da fare).
 * Una striscia luminosa ruota dietro il contenuto, visibile solo nel sottile bordo esterno.
 * Rispetta "Riduci movimento" del sistema: in quel caso il bordo è fisso e non si muove.
 */
export function GlowBorder({ children, active = true, width = 3, durationMs = 2800 }: Props) {
  const { colors, radius } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [rotation] = useState(() => new Animated.Value(0));
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
    if (!active || reduceMotion) return;
    rotation.setValue(0);
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, durationMs, rotation]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w !== size.w || h !== size.h) setSize({ w, h });
  };

  if (!active) return <>{children}</>;

  // Quadrato che copre il riquadro anche ruotato (lato = diagonale).
  const side = Math.ceil(Math.sqrt(size.w ** 2 + size.h ** 2));
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View
      onLayout={onLayout}
      style={{
        borderRadius: radius.md + width,
        padding: width,
        overflow: 'hidden',
        backgroundColor: reduceMotion ? colors.primary : colors.primarySoft,
      }}
    >
      {side > 0 && !reduceMotion ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: side,
            height: side,
            left: (size.w - side) / 2,
            top: (size.h - side) / 2,
            transform: [{ rotate: spin }],
          }}
        >
          <Svg width={side} height={side}>
            <Defs>
              <LinearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.primarySoft} stopOpacity="0" />
                <Stop offset="0.42" stopColor={colors.primarySoft} stopOpacity="0" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.95" />
                <Stop offset="0.58" stopColor={colors.primary} stopOpacity="0.9" />
                <Stop offset="1" stopColor={colors.primarySoft} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {/* Metà superiore del quadrato: la luce è una "lama" che ruota dal centro. */}
            <Rect x="0" y="0" width={side} height={side / 2} fill="url(#glow)" />
          </Svg>
        </Animated.View>
      ) : null}
      {children}
    </View>
  );
}
