import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

interface Props {
  label: string;
  /** Valore mostrato (già formattato). */
  display: string;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement?: boolean;
  canIncrement?: boolean;
  decrementLabel: string;
  incrementLabel: string;
}

/** Controllo − valore + (accessibile come "adjustable"). */
export function Stepper(p: Props) {
  const { colors, spacing, radius } = useTheme();
  const btn = (text: string, onPress: () => void, enabled: boolean, a11y: string) => (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.primarySoft : colors.surfaceAlt,
        opacity: enabled ? 1 : 0.4,
      })}
    >
      <AppText variant="title">{text}</AppText>
    </Pressable>
  );
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={p.label}
      accessibilityValue={{ text: p.display }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment' && p.canIncrement !== false) p.onIncrement();
        if (e.nativeEvent.actionName === 'decrement' && p.canDecrement !== false) p.onDecrement();
      }}
    >
      <AppText style={{ flex: 1 }}>{p.label}</AppText>
      {btn('−', p.onDecrement, p.canDecrement !== false, p.decrementLabel)}
      <AppText variant="headline" style={{ minWidth: 56, textAlign: 'center' }}>
        {p.display}
      </AppText>
      {btn('+', p.onIncrement, p.canIncrement !== false, p.incrementLabel)}
    </View>
  );
}
