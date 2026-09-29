import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, Icon, Screen, type AppIconName } from '@/components';
import { goToStep } from '@/onboarding/steps';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

/** Passo 0 dell'onboarding: benvenuto, privacy e accettazione esplicita del disclaimer medico. */
export default function WelcomeStep() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [accepted, setAccepted] = useState(settings.medicalDisclaimerAcceptedAt !== null);
  const [saving, setSaving] = useState(false);

  const points: { icon: AppIconName; key: 'local' | 'ai' | 'noServer' }[] = [
    { icon: 'lock', key: 'local' },
    { icon: 'sparkles', key: 'ai' },
    { icon: 'server', key: 'noServer' },
  ];

  const onStart = async () => {
    setSaving(true);
    try {
      await update({
        medicalDisclaimerAcceptedAt: settings.medicalDisclaimerAcceptedAt ?? Date.now(),
      });
      await goToStep(1);
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <Button
          label={t('onboarding.start')}
          onPress={onStart}
          disabled={!accepted}
          loading={saving}
        />
      }
    >
      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        <AppText variant="largeTitle">{t('onboarding.welcomeTitle')}</AppText>
        <AppText tone="textMuted">{t('onboarding.welcomeBody')}</AppText>
      </View>

      <Card>
        <AppText variant="headline">{t('onboarding.privacyTitle')}</AppText>
        {points.map((p) => (
          <View
            key={p.key}
            style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}
          >
            <Icon name={p.icon} size={20} color={colors.primary} />
            <AppText variant="callout" style={{ flex: 1 }}>
              {t(`onboarding.privacyPoints.${p.key}`)}
            </AppText>
          </View>
        ))}
      </Card>

      <Card tone="warning">
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Icon name="warning" size={20} color={colors.warning} />
          <AppText variant="headline">{t('onboarding.disclaimerTitle')}</AppText>
        </View>
        <AppText variant="callout">{t('onboarding.disclaimer')}</AppText>
      </Card>

      <Pressable
        onPress={() => setAccepted((a) => !a)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        accessibilityLabel={t('onboarding.acceptDisclaimer')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: radius.sm,
            borderWidth: 2,
            borderColor: accepted ? colors.primary : colors.textMuted,
            backgroundColor: accepted ? colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {accepted ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
        </View>
        <AppText style={{ flex: 1 }}>{t('onboarding.acceptDisclaimer')}</AppText>
      </Pressable>
    </Screen>
  );
}
