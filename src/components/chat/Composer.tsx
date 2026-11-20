import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MessageAttachment } from '@/db/repositories/conversationRepository';
import { clipboardHasImage } from '@/records/importReport';
import type { VoiceError } from '@/voice/useVoiceInput';
import { haptic } from '@/lib/haptics';
import { MAX_FONT_SCALE, useTheme } from '@/theme';

import { AppText } from '../AppText';
import { Icon } from '../Icon';
import { AttachmentChip } from './AttachmentChip';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  attachments: MessageAttachment[];
  onAttach: () => void;
  onRemoveAttachment: (reportId: string) => void;
  /**
   * Incolla la foto copiata come allegato: con l'immagine già letta (pulsante di Apple) o, senza
   * argomento, leggendola dagli appunti.
   */
  onPasteImage?: (dataUri?: string) => void;
  /** Conversazione a voce (tipo ChatGPT): se assente, il pulsante non compare. */
  onVoiceMode?: () => void;
  voice: {
    listening: boolean;
    transcript: string;
    error: VoiceError | null;
    start: () => void;
    stop: () => void;
  };
}

/** Su iOS 16+ c'è il pulsante "Incolla" di sistema (UIPasteControl). */
const APPLE_PASTE = Platform.OS === 'ios' && Clipboard.isPasteButtonAvailable;

/** Campo di scrittura con microfono: se il campo è vuoto, il pulsante principale è "Parla". */
export function Composer({
  onSend,
  disabled,
  voice,
  attachments,
  onAttach,
  onRemoveAttachment,
  onPasteImage,
  onVoiceMode,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography } = useTheme();
  const [text, setText] = useState('');
  // Il campo di testo accetta solo testo (anche il suggerimento "incolla" della tastiera non porta
  // le foto): una foto copiata si incolla con il pulsante sopra il campo. Compare quando il campo
  // è attivo e negli appunti c'è un'immagine, e si ricontrolla quando gli appunti cambiano o si
  // torna nell'app (prima solo al tocco del campo: dalla seconda foto non ricompariva).
  const [canPaste, setCanPaste] = useState(false);
  const focused = useRef(false);
  const pasteEnabled = !!onPasteImage;
  const checkClipboard = useCallback(() => {
    if (!pasteEnabled || !focused.current) return;
    void clipboardHasImage().then(setCanPaste);
  }, [pasteEnabled]);
  useEffect(() => {
    const sub = Clipboard.addClipboardListener(checkClipboard);
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkClipboard();
    });
    return () => {
      sub.remove();
      app.remove();
    };
  }, [checkClipboard]);
  const paste = () => {
    haptic.tap();
    setCanPaste(false);
    onPasteImage?.();
  };
  const canSend = !disabled && (text.trim().length > 0 || attachments.length > 0);
  const showMic = !text.trim() && !attachments.length;

  const send = () => {
    if (!canSend) return;
    haptic.tap();
    onSend(text.trim());
    setText('');
  };

  const round = (pressed: boolean, bg: string, enabled: boolean) => ({
    height: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: bg,
    opacity: !enabled ? 0.4 : pressed ? 0.8 : 1,
  });

  if (voice.listening) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}
        accessibilityLiveRegion="polite"
      >
        <View
          style={{
            flex: 1,
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: spacing.md,
          }}
        >
          <AppText variant="caption" tone="primary" style={{ fontWeight: '600' }}>
            {t('voice.listening')}
          </AppText>
          <AppText numberOfLines={3}>{voice.transcript || '…'}</AppText>
        </View>
        <Pressable
          onPress={() => {
            haptic.tap();
            voice.stop();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('voice.stop')}
          style={({ pressed }) => round(pressed, colors.danger, true)}
        >
          <Icon name="stop" color={colors.background} />
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      {voice.error ? (
        <AppText
          variant="caption"
          tone="danger"
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}
        >
          {t(`voice.errors.${voice.error}`)}
        </AppText>
      ) : null}
      {canPaste ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.sm,
            paddingTop: spacing.sm,
          }}
        >
          {APPLE_PASTE ? (
            <>
              <AppText variant="callout" tone="textMuted">
                {t('chat.copiedImage')}
              </AppText>
              {/* Pulsante "Incolla" di Apple: non chiede il permesso e non può essere negato. */}
              <Clipboard.ClipboardPasteButton
                acceptedContentTypes={['image']}
                imageOptions={{ format: 'jpeg', jpegQuality: 0.85 }}
                backgroundColor={colors.primary}
                foregroundColor={colors.onPrimary}
                displayMode="iconAndLabel"
                style={{ width: 120, height: 36 }}
                onPress={(data) => {
                  if (data.type !== 'image') return;
                  haptic.tap();
                  setCanPaste(false);
                  onPasteImage?.(data.data);
                }}
              />
            </>
          ) : (
            <Pressable
              onPress={paste}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                minHeight: 36,
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                backgroundColor: colors.primarySoft,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon name="copy" size={14} color={colors.primary} />
              <AppText variant="callout" tone="primary" style={{ fontWeight: '600' }}>
                {t('chat.pasteImage')}
              </AppText>
            </Pressable>
          )}
        </View>
      ) : null}
      {attachments.length ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingTop: spacing.sm,
          }}
        >
          {attachments.map((a) => (
            <AttachmentChip
              key={a.reportId}
              attachment={a}
              onRemove={() => onRemoveAttachment(a.reportId)}
            />
          ))}
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          padding: spacing.sm,
        }}
      >
        <Pressable
          onPress={() => {
            haptic.tap();
            onAttach();
          }}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={t('chat.attach')}
          accessibilityHint={t('chat.attachHint')}
          hitSlop={4}
          style={({ pressed }) => ({
            ...round(pressed, colors.surface, !disabled),
            paddingHorizontal: 0,
            width: 44,
            borderWidth: 1,
            borderColor: colors.border,
          })}
        >
          <Icon name="add" color={colors.primary} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => {
            focused.current = true;
            checkClipboard();
          }}
          onBlur={() => {
            focused.current = false;
          }}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('chat.placeholder')}
          multiline
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[
            typography.body,
            {
              flex: 1,
              maxHeight: 140,
              minHeight: 44,
              color: colors.text,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
              paddingTop: 11,
              paddingBottom: 11,
            },
          ]}
        />
        {showMic && onVoiceMode ? (
          <Pressable
            onPress={() => {
              haptic.press();
              onVoiceMode();
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('voiceMode.open')}
            accessibilityHint={t('voiceMode.openHint')}
            style={({ pressed }) => ({
              ...round(pressed, colors.surface, !disabled),
              paddingHorizontal: 0,
              width: 44,
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            <Icon name="waveform" color={colors.primary} />
          </Pressable>
        ) : null}
        {showMic ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              voice.start();
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('voice.talk')}
            accessibilityHint={t('voice.talkHint')}
            accessibilityState={{ disabled }}
            style={({ pressed }) => round(pressed, colors.primary, !disabled)}
          >
            <Icon name="mic" color={colors.onPrimary} />
          </Pressable>
        ) : (
          <Pressable
            onPress={send}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
            accessibilityState={{ disabled: !canSend }}
            style={({ pressed }) => round(pressed, colors.primary, canSend)}
          >
            <AppText variant="headline" tone="onPrimary">
              {t('chat.send')}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}
