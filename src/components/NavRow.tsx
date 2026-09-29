import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type AppIconName } from './Icon';

interface Props {
  label: string;
  value?: string;
  icon?: AppIconName;
  onPress: () => void;
  first?: boolean;
}

/** Riga di navigazione per le liste delle impostazioni. */
export function NavRow({ label, value, icon, onPress, first }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 52,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      })}
    >
      {icon ? <Icon name={icon} size={20} color={colors.primary} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText>{label}</AppText>
        {value ? (
          <AppText variant="caption" tone="textMuted" numberOfLines={1}>
            {value}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevronRight" size={16} color={colors.textMuted} />
    </Pressable>
  );
}
