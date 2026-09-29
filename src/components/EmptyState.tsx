import { View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type AppIconName } from './Icon';

interface Props {
  icon: AppIconName;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, body, action }: Props) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        padding: spacing.xl,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.pill,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={32} color={colors.primary} />
      </View>
      <AppText variant="title" align="center">
        {title}
      </AppText>
      <AppText tone="textMuted" align="center" style={{ maxWidth: 340 }}>
        {body}
      </AppText>
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </View>
  );
}
