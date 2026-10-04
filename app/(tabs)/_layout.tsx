import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { Icon, Sidebar, type AppIconName } from '@/components';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

const TABS: {
  name: string;
  icon: AppIconName;
  labelKey: `tabs.${'coach' | 'programs' | 'journal' | 'recipes'}`;
}[] = [
  { name: 'coach', icon: 'coach', labelKey: 'tabs.coach' },
  { name: 'programs', icon: 'programs', labelKey: 'tabs.programs' },
  { name: 'journal', icon: 'journal', labelKey: 'tabs.journal' },
  { name: 'recipes', icon: 'recipes', labelKey: 'tabs.recipes' },
];

/** Raggiungibili dal menu laterale: restano nel navigatore (link e notifiche funzionano) ma senza tab. */
const MENU_SCREENS = ['me', 'integrations', 'settings'] as const;

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <>
      <Tabs
        screenListeners={{ tabPress: () => haptic.select() }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border },
          tabBarAllowFontScaling: true,
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            listeners={({ navigation }) => ({
              // Tornando al Coach da un'altra tab si parte da una chat nuova;
              // le conversazioni precedenti restano in "Cronologia".
              tabPress: (e) => {
                if (tab.name !== 'coach' || navigation.isFocused()) return;
                e.preventDefault();
                router.navigate({ pathname: '/coach', params: { new: String(Date.now()) } });
              },
            })}
            options={{
              title: t(tab.labelKey),
              // Etichetta breve nella barra, nome completo per VoiceOver/TalkBack.
              tabBarLabel: t(`tabsShort.${tab.name}` as 'tabsShort.coach'),
              tabBarAccessibilityLabel: t(tab.labelKey),
              tabBarIcon: ({ color, size }) => <Icon name={tab.icon} color={color} size={size} />,
            }}
          />
        ))}
        {MENU_SCREENS.map((name) => (
          <Tabs.Screen key={name} name={name} options={{ href: null }} />
        ))}
      </Tabs>
      <Sidebar />
    </>
  );
}
