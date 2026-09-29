import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { toAIError } from '@/ai/errors';
import { AppText, Card, Icon, Markdown, ProgressBar } from '@/components';
import { syncHealthData, useSyncStore } from '@/sources/syncService';
import { ONBOARDING_FLOW_VERSION } from '@/config/settingsSchema';
import { generateWelcome } from '@/coach/chatEngine';
import { OnboardingStep } from '@/onboarding/OnboardingStep';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

type Phase = 'profile' | 'data' | 'welcome' | 'done' | 'error';

/** Passo finale: prima sincronizzazione dei dati di salute (con avanzamento) e benvenuto del coach. */
export default function SyncStep() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [phase, setPhase] = useState<Phase>('profile');
  const [preview, setPreview] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const progress = useSyncStore((st) => st.progress);
  const conversationId = useRef<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPhase('data');
      if (settings.healthSourceConnectedAt !== null) await syncHealthData({ force: true });
      setPhase('welcome');
      try {
        conversationId.current = await generateWelcome(settings, { onText: setPreview });
        setPhase('done');
      } catch (e) {
        setErrorCode(toAIError(e).code);
        setPhase('error');
      }
    })();
  }, [settings]);

  const finish = async () => {
    await update({ onboardingCompleted: true, onboardingFlowVersion: ONBOARDING_FLOW_VERSION });
    // Il guard in app/_layout.tsx rende disponibili le tab; apriamo la chat del coach.
    router.replace(conversationId.current ? `/coach?c=${conversationId.current}` : '/coach');
  };

  const steps: { key: Phase; label: string }[] = [
    { key: 'profile', label: t('sync.profile') },
    {
      key: 'data',
      label: settings.healthSourceConnectedAt ? t('sync.dataConnected') : t('sync.dataSkipped'),
    },
    { key: 'welcome', label: t('sync.welcome', { name: settings.coach.name }) },
  ];
  const order: Phase[] = ['profile', 'data', 'welcome', 'done'];
  const reached = (k: Phase) =>
    phase === 'error' ? k !== 'welcome' : order.indexOf(phase) > order.indexOf(k);

  return (
    <OnboardingStep
      step={6}
      title={t('sync.title')}
      subtitle={t('sync.subtitle')}
      showBack={false}
      primary={{
        label: t('sync.openChat'),
        onPress: finish,
        disabled: phase !== 'done' && phase !== 'error',
        loading: phase !== 'done' && phase !== 'error',
      }}
    >
      <Card>
        {steps.map((s) => (
          <View
            key={s.key}
            style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', minHeight: 32 }}
          >
            {reached(s.key) ? (
              <Icon name="checkCircle" color={colors.success} />
            ) : phase === 'error' && s.key === 'welcome' ? (
              <Icon name="warning" color={colors.warning} />
            ) : (
              <Icon name="sparkles" color={colors.textMuted} />
            )}
            <AppText style={{ flex: 1 }}>{s.label}</AppText>
          </View>
        ))}
        {phase === 'data' && progress ? (
          <ProgressBar value={progress.done / progress.total} label={t('sync.dataConnected')} />
        ) : null}
      </Card>

      {preview ? (
        <Card tone="soft">
          <AppText variant="headline">{settings.coach.name}</AppText>
          <Markdown>{preview}</Markdown>
        </Card>
      ) : null}

      {phase === 'error' && errorCode ? (
        <Card tone="warning">
          <AppText>{t(`ai.errors.${errorCode}` as 'ai.errors.unknown')}</AppText>
          <AppText variant="caption" tone="textMuted">
            {t('sync.welcomeFailed')}
          </AppText>
        </Card>
      ) : null}
    </OnboardingStep>
  );
}
