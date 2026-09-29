import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  /** Bordi da proteggere: di default solo in alto quando non c'è un header nativo. */
  edges?: Edge[];
  contentStyle?: ViewStyle;
  footer?: ReactNode;
}

export function Screen({ children, scroll = true, edges = [], contentStyle, footer }: Props) {
  const { colors, spacing } = useTheme();
  const padding = { padding: spacing.lg, gap: spacing.lg };
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, styles.grow, contentStyle]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, padding, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={{ padding: spacing.lg, paddingTop: 0 }}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
});
