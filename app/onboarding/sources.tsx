import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card } from '@/components';
import { HealthSourceCard } from '@/components/HealthSourceCard';
import { comingSoonByCategory } from '@/integrations/integrationsCatalog';
import { OnboardingStep } from '@/onboarding/OnboardingStep';
import { goToStep } from '@/onboarding/steps';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

export default function SourcesStep() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const connected = useSettingsStore((s) => s.settings.healthSourceConnectedAt !== null);
  const isIOS = Platform.OS === 'ios';
  const sourceName = isIOS ? 'Apple Health' : 'Health Connect';
  const comingSoon = comingSoonByCategory(isIOS ? 'ios' : 'android')
    .filter((g) => g.category !== 'ai')
    .flatMap((g) => g.items);

  return (
    <OnboardingStep
      step={2}
      title={t('sources.title')}
      subtitle={t('sources.subtitle', { source: sourceName })}
      // Finché non è collegato, l'unico pulsante in evidenza è "Collega" nella scheda:
      // in basso resta solo "Salta per ora" (Continua e Salta facevano la stessa cosa).
      primary={connected ? { label: t('common.continue'), onPress: () => goToStep(3) } : undefined}
      secondary={connected ? undefined : { label: t('sources.skip'), onPress: () => goToStep(3) }}
    >
      <HealthSourceCard />

      <Card tone="soft">
        <AppText variant="headline">{t('sources.otherAppsTitle')}</AppText>
        <AppText variant="callout">{t('sources.otherAppsBody', { source: sourceName })}</AppText>
        <AppText variant="caption" tone="textMuted">
          {isIOS ? t('sources.otherAppsHowIOS') : t('sources.otherAppsHowAndroid')}
        </AppText>
      </Card>

      <Card>
        <AppText variant="headline">{t('sources.comingSoonTitle')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {comingSoon.map((i) => (
            <View
              key={i.id}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <AppText variant="caption">
                {t(`integrations.items.${i.id}.name` as 'integrations.items.withings.name', {
                  defaultValue: i.name,
                })}
              </AppText>
            </View>
          ))}
        </View>
        <AppText variant="caption" tone="textMuted">
          {t('sources.comingSoonBody')}
        </AppText>
      </Card>
    </OnboardingStep>
  );
}
