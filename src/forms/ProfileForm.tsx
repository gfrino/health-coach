import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, ChipGroup, DateField, TextField } from '@/components';
import { getDb, profileRepository } from '@/db';
import type { Profile } from '@/db/repositories/profileRepository';
import { GOALS } from '@/goals/goals';
import { readHealthProfilePrefill } from '@/sources/platformHealth';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

const LB_PER_KG = 2.20462;

function parseNumber(v: string): number | null {
  const n = Number(v.replace(',', '.'));
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Dati di base del profilo (sesso, nascita, altezza, peso, obiettivi): stato, precompilazione da
 * Apple Salute / Health Connect e salvataggio. Usato nell'onboarding e in Opzioni → Il mio profilo.
 */
export function useProfileForm() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const units = useSettingsStore((s) => s.settings.units);
  const healthConnected = useSettingsStore((s) => s.settings.healthSourceConnectedAt !== null);
  const lb = units.weight === 'lb';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const db = await getDb();
      let p = await profileRepository.getProfile(db);
      // Precompila dai dati della sorgente solo i campi vuoti.
      if (healthConnected) {
        const pre = await readHealthProfilePrefill();
        const merged: Profile = {
          ...p,
          sex: p.sex ?? pre.sex ?? null,
          birthDate: p.birthDate ?? pre.birthDate ?? null,
          heightCm: p.heightCm ?? pre.heightCm ?? null,
          weightKg: p.weightKg ?? pre.weightKg ?? null,
        };
        if (JSON.stringify(merged) !== JSON.stringify(p)) {
          p = merged;
          if (active) setPrefilled(true);
        }
      }
      if (!active) return;
      setProfile(p);
      setHeight(p.heightCm ? String(p.heightCm) : '');
      const show = (kg: number | null) =>
        kg ? String(Math.round((lb ? kg * LB_PER_KG : kg) * 10) / 10) : '';
      setWeight(show(p.weightKg));
      setTargetWeight(show(p.targetWeightKg));
    })();
    return () => {
      active = false;
    };
  }, [healthConnected, lb]);

  const set = (patch: Partial<Profile>) => setProfile((cur) => (cur ? { ...cur, ...patch } : cur));

  const toggleGoal = (goal: string) =>
    setProfile((cur) =>
      cur
        ? {
            ...cur,
            goals: cur.goals.includes(goal)
              ? cur.goals.filter((x) => x !== goal)
              : [...cur.goals, goal],
          }
        : cur,
    );
  // Peso obiettivo: solo se l'utente vuole perdere o aumentare di peso.
  const weightGoal =
    !!profile && (profile.goals.includes('loseWeight') || profile.goals.includes('gainWeight'));

  const save = async () => {
    if (!profile) return;
    const db = await getDb();
    const kg = (v: string) => {
      const n = parseNumber(v);
      return n === null ? null : Math.round((lb ? n / LB_PER_KG : n) * 10) / 10;
    };
    const target = weightGoal ? kg(targetWeight) : null;
    await profileRepository.saveProfile(db, {
      ...profile,
      heightCm: parseNumber(height),
      weightKg: kg(weight),
      targetWeightKg: target,
      targetDate: target ? profile.targetDate : null,
    });
  };

  const fields = profile ? (
    <>
      {prefilled ? (
        <Card tone="soft">
          <AppText variant="callout">{t('profileSetup.prefilled')}</AppText>
        </Card>
      ) : null}
      <ChipGroup
        label={t('profileSetup.sex')}
        value={profile.sex ?? ''}
        onChange={(v) => set({ sex: v === profile.sex ? null : (v as Profile['sex']) })}
        options={(['female', 'male', 'other'] as const).map((s) => ({
          value: s,
          label: t(`profileSetup.sexOptions.${s}`),
        }))}
      />
      <DateField
        label={t('profileSetup.birthDate')}
        value={profile.birthDate}
        onChange={(birthDate) => set({ birthDate })}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('profileSetup.height')}
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            placeholder="170"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('profileSetup.weight', { unit: units.weight })}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder={lb ? '150' : '70'}
          />
        </View>
      </View>

      <ChipGroup
        label={t('profileSetup.goalsLabel')}
        value={profile.goals}
        onChange={toggleGoal}
        options={GOALS.map((g) => ({ value: g, label: t(`profileSetup.goals.${g}`) }))}
      />
      {weightGoal ? (
        <Card tone="soft">
          <TextField
            label={t('profileSetup.targetWeight', { unit: units.weight })}
            value={targetWeight}
            onChangeText={setTargetWeight}
            keyboardType="decimal-pad"
            placeholder={lb ? '150' : '70'}
          />
          <DateField
            label={t('profileSetup.targetDate')}
            value={profile.targetDate}
            onChange={(targetDate) => set({ targetDate })}
          />
          <AppText variant="caption" tone="textMuted">
            {t('profileSetup.targetHint')}
          </AppText>
        </Card>
      ) : null}
    </>
  ) : null;

  return { ready: profile !== null, fields, save };
}
