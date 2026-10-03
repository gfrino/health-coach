import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, ChipGroup, Stepper, SwitchRow } from '@/components';
import { addMinutes } from '@/lib/time';
import type { Proactivity } from '@/config/settingsSchema';
import { useTheme } from '@/theme';

interface Props {
  value: Proactivity;
  onChange: (value: Proactivity) => void;
}

const STEP_MIN = 15;

export function PreferencesForm({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const set = (patch: Partial<Proactivity>) => onChange({ ...value, ...patch });
  const proactive = value.mode === 'proactive';

  const time = (
    label: string,
    key: 'morningCheckinTime' | 'eveningSummaryTime' | 'quietHoursStart' | 'quietHoursEnd',
  ) => (
    <Stepper
      label={label}
      display={value[key]}
      onDecrement={() => set({ [key]: addMinutes(value[key], -STEP_MIN) })}
      onIncrement={() => set({ [key]: addMinutes(value[key], STEP_MIN) })}
      decrementLabel={t('components.earlier', { minutes: STEP_MIN })}
      incrementLabel={t('components.later', { minutes: STEP_MIN })}
    />
  );

  return (
    <View style={{ gap: spacing.xl }}>
      <ChipGroup
        label={t('preferences.mode')}
        value={value.mode}
        onChange={(mode) => set({ mode })}
        options={(['proactive', 'passive'] as const).map((m) => ({
          value: m,
          label: t(`preferences.modes.${m}.label`),
          description: t(`preferences.modes.${m}.description`),
        }))}
      />

      {/* Passivo = nessuna notifica: orari, ore di silenzio e report non servono. */}
      {proactive ? (
        <>
          <Card>
            <Stepper
              label={t('preferences.maxNotifications')}
              display={String(value.maxNotificationsPerDay)}
              onDecrement={() => set({ maxNotificationsPerDay: value.maxNotificationsPerDay - 1 })}
              onIncrement={() => set({ maxNotificationsPerDay: value.maxNotificationsPerDay + 1 })}
              canDecrement={value.maxNotificationsPerDay > 0}
              canIncrement={value.maxNotificationsPerDay < 5}
              decrementLabel={t('components.decrease')}
              incrementLabel={t('components.increase')}
            />
            <AppText variant="caption" tone="textMuted">
              {t('preferences.maxNotificationsHint')}
            </AppText>
          </Card>

          <Card>
            {time(t('preferences.morningTime'), 'morningCheckinTime')}
            <AppText variant="caption" tone="textMuted">
              {t('preferences.morningHint')}
            </AppText>
            {time(t('preferences.summaryTime'), 'eveningSummaryTime')}
            <AppText variant="headline" style={{ marginTop: spacing.sm }}>
              {t('preferences.quietHours')}
            </AppText>
            {time(t('preferences.quietStart'), 'quietHoursStart')}
            {time(t('preferences.quietEnd'), 'quietHoursEnd')}
            <AppText variant="caption" tone="textMuted">
              {t('preferences.quietHint')}
            </AppText>
          </Card>

          <Card>
            <AppText variant="headline">{t('preferences.reports')}</AppText>
            {(['daily', 'weekly', 'monthly'] as const).map((r) => (
              <SwitchRow
                key={r}
                label={t(`preferences.reportTypes.${r}`)}
                value={value.reports[r]}
                onChange={(v) => set({ reports: { ...value.reports, [r]: v } })}
              />
            ))}
          </Card>
        </>
      ) : null}
    </View>
  );
}
