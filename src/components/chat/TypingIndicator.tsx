import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from '../AppText';

/** Tre puntini animati + testo ("sta scrivendo…" / "consulta i tuoi dati…"). */
export function TypingIndicator({ label }: { label: string }) {
  const { colors, spacing } = useTheme();
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(label);
    const anims = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [dots, label]);

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      accessible
      accessibilityLabel={label}
    >
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {dots.map((v, i) => (
          <Animated.View
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: colors.textMuted,
              opacity: v,
            }}
          />
        ))}
      </View>
      <AppText variant="caption" tone="textMuted">
        {label}
      </AppText>
    </View>
  );
}
