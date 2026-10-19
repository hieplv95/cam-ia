import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { AiPresetId } from './ai/presets';
import type { RetouchOptionId } from './ai/retouch';
import { t, type MessageKey } from './i18n';

type IonName = ComponentProps<typeof Ionicons>['name'];
type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type IconSpec = { set: 'ion'; name: IonName } | { set: 'mci'; name: MciName };

export function Icon({ icon, size = 22, color }: { icon: IconSpec; size?: number; color: string }) {
  return icon.set === 'ion' ? (
    <Ionicons name={icon.name} size={size} color={color} />
  ) : (
    <MaterialCommunityIcons name={icon.name} size={size} color={color} />
  );
}

/** Retouch tools (Retouch screen and the editor's AI beauty tab). */
export const retouchIcons: Record<RetouchOptionId, IconSpec> = {
  skin: { set: 'ion', name: 'water-outline' },
  slimface: { set: 'mci', name: 'face-recognition' },
  bigeyes: { set: 'mci', name: 'eye-plus-outline' },
  teeth: { set: 'mci', name: 'tooth-outline' },
  lips: { set: 'mci', name: 'lipstick' },
  waist: { set: 'mci', name: 'human-female' },
  legs: { set: 'mci', name: 'human-female-dance' },
  acne: { set: 'mci', name: 'auto-fix' },
  nose: { set: 'mci', name: 'face-woman-profile' },
  eyes: { set: 'ion', name: 'eye-outline' },
  light: { set: 'ion', name: 'sunny-outline' },
};

export const aiPresetIcons: Record<AiPresetId, IconSpec> = {
  enhance: { set: 'ion', name: 'sparkles-outline' },
  erase: { set: 'mci', name: 'eraser' },
  whitebg: { set: 'mci', name: 'checkerboard' },
  cartoon3d: { set: 'ion', name: 'happy-outline' },
  retouch: { set: 'mci', name: 'face-woman-shimmer-outline' },
  expand: { set: 'mci', name: 'arrow-expand-all' },
  coloring: { set: 'mci', name: 'palette-outline' },
  watercolor: { set: 'mci', name: 'water-outline' },
  anime: { set: 'mci', name: 'flower-outline' },
  beach: { set: 'mci', name: 'beach' },
  space: { set: 'ion', name: 'rocket-outline' },
  castle: { set: 'mci', name: 'castle' },
  snow: { set: 'ion', name: 'snow-outline' },
  wings: { set: 'mci', name: 'butterfly-outline' },
};

/** Name and one-line description of an AI effect, in the app's language. */
export const aiPresetLabel = (id: AiPresetId) => t(`aiPreset.${id}` as MessageKey);
export const aiPresetDescription = (id: AiPresetId) => t(`aiPresetDesc.${id}` as MessageKey);
