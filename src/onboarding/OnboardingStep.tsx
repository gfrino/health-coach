import { useCallback, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Icon, ProgressBar, Screen } from '@/components';
import { useTheme } from '@/theme';

import { ONBOARDING_STEP_COUNT, routeForStep } from './steps';

interface Props {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Assente quando l'azione principale è nel contenuto (es. "Collega Apple Health"). */
  primary?: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  secondary?: { label: string; onPress: () => void };
  showBack?: boolean;
}

/** Impaginazione comune dei passi: avanzamento, titolo, contenuto, pulsanti in basso. */
export function OnboardingStep({
  step,
  title,
  subtitle,
  children,
  primary,
  secondary,
  showBack = true,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const total = ONBOARDING_STEP_COUNT - 1;
  const canGoBack = showBack && step > 0;

  // Indietro = passo precedente, anche quando l'onboarding è stato ripreso e non c'è cronologia.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(routeForStep(step - 1));
  }, [step]);

  // Tasto indietro di Android: stesso comportamento; sull'ultimo passo non fa nulla.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack) goBack();
        return true;
      });
      return () => sub.remove();
    }, [canGoBack, goBack]),
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        edges={['top', 'bottom']}
        footer={
          <View style={{ gap: spacing.sm }}>
            {primary ? <Button {...primary} /> : null}
            {secondary ? (
              <Button label={secondary.label} onPress={secondary.onPress} variant="ghost" />
            ) : null}
          </View>
        }
      >
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 44,
            }}
          >
            {canGoBack ? (
              <Pressable
                onPress={goBack}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                hitSlop={8}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  minHeight: 44,
                  paddingRight: spacing.md,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View style={{ transform: [{ scaleX: -1 }] }}>
                  <Icon name="chevronRight" size={18} color={colors.primary} />
                </View>
                <AppText tone="primary" style={{ fontWeight: '600' }}>
                  {t('common.back')}
                </AppText>
              </Pressable>
            ) : (
              <View />
            )}
            <AppText variant="caption" tone="textMuted">
              {t('onboarding.stepOf', { step, total })}
            </AppText>
          </View>
          <ProgressBar value={step / total} label={t('onboarding.stepOf', { step, total })} />
        </View>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="largeTitle">{title}</AppText>
          {subtitle ? <AppText tone="textMuted">{subtitle}</AppText> : null}
        </View>
        {children}
      </Screen>
    </KeyboardAvoidingView>
  );
}
