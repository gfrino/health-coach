import type { ReactElement, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  /** Bordi da proteggere: di default solo in alto quando non c'è un header nativo. */
  edges?: Edge[];
  contentStyle?: ViewStyle;
  footer?: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Titolo grande nel contenuto (schermate principali delle tab, senza header nativo). */
  title?: string;
  titleAction?: ReactNode;
}

export function Screen({
  children,
  scroll = true,
  edges = [],
  contentStyle,
  footer,
  refreshControl,
  title,
  titleAction,
}: Props) {
  const { colors, spacing } = useTheme();
  const padding = { padding: spacing.lg, gap: spacing.lg };
  const safeEdges: Edge[] = title && !edges.includes('top') ? [...edges, 'top'] : edges;
  const heading = title ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <AppText variant="largeTitle" style={{ flex: 1 }}>
        {title}
      </AppText>
      {titleAction}
    </View>
  ) : null;
  return (
    <SafeAreaView edges={safeEdges} style={[styles.flex, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, styles.grow, contentStyle]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {heading}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, padding, contentStyle]}>
          {heading}
          {children}
        </View>
      )}
      {footer ? <View style={{ padding: spacing.lg, paddingTop: 0 }}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
});
