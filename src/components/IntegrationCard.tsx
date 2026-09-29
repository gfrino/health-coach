import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Integration } from '@/integrations/integrationsCatalog';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { BrandLogo } from './BrandLogo';
import { Button } from './Button';

interface Props {
  integration: Integration;
  interested: boolean;
  onToggleInterest: () => void;
}

/** Integrazione "Presto disponibile" con pulsante "Avvisami". */
export function IntegrationCard({ integration, interested, onToggleInterest }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const name = t(
    `integrations.items.${integration.id}.name` as 'integrations.items.withings.name',
    {
      defaultValue: integration.name,
    },
  );

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <BrandLogo id={integration.id} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline">{name}</AppText>
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radius.pill,
              backgroundColor: colors.warningSoft,
            }}
          >
            <AppText variant="caption" tone="warning" style={{ fontWeight: '600' }}>
              {t('common.comingSoon')}
            </AppText>
          </View>
        </View>
      </View>
      <AppText variant="callout" tone="textMuted">
        {t(`integrations.items.${integration.id}.data` as 'integrations.items.withings.data')}
      </AppText>
      <Button
        label={interested ? t('integrations.notifyOn') : t('integrations.notifyMe')}
        variant={interested ? 'ghost' : 'secondary'}
        onPress={onToggleInterest}
        accessibilityHint={interested ? t('integrations.notifyOffHint') : undefined}
      />
    </View>
  );
}
