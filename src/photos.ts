import { Image, type ImageSourcePropType } from 'react-native';

/**
 * Showcase photos for the home screen, presets and AI tool cards.
 * - Models: three AI-made portraits shipped with the app (assets/images/models), cropped to face and shoulders so
 *   the store listing stays "Everyone".
 * - Scenes: hotlinked from Unsplash (free Unsplash License). Swap the ids here to change them; put files in assets/
 *   instead if the app must work offline.
 */
const scenes = {
  cinematic: { id: '1681296115470-cafb5874604d', author: 'Matic' },
  vintage: { id: '1761817872729-dd5a27683b00', author: 'Aaron Moncy' },
  coast: { id: '1765572444409-446c0b1d7792', author: 'Elijah Cobb' },
  dog: { id: '1599692392256-2d084495fe15', author: 'Jesse Collins' },
  lake: { id: '1597668318733-444fd1b062e1', author: 'Annika' },
  hat: { id: '1669999763559-a29a18783a17', author: 'Evgeniy Kozlov' },
  plant: { id: '1599791641365-18738b8ffb25', author: 'Suri Huang' },
  coffee: { id: '1634465474088-e82e29b64ecc', author: 'Daniel Seßler' },
  cartagena: { id: '1692839685082-c66d810f0a21', author: 'Delfina Iacub' },
  havana: { id: '1530779189757-4a7734852dfd', author: 'Stéphan Valentin' },
  copacabana: { id: '1674732259736-85750e340b21', author: 'Alev Takil' },
  patagonia: { id: '1546569397-ab326af881f5', author: 'Samuel Chenard' },
  tulum: { id: '1605216663800-d563ef404eef', author: 'Anna Sullivan' },
} as const;

/** 3:2 crops, 600–800 px wide. */
const models = {
  modelVanity: require('../assets/images/models/vanity.jpg'),
  modelPeace: require('../assets/images/models/peace.jpg'),
  modelWhite: require('../assets/images/models/white.jpg'),
  // The Retouch looks (Natural, Sang chảnh, Latina glam, Hàn Quốc, Selfie sáng da): 176 px face squares.
  lookNatural: require('../assets/images/looks/natural.jpg'),
  lookLuxe: require('../assets/images/looks/luxe.jpg'),
  lookLatina: require('../assets/images/looks/latina.jpg'),
  lookKorean: require('../assets/images/looks/korean.jpg'),
  lookBright: require('../assets/images/looks/bright.jpg'),
} as const;

export type ScenePhotoKey = keyof typeof scenes;
export type PhotoKey = ScenePhotoKey | keyof typeof models;

const isModel = (key: PhotoKey): key is keyof typeof models => key in models;

/** Unsplash URL of a scene at `width` px, cropped to `height` when given. */
export const photoUrl = (key: ScenePhotoKey, width = 800, height?: number) =>
  `https://images.unsplash.com/photo-${scenes[key].id}?w=${width}${height ? `&h=${height}` : ''}&q=80&auto=format&fit=crop`;

/** <Image> source for any showcase photo: the bundled file for a model, a sized Unsplash URL for a scene. */
export const photoImage = (key: PhotoKey, width = 800, height?: number): ImageSourcePropType =>
  isModel(key) ? models[key] : { uri: photoUrl(key, width, height) };

/** URI of a bundled image: the web build gives `{ uri }`, native builds an asset id. */
const bundledUri = (asset: ImageSourcePropType): string =>
  typeof asset === 'object' && asset !== null && 'uri' in asset && typeof asset.uri === 'string' ? asset.uri : Image.resolveAssetSource(asset as number).uri;

/** URI Skia can load (Skia.Data.fromURI) for any showcase photo. */
export const photoData = (key: PhotoKey, width = 800) => (isModel(key) ? bundledUri(models[key]) : photoUrl(key, width));

/** Sample photos the user can open and play with before they have their own projects. */
export const samplePhotos: ScenePhotoKey[] = ['coast', 'dog', 'lake', 'hat', 'plant'];

/** Unsplash photographers to credit (the bundled models need no credit). */
export const photoAuthors = [...new Set(Object.values(scenes).map((p) => p.author))];
