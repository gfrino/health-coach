import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Pressable, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon, Screen, SourcesLink } from '@/components';
import { RecordsSection, useAddReport } from '@/features/RecordsSection';
import { TodaySection } from '@/features/today/TodaySection';
import { syncHealthData, useSyncStore } from '@/sources/syncService';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

type Section = 'today' | 'records';

/** Oggi e Cartella clinica: due voci del menu laterale, stessa schermata. */
export default function MeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ section?: string }>();
  const [reloadKey, setReloadKey] = useState(0);
  // Spinner solo per l'aggiornamento chiesto dall'utente; quello automatico è silenzioso.
  const refreshing = useSyncStore((st) => st.syncing && st.manual);
  // La sezione arriva dal menu laterale; "journal" e altri vecchi link mostrano Oggi.
  const current: Section = params.section === 'records' ? 'records' : 'today';
  const title = t(current === 'records' ? 'tabs.records' : 'tabs.today');

  const add = useAddReport((ids) => {
    setReloadKey((k) => k + 1);
    if (ids.length === 1)
      router.push({ pathname: '/me/report/[id]', params: { id: ids[0] as string } });
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title }} />
      <Screen
        menu
        title={title}
        titleAction={
          current === 'records' ? (
            <Pressable
              onPress={() => {
                haptic.tap();
                void add();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('records.addTitle')}
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
          ) : undefined
        }
        refreshControl={
          current === 'today' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void syncHealthData({ force: true, manual: true })}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {current === 'today' ? (
          <>
            <TodaySection />
            <SourcesLink />
          </>
        ) : (
          <RecordsSection reloadKey={reloadKey} />
        )}
      </Screen>
    </>
  );
}
