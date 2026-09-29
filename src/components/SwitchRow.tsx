import { Switch, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

interface Props {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function SwitchRow({ label, description, value, onChange }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText>{label}</AppText>
        {description ? (
          <AppText variant="caption" tone="textMuted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}
