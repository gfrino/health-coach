import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Screen } from '@/components';
import { HealthListsEditor } from '@/forms/HealthListsEditor';
import { useProfileForm } from '@/forms/ProfileForm';
import { haptic } from '@/lib/haptics';
import { pickProfilePhoto, removeProfilePhoto, useProfilePhoto } from '@/profile/photo';
import { ProfileAvatar } from '@/profile/ProfileAvatar';
import { useTheme } from '@/theme';

/** Il mio profilo: prima voce del menu laterale, con la foto e gli stessi dati dell'onboarding. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const form = useProfileForm();
  const hasPhoto = useProfilePhoto((s) => s.uri !== null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (e) {
      Alert.alert(
        t('profileSettings.photoTitle'),
        e instanceof Error && e.message === 'permission_denied'
          ? t('records.cameraDenied')
          : t('errors.generic'),
      );
    }
  };
  const changePhoto = () => {
    haptic.tap();
    Alert.alert(t('profileSettings.photoTitle'), undefined, [
      { text: t('records.fromCamera'), onPress: () => void run(() => pickProfilePhoto('camera')) },
      { text: t('records.fromPhotos'), onPress: () => void run(() => pickProfilePhoto('library')) },
      ...(hasPhoto
        ? [
            {
              text: t('profileSettings.photoRemove'),
              style: 'destructive' as const,
              onPress: () => void run(removeProfilePhoto),
            },
          ]
        : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('profileSettings.title') }} />
      <Screen
        menu
        title={t('profileSettings.title')}
        footer={
          form.ready ? (
            <Button
              label={saved ? t('profileSettings.saved') : t('common.save')}
              icon={saved ? 'check' : undefined}
              onPress={async () => {
                await form.save();
                haptic.success();
                setSaved(true);
              }}
            />
          ) : undefined
        }
      >
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Pressable
            onPress={changePhoto}
            accessibilityRole="button"
            accessibilityLabel={t(
              hasPhoto ? 'profileSettings.photoChange' : 'profileSettings.photoAdd',
            )}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <ProfileAvatar size={112} />
          </Pressable>
          <Pressable onPress={changePhoto} accessibilityRole="button" hitSlop={8}>
            <AppText variant="callout" tone="primary" style={{ fontWeight: '600' }}>
              {t(hasPhoto ? 'profileSettings.photoChange' : 'profileSettings.photoAdd')}
            </AppText>
          </Pressable>
        </View>
        {form.ready ? (
          <>
            {form.fields}
            <AppText variant="title">{t('profileSettings.healthTitle')}</AppText>
            <HealthListsEditor />
          </>
        ) : null}
      </Screen>
    </>
  );
}
