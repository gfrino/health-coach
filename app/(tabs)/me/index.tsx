import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Pressable, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon, Screen, SegmentedControl } from '@/components';
import { RecordsSection, useAddReport } from '@/features/RecordsSection';
import { TodaySection } from '@/features/today/TodaySection';
import { syncHealthData, useSyncStore } from '@/sources/syncService';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

type Section = 'today' | 'records';

/** "Io" (dal menu laterale): Oggi e Cartella salute. Il Diario ha una tab propria. */
export default function MeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ section?: Section }>();
  const [section, setSection] = useState<Section>(params.section ?? 'today');
  const [reloadKey, setReloadKey] = useState(0);
  // Spinner solo per l'aggiornamento chiesto dall'utente; quello automatico è silenzioso.
  const refreshing = useSyncStore((st) => st.syncing && st.manual);
  // "journal" (vecchi link): il diario ora è una tab; qui si mostra Oggi.
  const fromParams =
    params.section === 'records' || params.section === 'today' ? params.section : null;
  const current = fromParams && fromParams !== section ? fromParams : section;

  const add = useAddReport((ids) => {
    setReloadKey((k) => k + 1);
    if (ids.length === 1)
      router.push({ pathname: '/me/report/[id]', params: { id: ids[0] as string } });
  });

  const select = (s: Section) => {
    setSection(s);
    router.setParams({ section: s });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('tabs.me') }} />
      <Screen
        menu
        title={t('tabs.me')}
        titleAction={
          current === 'records' ? (
            <Pressable
              onPress={() => {
                haptic.tap();
                add();
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
        <SegmentedControl
          value={current}
          onChange={select}
          segments={[
            { value: 'today', label: t('tabs.today') },
            { value: 'records', label: t('tabs.records') },
          ]}
        />
        {current === 'today' ? <TodaySection /> : <RecordsSection reloadKey={reloadKey} />}
      </Screen>
    </>
  );
}
