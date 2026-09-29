import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, Icon, Screen, SegmentedControl } from '@/components';
import { RecordsSection, useAddReport } from '@/features/RecordsSection';
import { useTheme } from '@/theme';

type Section = 'today' | 'journal' | 'records';

/** Tab "Io": Oggi, Diario e Cartella salute in un'unica sezione personale. */
export default function MeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ section?: Section }>();
  const [section, setSection] = useState<Section>(params.section ?? 'today');
  const [reloadKey, setReloadKey] = useState(0);
  const current = params.section && params.section !== section ? params.section : section;

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
      <Stack.Screen
        options={{
          title: t('tabs.me'),
          headerRight:
            current === 'records'
              ? () => (
                  <Pressable
                    onPress={add}
                    accessibilityRole="button"
                    accessibilityLabel={t('records.addTitle')}
                    hitSlop={10}
                    style={{ paddingHorizontal: 8 }}
                  >
                    <Icon name="add" color={colors.primary} />
                  </Pressable>
                )
              : undefined,
        }}
      />
      <Screen>
        <SegmentedControl
          value={current}
          onChange={select}
          segments={[
            { value: 'today', label: t('tabs.today') },
            { value: 'journal', label: t('tabs.journal') },
            { value: 'records', label: t('tabs.records') },
          ]}
        />
        {current === 'today' ? (
          <EmptyState icon="today" title={t('today.emptyTitle')} body={t('today.emptyBody')} />
        ) : current === 'journal' ? (
          <EmptyState
            icon="journal"
            title={t('journal.emptyTitle')}
            body={t('journal.emptyBody')}
          />
        ) : (
          <RecordsSection reloadKey={reloadKey} />
        )}
      </Screen>
    </>
  );
}
