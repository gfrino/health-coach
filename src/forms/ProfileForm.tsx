import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, ChipGroup, DateField, TextField } from '@/components';
import { getDb, profileRepository } from '@/db';
import type { Profile } from '@/db/repositories/profileRepository';
import { readHealthProfilePrefill } from '@/sources/platformHealth';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

const GOALS = [
  'loseWeight',
  'gainWeight',
  'gainMuscle',
  'sleepBetter',
  'moreEnergy',
  'reduceStress',
  'fitness',
  'heartHealth',
  'eatBetter',
  'manageCondition',
] as const;

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
      setWeight(
        p.weightKg ? String(Math.round((lb ? p.weightKg * LB_PER_KG : p.weightKg) * 10) / 10) : '',
      );
    })();
    return () => {
      active = false;
    };
  }, [healthConnected, lb]);

  const set = (patch: Partial<Profile>) => setProfile((cur) => (cur ? { ...cur, ...patch } : cur));

  const goalLabels = GOALS.map((g) => t(`profileSetup.goals.${g}`));
  const toggleGoal = (label: string) =>
    setProfile((cur) =>
      cur
        ? {
            ...cur,
            goals: cur.goals.includes(label)
              ? cur.goals.filter((x) => x !== label)
              : [...cur.goals, label],
          }
        : cur,
    );

  const save = async () => {
    if (!profile) return;
    const db = await getDb();
    const w = parseNumber(weight);
    await profileRepository.saveProfile(db, {
      ...profile,
      heightCm: parseNumber(height),
      weightKg: w === null ? null : Math.round((lb ? w / LB_PER_KG : w) * 10) / 10,
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
        options={goalLabels.map((l) => ({ value: l, label: l }))}
      />
    </>
  ) : null;

  return { ready: profile !== null, fields, save };
}
