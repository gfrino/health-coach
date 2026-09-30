import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { Icon, type AppIconName } from '@/components';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

const TABS: {
  name: string;
  icon: AppIconName;
  labelKey: `tabs.${'coach' | 'me' | 'integrations' | 'settings'}`;
}[] = [
  { name: 'coach', icon: 'coach', labelKey: 'tabs.coach' },
  { name: 'me', icon: 'me', labelKey: 'tabs.me' },
  { name: 'integrations', icon: 'integrations', labelKey: 'tabs.integrations' },
  { name: 'settings', icon: 'settings', labelKey: 'tabs.settings' },
];

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
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
          options={{
            title: t(tab.labelKey),
            // Etichetta breve nella barra (6 tab), nome completo per VoiceOver/TalkBack.
            tabBarLabel: t(`tabsShort.${tab.name}` as 'tabsShort.coach'),
            tabBarAccessibilityLabel: t(tab.labelKey),
            tabBarIcon: ({ color, size }) => <Icon name={tab.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
