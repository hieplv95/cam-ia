import type { ImageSourcePropType } from 'react-native';

/**
 * Card artwork for the AI tools screen: showcase photos that hint at what each tool does (dashed object to remove,
 * blurry vs sharp halves, transparency checkerboard…). They ship as pictures (drawn by src/develop/renderThumbs.tsx),
 * so showing them costs nothing.
 */
export type IllustrationId = 'erase' | 'enhance' | 'removebg' | 'art' | 'expand' | 'generate';

export const ILLU_W = 360;
export const ILLU_H = 280;

const illustrations: Record<IllustrationId, ImageSourcePropType> = {
  erase: require('../assets/images/illustrations/erase.jpg'),
  enhance: require('../assets/images/illustrations/enhance.jpg'),
  removebg: require('../assets/images/illustrations/removebg.jpg'),
  art: require('../assets/images/illustrations/art.jpg'),
  expand: require('../assets/images/illustrations/expand.jpg'),
  generate: require('../assets/images/illustrations/generate.jpg'),
};

export const illustrationIds = Object.keys(illustrations) as IllustrationId[];

/** A tool's card artwork. */
export const useIllustration = (id: IllustrationId) => illustrations[id];
