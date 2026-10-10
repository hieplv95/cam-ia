import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { AiPresetId } from './ai/presets';
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
