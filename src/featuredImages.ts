import type { ImageSourcePropType } from 'react-native';

import type { StudioToolId } from './ai/studio';

/** Before / after artwork for the featured tool cards (cut from the design mockup; the ‹› handle is part of the image). */
export const featuredImages: Record<StudioToolId, ImageSourcePropType> = {
  restore: require('../assets/images/featured/restore.jpg'),
  style: require('../assets/images/featured/style.jpg'),
  product: require('../assets/images/featured/product.jpg'),
  logo: require('../assets/images/featured/logo.jpg'),
};

/** CamIA Filters: one photo, before | after (the ‹› handle is part of the image). */
export const filtersArt: ImageSourcePropType = require('../assets/images/featured/filters.jpg');

/** Width / height of the artwork. */
export const FEATURED_ASPECT = 262 / 167;
