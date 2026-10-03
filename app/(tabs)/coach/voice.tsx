import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Icon } from '@/components';
import { haptic } from '@/lib/haptics';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { useVoiceConversation } from '@/voice/useVoiceConversation';

/** Conversazione a voce a schermo intero, come la modalità vocale di ChatGPT. */
export default function VoiceScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const coachName = useSettingsStore((s) => s.settings.coach.name);
  const { c } = useLocalSearchParams<{ c: string }>();
  const v = useVoiceConversation(c ?? null, () => undefined);

  // Avvio automatico all'apertura; alla chiusura la sessione si ferma.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void v.start();
  }, [v]);

  const close = () => {
    haptic.press();
    v.stop();
    router.back();
  };

  // Orb: respira mentre ascolta, pulsa più forte mentre parla.
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const amp = v.state === 'speaking' ? 1.18 : v.state === 'listening' ? 1.07 : 1.02;
    const dur = v.state === 'speaking' ? 420 : 1300;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: amp,
          duration: dur,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: dur,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v.state, scale]);

  const status = v.error
    ? t(`ai.errors.${v.error.code}` as 'ai.errors.unknown')
    : v.tool === 'save_journal_entry'
      ? t('chat.savingJournal')
      : v.tool === 'create_program' || v.tool === 'update_program'
        ? t('chat.savingProgram')
        : v.tool
          ? t('chat.readingData')
          : v.state === 'idle' && v.voiceError
            ? t(`voice.errors.${v.voiceError}`)
            : t(`voiceMode.state.${v.state}`);

  const canTap = v.engine === 'loop' && !v.error;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}
      edges={['top', 'bottom']}
    >
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <AppText variant="headline">{coachName}</AppText>
        <AppText variant="caption" tone="textMuted" align="center">
          {v.engine === 'realtime' ? t('voiceMode.engineRealtime') : t('voiceMode.engineLoop')}
        </AppText>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl }}>
        <Pressable
          onPress={
            canTap
              ? () => {
                  haptic.tap();
                  v.tap();
                }
              : undefined
          }
          accessibilityRole={canTap ? 'button' : undefined}
          accessibilityLabel={status}
          accessibilityHint={canTap ? t('voiceMode.tapHint') : undefined}
        >
          <Animated.View
            style={{
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: v.error ? colors.dangerSoft : colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale }],
            }}
          >
            <View
              style={{
                width: 132,
                height: 132,
                borderRadius: 66,
                backgroundColor: v.error
                  ? colors.danger
                  : v.muted
                    ? colors.textMuted
                    : colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                name={v.state === 'speaking' ? 'speaker' : v.muted ? 'stop' : 'mic'}
                size={44}
                color={colors.onPrimary}
              />
            </View>
          </Animated.View>
        </Pressable>
        <AppText
          variant="headline"
          tone={v.error ? 'danger' : 'text'}
          align="center"
          accessibilityLiveRegion="polite"
        >
          {status}
        </AppText>
        <View style={{ gap: spacing.md, alignSelf: 'stretch', minHeight: 120 }}>
          {v.userText ? (
            <AppText variant="callout" tone="textMuted" align="center" numberOfLines={3}>
              “{v.userText}”
            </AppText>
          ) : null}
          {v.coachText ? (
            <AppText align="center" numberOfLines={6}>
              {v.coachText}
            </AppText>
          ) : null}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: spacing.xl,
        }}
      >
        {v.engine === 'realtime' ? (
          <Pressable
            onPress={() => {
              haptic.select();
              v.toggleMute();
            }}
            accessibilityRole="button"
            accessibilityLabel={v.muted ? t('voiceMode.unmute') : t('voiceMode.mute')}
            accessibilityState={{ selected: v.muted }}
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: v.muted ? colors.text : colors.surfaceAlt,
            }}
          >
            <Icon name="mic" color={v.muted ? colors.background : colors.text} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('voiceMode.end')}
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.danger,
          }}
        >
          <Icon name="close" color={colors.onPrimary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
