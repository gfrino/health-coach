import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/theme';

type IconName = Extract<SymbolViewProps['name'], { ios?: unknown }>;

/**
 * Icone di sistema: SF Symbols su iOS, Material Symbols su Android.
 * Decorative di default (nascoste agli screen reader): l'etichetta va sull'elemento interattivo.
 */
export const icons = {
  coach: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum' },
  today: { ios: 'heart.text.square.fill', android: 'monitor_heart' },
  journal: { ios: 'book.closed.fill', android: 'menu_book' },
  records: { ios: 'folder.fill', android: 'clinical_notes' },
  settings: { ios: 'gearshape.fill', android: 'settings' },
  steps: { ios: 'figure.walk', android: 'directions_walk' },
  flame: { ios: 'flame.fill', android: 'local_fire_department' },
  sleep: { ios: 'bed.double.fill', android: 'bedtime' },
  heart: { ios: 'heart.fill', android: 'favorite' },
  waveform: { ios: 'waveform.path.ecg', android: 'monitor_heart' },
  scale: { ios: 'scalemass.fill', android: 'monitor_weight' },
  lungs: { ios: 'lungs.fill', android: 'air' },
  workout: { ios: 'figure.run', android: 'directions_run' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh' },
  me: { ios: 'person.crop.circle.fill', android: 'account_circle' },
  mic: { ios: 'mic.fill', android: 'mic' },
  stop: { ios: 'stop.fill', android: 'stop' },
  speaker: { ios: 'speaker.wave.2.fill', android: 'volume_up' },
  add: { ios: 'plus', android: 'add' },
  pdf: { ios: 'doc.richtext', android: 'picture_as_pdf' },
  document: { ios: 'doc.text', android: 'description' },
  close: { ios: 'xmark', android: 'close' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left' },
  pill: { ios: 'pills.fill', android: 'medication' },
  leaf: { ios: 'leaf.fill', android: 'eco' },
  allergy: { ios: 'allergens', android: 'no_food' },
  condition: { ios: 'stethoscope', android: 'medical_services' },
  globe: { ios: 'globe', android: 'public' },
  mail: { ios: 'envelope', android: 'mail' },
  paperclip: { ios: 'paperclip', android: 'attach_file' },
  waveformCircle: { ios: 'waveform.circle.fill', android: 'graphic_eq' },
  photo: { ios: 'photo', android: 'image' },
  camera: { ios: 'camera.fill', android: 'photo_camera' },
  trash: { ios: 'trash', android: 'delete' },
  integrations: { ios: 'puzzlepiece.extension.fill', android: 'extension' },
  check: { ios: 'checkmark', android: 'check' },
  checkCircle: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  lock: { ios: 'lock.fill', android: 'lock' },
  shield: { ios: 'checkmark.shield.fill', android: 'health_and_safety' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  info: { ios: 'info.circle', android: 'info' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more' },
  chevronUp: { ios: 'chevron.up', android: 'expand_less' },
  server: { ios: 'xmark.icloud', android: 'cloud_off' },
  programs: { ios: 'checklist', android: 'checklist' },
  edit: { ios: 'pencil', android: 'edit' },
  circle: { ios: 'circle', android: 'radio_button_unchecked' },
  calm: { ios: 'wind', android: 'self_improvement' },
  menu: { ios: 'line.3.horizontal', android: 'menu' },
  recipes: { ios: 'fork.knife', android: 'restaurant' },
  heartOutline: { ios: 'heart', android: 'favorite_border' },
  clock: { ios: 'clock', android: 'schedule' },
  people: { ios: 'person.2', android: 'group' },
} satisfies Record<string, IconName>;

export type AppIconName = keyof typeof icons;

interface Props {
  name: AppIconName;
  size?: number;
  color?: ColorValue;
}

export function Icon({ name, size = 22, color }: Props) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={icons[name]}
      size={size}
      tintColor={color ?? colors.text}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
