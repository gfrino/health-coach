import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup, TextField } from '@/components';
import {
  COACH_TONES,
  MEDICAL_APPROACHES,
  NUTRITION_APPROACHES,
  type CoachConfig,
} from '@/config/settingsSchema';
import { useTheme } from '@/theme';

interface Props {
  value: CoachConfig;
  onChange: (value: CoachConfig) => void;
}

export function CoachForm({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const set = (patch: Partial<CoachConfig>) => onChange({ ...value, ...patch });

  return (
    <View style={{ gap: spacing.xl }}>
      <TextField
        label={t('coachSetup.name')}
        value={value.name}
        onChangeText={(name) => set({ name })}
        maxLength={40}
        hint={t('coachSetup.nameHint')}
      />
      <ChipGroup
        label={t('coachSetup.medical')}
        value={value.medicalApproach}
        onChange={(medicalApproach) => set({ medicalApproach })}
        options={MEDICAL_APPROACHES.map((v) => ({
          value: v,
          label: t(`coachSetup.medicalOptions.${v}.label`),
          description: t(`coachSetup.medicalOptions.${v}.description`),
        }))}
      />
      <ChipGroup
        label={t('coachSetup.nutrition')}
        value={value.nutritionApproach}
        onChange={(nutritionApproach) => set({ nutritionApproach })}
        options={NUTRITION_APPROACHES.map((v) => ({
          value: v,
          label: t(`coachSetup.nutritionOptions.${v}`),
        }))}
      />
      <ChipGroup
        label={t('coachSetup.tone')}
        value={value.tone}
        onChange={(tone) => set({ tone })}
        options={COACH_TONES.map((v) => ({
          value: v,
          label: t(`coachSetup.toneOptions.${v}.label`),
          description: t(`coachSetup.toneOptions.${v}.description`),
        }))}
      />
    </View>
  );
}
