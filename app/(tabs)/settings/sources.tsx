import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Icon, Screen } from '@/components';
import { SOURCE_TOPICS, SOURCES, type Citation, type SourceTopic } from '@/health/sources';
import { useTheme } from '@/theme';

/**
 * Fonti scientifiche delle informazioni di salute (formule, valori di riferimento, linee guida).
 * Raggiungibile da Impostazioni e dai link "Fonti scientifiche" nelle schermate.
 */
export default function SourcesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { topic, from } = useLocalSearchParams<{ topic?: string; from?: string }>();
  // Il tema da cui si arriva va in cima, gli altri seguono nell'ordine abituale.
  const first = (SOURCE_TOPICS as readonly string[]).includes(topic ?? '')
    ? (topic as SourceTopic)
    : null;
  const topics = first ? [first, ...SOURCE_TOPICS.filter((x) => x !== first)] : SOURCE_TOPICS;

  return (
    <>
      <Stack.Screen
        options={{
          title: t('citations.title'),
          // Spesso aperta da un'altra tab (Coach, Cibo…): la freccia torna alla schermata di
          // provenienza (parametro "from"), non alla prima tab.
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => {
                // Torna alla schermata del link (es. il Coach), altrimenti alle impostazioni.
                if (from?.startsWith('/') && from !== '/settings/sources')
                  router.navigate(from as Href);
                else router.navigate('/settings');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              hitSlop={10}
              style={{ paddingHorizontal: 8 }}
            >
              <Icon name="chevronLeft" color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <Screen>
        <AppText variant="callout" tone="textMuted">
          {t('citations.intro')}
        </AppText>
        {topics.map((k) => (
          <View key={k} style={{ gap: 8 }}>
            <AppText variant="headline">{t(`citations.topics.${k}`)}</AppText>
            <AppText variant="caption" tone="textMuted">
              {t(`citations.usedFor.${k}`)}
            </AppText>
            <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
              {SOURCES[k].map((c, i) => (
                <CitationRow key={c.url + i} citation={c} first={i === 0} />
              ))}
            </Card>
          </View>
        ))}
        <AppText variant="caption" tone="textMuted">
          {t('citations.footer')}
        </AppText>
      </Screen>
    </>
  );
}

function CitationRow({ citation, first }: { citation: Citation; first: boolean }) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={() => void WebBrowser.openBrowserAsync(citation.url)}
      accessibilityRole="link"
      accessibilityLabel={`${citation.title}, ${citation.authors}, ${citation.publisher}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="callout">{citation.title}</AppText>
        <AppText variant="caption" tone="textMuted">
          {`${citation.authors} · ${citation.publisher}`}
        </AppText>
      </View>
      <Icon name="globe" size={16} color={colors.primary} />
    </Pressable>
  );
}
