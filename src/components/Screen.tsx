import { useCallback, useRef, type ReactElement, type ReactNode } from 'react';
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
import { ScrollIntoViewContext, type ScrollIntoView } from './ScrollIntoView';
import { MenuButton } from './Sidebar';

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
  /** Pulsante del menu laterale prima del titolo (schermate principali). */
  menu?: boolean;
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
  menu,
}: Props) {
  const { colors, spacing } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const offsetY = useRef(0);
  // Posizione nel contenuto = scorrimento attuale + distanza sullo schermo dall'inizio dello ScrollView.
  const scrollIntoView = useCallback<ScrollIntoView>(
    (target, options) => {
      const scroller = scrollRef.current;
      const node = target.current;
      if (!scroller || !node) return;
      (scroller as unknown as View).measureInWindow((_sx, sy) => {
        node.measureInWindow((_x, y) => {
          const top = offsetY.current + (y - sy) - (options?.offset ?? spacing.md);
          scroller.scrollTo({ y: Math.max(0, top), animated: true });
        });
      });
    },
    [spacing.md],
  );
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
      {menu ? (
        <View style={{ marginLeft: -spacing.sm }}>
          <MenuButton />
        </View>
      ) : null}
      <AppText variant="largeTitle" style={{ flex: 1 }}>
        {title}
      </AppText>
      {titleAction}
    </View>
  ) : null;
  return (
    <SafeAreaView edges={safeEdges} style={[styles.flex, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollIntoViewContext.Provider value={scrollIntoView}>
          <ScrollView
            ref={scrollRef}
            onScroll={(e) => {
              offsetY.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={32}
            contentContainerStyle={[padding, styles.grow, contentStyle]}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            {heading}
            {children}
          </ScrollView>
        </ScrollIntoViewContext.Provider>
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
