import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, TextField } from '@/components';
import { parseNumber } from '@/records/labExtraction';
import { useTheme } from '@/theme';

/** Valori del modulo come testo (si scrivono con la tastiera numerica, anche con la virgola). */
export interface FoodDraft {
  name: string;
  quantity: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sugar: string;
  saturatedFat: string;
  sodium: string;
}

export const emptyDraft = (): FoodDraft => ({
  name: '',
  quantity: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  sugar: '',
  saturatedFat: '',
  sodium: '',
});

const str = (v: number | null | undefined) => (v == null ? '' : String(v));

export function toDraft(v: {
  name: string;
  quantity: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber?: number | null;
  sugar?: number | null;
  saturatedFat?: number | null;
  sodium?: number | null;
}): FoodDraft {
  return {
    name: v.name,
    quantity: v.quantity ?? '',
    calories: str(v.calories),
    protein: str(v.protein),
    carbs: str(v.carbs),
    fat: str(v.fat),
    fiber: str(v.fiber),
    sugar: str(v.sugar),
    saturatedFat: str(v.saturatedFat),
    sodium: str(v.sodium),
  };
}

export function fromDraft(d: FoodDraft) {
  return {
    name: d.name.trim(),
    quantity: d.quantity.trim() || null,
    calories: parseNumber(d.calories),
    protein: parseNumber(d.protein),
    carbs: parseNumber(d.carbs),
    fat: parseNumber(d.fat),
    fiber: parseNumber(d.fiber),
    sugar: parseNumber(d.sugar),
    saturatedFat: parseNumber(d.saturatedFat),
    sodium: parseNumber(d.sodium),
  };
}

/**
 * Campi di un alimento: nome, quantità e calorie in vista; proteine, carboidrati e grassi
 * dietro "Più dettagli", per non spaventare nessuno.
 */
export function FoodItemFields({
  value,
  onChange,
}: {
  value: FoodDraft;
  onChange: (v: FoodDraft) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [details, setDetails] = useState(false);
  const set = (k: keyof FoodDraft) => (text: string) => onChange({ ...value, [k]: text });
  const numberField = (
    k: 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'saturatedFat' | 'sodium',
  ) => (
    <View style={{ flex: 1 }}>
      <TextField
        label={t(`food.${k}G`)}
        value={value[k]}
        onChangeText={set(k)}
        keyboardType="decimal-pad"
        placeholder="0"
      />
    </View>
  );
  return (
    <View style={{ gap: spacing.md }}>
      <TextField label={t('food.name')} value={value.name} onChangeText={set('name')} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 3 }}>
          <TextField
            label={t('food.quantity')}
            value={value.quantity}
            onChangeText={set('quantity')}
            placeholder={t('food.quantityPlaceholder')}
          />
        </View>
        <View style={{ flex: 2 }}>
          <TextField
            label={t('food.kcalLabel')}
            value={value.calories}
            onChangeText={set('calories')}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>
      </View>
      {details ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {numberField('protein')}
            {numberField('carbs')}
            {numberField('fat')}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {numberField('fiber')}
            {numberField('sugar')}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {numberField('saturatedFat')}
            {numberField('sodium')}
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setDetails(true)} accessibilityRole="button" hitSlop={8}>
          <AppText variant="callout" style={{ color: colors.primary, fontWeight: '600' }}>
            {t('food.moreDetails')}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
