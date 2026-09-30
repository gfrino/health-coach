import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { MessageAttachment } from '@/db/repositories/conversationRepository';
import { useTheme } from '@/theme';

import { AppText } from '../AppText';
import { Icon } from '../Icon';

const iconFor = (mime: string) =>
  mime === 'application/pdf' ? 'pdf' : mime.startsWith('image/') ? 'photo' : 'document';

/** Allegato in chat: si apre nella Cartella salute; nel composer si può rimuovere. */
export function AttachmentChip({
  attachment,
  onPress,
  onRemove,
  onPrimary,
}: {
  attachment: MessageAttachment;
  onPress?: () => void;
  onRemove?: () => void;
  /** Dentro la bolla dell'utente (sfondo colorato). */
  onPrimary?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const fg = onPrimary ? colors.onPrimary : colors.primary;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        maxWidth: 240,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: onPrimary ? colors.onPrimary : colors.border,
        backgroundColor: onPrimary ? 'transparent' : colors.surface,
        paddingLeft: spacing.sm,
        paddingRight: onRemove ? 0 : spacing.sm,
        minHeight: 36,
      }}
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={t('chat.attachmentA11y', { name: attachment.title })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}
      >
        <Icon name={iconFor(attachment.mimeType)} size={16} color={fg} />
        <AppText
          variant="caption"
          tone={onPrimary ? 'onPrimary' : 'text'}
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {attachment.title}
        </AppText>
      </Pressable>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('chat.removeAttachment', { name: attachment.title })}
          hitSlop={6}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
