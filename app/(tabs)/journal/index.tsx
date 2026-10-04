import { Stack } from 'expo-router/stack';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon, Screen } from '@/components';
import { JournalSection, newJournalEntry } from '@/features/journal/JournalSection';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

/** Tab "Diario": come si sente l'utente, scritto da lui o annotato dal coach. */
export default function JournalScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('tabs.journal') }} />
      <Screen
        menu
        title={t('tabs.journal')}
        titleAction={
          <Pressable
            onPress={() => {
              haptic.tap();
              newJournalEntry();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('journal.newTitle')}
            hitSlop={10}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primarySoft,
            }}
          >
            <Icon name="add" color={colors.primary} />
          </Pressable>
        }
      >
        <JournalSection />
      </Screen>
    </>
  );
}
