import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Icon, type AppIconName } from '@/components';
import { getDb, profileRepository } from '@/db';
import { haptic } from '@/lib/haptics';
import { MAX_FONT_SCALE, useTheme } from '@/theme';

/**
 * Condizioni croniche, allergie e intolleranze, farmaci e integratori: una scheda per categoria
 * con suggerimenti rapidi, voci aggiunte (con ×) e campo libero. Salva subito nel DB cifrato.
 * Usato nell'onboarding e in Opzioni → Il mio profilo.
 */

type Kind = 'conditions' | 'allergies' | 'medications' | 'supplements';
interface Item {
  id: string;
  text: string;
}

const ICONS: Record<Kind, AppIconName> = {
  conditions: 'condition',
  allergies: 'allergy',
  medications: 'pill',
  supplements: 'leaf',
};

export function HealthListsEditor() {
  const [lists, setLists] = useState<Record<Kind, Item[]> | null>(null);

  const reload = async () => setLists(await loadLists());

  async function loadLists(): Promise<Record<Kind, Item[]>> {
    const db = await getDb();
    const [c, m, a] = await Promise.all([
      profileRepository.listConditions(db),
      profileRepository.listMedications(db),
      profileRepository.listAllergies(db),
    ]);
    return {
      conditions: c.map((x) => ({ id: x.id, text: x.name })),
      allergies: a.map((x) => ({ id: x.id, text: x.substance })),
      medications: m
        .filter((x) => x.kind === 'medication')
        .map((x) => ({ id: x.id, text: x.name })),
      supplements: m
        .filter((x) => x.kind === 'supplement')
        .map((x) => ({ id: x.id, text: x.name })),
    };
  }

  useEffect(() => {
    // Caricamento iniziale; le modifiche successive ricaricano da reload().
    let active = true;
    void loadLists().then((l) => active && setLists(l));
    return () => {
      active = false;
    };
  }, []);

  if (!lists) return null;

  const add = async (kind: Kind, text: string) => {
    const value = text.trim();
    if (!value) return;
    if (lists[kind].some((i) => i.text.toLowerCase() === value.toLowerCase())) return;
    const db = await getDb();
    if (kind === 'conditions') await profileRepository.addCondition(db, value);
    else if (kind === 'allergies') await profileRepository.addAllergy(db, value);
    else
      await profileRepository.addMedication(db, {
        name: value,
        kind: kind === 'medications' ? 'medication' : 'supplement',
      });
    haptic.tap();
    await reload();
  };

  const remove = async (kind: Kind, id: string) => {
    const db = await getDb();
    await profileRepository.removeItem(
      db,
      kind === 'supplements' ? 'medications' : kind === 'medications' ? 'medications' : kind,
      id,
    );
    haptic.select();
    await reload();
  };

  return (
    <View style={{ gap: 12 }}>
      {(['conditions', 'allergies', 'medications', 'supplements'] as const).map((kind) => (
        <ListCard
          key={kind}
          kind={kind}
          items={lists[kind]}
          onAdd={(t) => void add(kind, t)}
          onRemove={(id) => void remove(kind, id)}
        />
      ))}
    </View>
  );
}

function ListCard({
  kind,
  items,
  onAdd,
  onRemove,
}: {
  kind: Kind;
  items: Item[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography } = useTheme();
  const [draft, setDraft] = useState('');
  const k = `healthLists.${kind}` as const;
  const taken = new Set(items.map((i) => i.text.toLowerCase()));
  const suggestions = t(`${k}.suggestions`)
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s && !taken.has(s.toLowerCase()));

  const submit = () => {
    onAdd(draft);
    setDraft('');
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={ICONS[kind]} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="headline">{t(`${k}.title`)}</AppText>
          <AppText variant="caption" tone="textMuted">
            {t(`${k}.hint`)}
          </AppText>
        </View>
      </View>

      {items.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {items.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => onRemove(it.id)}
              accessibilityRole="button"
              accessibilityLabel={t('common.removeItem', { item: it.text })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                minHeight: 36,
                paddingLeft: spacing.md,
                paddingRight: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: colors.primary,
              }}
            >
              <AppText variant="callout" tone="onPrimary">
                {it.text}
              </AppText>
              <Icon name="close" size={12} color={colors.onPrimary} />
            </Pressable>
          ))}
        </View>
      ) : (
        <AppText variant="caption" tone="textMuted">
          {t('healthLists.none')}
        </AppText>
      )}

      {suggestions.length ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="textMuted">
            {t('healthLists.suggested')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {suggestions.slice(0, 8).map((s) => (
              <Pressable
                key={s}
                onPress={() => onAdd(s)}
                accessibilityRole="button"
                accessibilityLabel={t('healthLists.addItem', { item: s })}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  minHeight: 34,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.primarySoft : colors.surface,
                })}
              >
                <Icon name="add" size={12} color={colors.primary} />
                <AppText variant="callout">{s}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t(`${k}.placeholder`)}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={submit}
          returnKeyType="done"
          submitBehavior="submit"
          accessibilityLabel={t(`${k}.title`)}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[
            typography.body,
            {
              flex: 1,
              minHeight: 44,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              color: colors.text,
            },
          ]}
        />
        <Pressable
          onPress={submit}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel={t('common.add')}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            opacity: draft.trim() ? 1 : 0.35,
          }}
        >
          <Icon name="add" color={colors.onPrimary} />
        </Pressable>
      </View>
    </Card>
  );
}
