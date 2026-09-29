import { Fragment, useMemo, type ReactNode } from 'react';
import { Linking, Text, View } from 'react-native';

import { parseMarkdown, type Inline } from '@/lib/markdown';
import { MAX_FONT_SCALE, useTheme } from '@/theme';

function renderInline(
  nodes: Inline[],
  linkColor: string,
  codeBg: string,
  keyPrefix = '',
): ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}${i}`;
    switch (n.type) {
      case 'text':
        return <Fragment key={key}>{n.text}</Fragment>;
      case 'bold':
        return (
          <Text key={key} style={{ fontWeight: '700' }}>
            {renderInline(n.children, linkColor, codeBg, `${key}-`)}
          </Text>
        );
      case 'italic':
        return (
          <Text key={key} style={{ fontStyle: 'italic' }}>
            {renderInline(n.children, linkColor, codeBg, `${key}-`)}
          </Text>
        );
      case 'code':
        return (
          <Text key={key} style={{ fontFamily: 'Menlo', backgroundColor: codeBg }}>
            {n.text}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={key}
            accessibilityRole="link"
            style={{ color: linkColor, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL(n.url)}
          >
            {renderInline(n.children, linkColor, codeBg, `${key}-`)}
          </Text>
        );
    }
  });
}

export function Markdown({ children }: { children: string }) {
  const { colors, spacing, typography, radius } = useTheme();
  const blocks = useMemo(() => parseMarkdown(children), [children]);
  const base = [typography.body, { color: colors.text }];

  return (
    <View style={{ gap: spacing.sm }}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            return (
              <Text
                key={i}
                accessibilityRole="header"
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                style={[
                  b.level === 1 ? typography.title : typography.headline,
                  { color: colors.text },
                ]}
              >
                {renderInline(b.inline, colors.primary, colors.surfaceAlt)}
              </Text>
            );
          case 'paragraph':
            return (
              <Text key={i} maxFontSizeMultiplier={MAX_FONT_SCALE} style={base}>
                {renderInline(b.inline, colors.primary, colors.surfaceAlt)}
              </Text>
            );
          case 'quote':
            return (
              <View
                key={i}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: colors.border,
                  paddingLeft: spacing.md,
                }}
              >
                <Text
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={[base, { color: colors.textMuted }]}
                >
                  {renderInline(b.inline, colors.primary, colors.surfaceAlt)}
                </Text>
              </View>
            );
          case 'code':
            return (
              <View
                key={i}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.sm,
                  padding: spacing.sm,
                }}
              >
                <Text
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={[typography.callout, { color: colors.text, fontFamily: 'Menlo' }]}
                >
                  {b.text}
                </Text>
              </View>
            );
          case 'list':
            return (
              <View key={i} style={{ gap: spacing.xs }}>
                {b.items.map((item, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[base, { minWidth: 18 }]}>
                      {b.ordered ? `${j + 1}.` : '•'}
                    </Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[base, { flex: 1 }]}>
                      {renderInline(item, colors.primary, colors.surfaceAlt)}
                    </Text>
                  </View>
                ))}
              </View>
            );
        }
      })}
    </View>
  );
}
