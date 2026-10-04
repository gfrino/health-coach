import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';

import { haptic } from '@/lib/haptics';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type AppIconName } from './Icon';

/** Menu laterale (in alto a sinistra): Io, Servizi, Opzioni. */
export const useSidebar = create<{ open: boolean }>(() => ({ open: false }));
export const openSidebar = () => {
  haptic.tap();
  useSidebar.setState({ open: true });
};
const closeSidebar = () => useSidebar.setState({ open: false });

const ITEMS: { route: '/me' | '/integrations' | '/settings'; icon: AppIconName; key: string }[] = [
  { route: '/me', icon: 'me', key: 'tabsShort.me' },
  { route: '/integrations', icon: 'integrations', key: 'tabsShort.integrations' },
  { route: '/settings', icon: 'settings', key: 'tabsShort.settings' },
];

/** Pulsante ☰ per l'header delle schermate principali. */
export function MenuButton() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={openSidebar}
      accessibilityRole="button"
      accessibilityLabel={t('sidebar.open')}
      hitSlop={10}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.primarySoft : 'transparent',
      })}
    >
      <Icon name="menu" color={colors.text} />
    </Pressable>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const open = useSidebar((s) => s.open);
  const coachName = useSettingsStore((s) => s.settings.coach.name);
  const pathname = usePathname();
  const panelWidth = Math.min(320, width * 0.8);
  const [x] = useState(() => new Animated.Value(-320));

  useEffect(() => {
    if (open) {
      x.setValue(-panelWidth);
      Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }
  }, [open, panelWidth, x]);

  const close = (then?: () => void) =>
    Animated.timing(x, { toValue: -panelWidth, duration: 180, useNativeDriver: true }).start(() => {
      closeSidebar();
      then?.();
    });

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => close()}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
        onPress={() => close()}
        accessibilityRole="button"
        accessibilityLabel={t('sidebar.close')}
      >
        <Animated.View
          onStartShouldSetResponder={() => true}
          style={{
            width: panelWidth,
            height: '100%',
            backgroundColor: colors.background,
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.md,
            gap: spacing.xs,
            transform: [{ translateX: x }],
          }}
        >
          <View style={{ paddingHorizontal: spacing.sm, marginBottom: spacing.lg }}>
            <AppText variant="title" style={{ color: colors.primary }}>
              AlbA
            </AppText>
            <AppText variant="caption" tone="textMuted">
              {t('sidebar.subtitle', { name: coachName })}
            </AppText>
          </View>
          {ITEMS.map((it) => {
            const active = pathname.startsWith(it.route);
            return (
              <Pressable
                key={it.route}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  haptic.select();
                  // Prima la navigazione, poi la chiusura: durante la chiusura animata del
                  // Modal iOS ignorerebbe il cambio di schermata.
                  router.navigate(it.route);
                  closeSidebar();
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  minHeight: 52,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: active || pressed ? colors.primarySoft : 'transparent',
                })}
              >
                <Icon name={it.icon} color={active ? colors.primary : colors.text} />
                <AppText
                  variant="headline"
                  style={{ color: active ? colors.primary : colors.text }}
                >
                  {t(it.key as 'tabsShort.me')}
                </AppText>
              </Pressable>
            );
          })}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
