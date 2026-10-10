/**
 * Showcase photos for the home screen and presets, hotlinked from Unsplash (free Unsplash License).
 * Swap the ids here to change them; put files in assets/ instead if the app must work offline.
 */
export const photos = {
  hero: { id: '1525198255522-d1d721e65e56', author: 'Leslie Jones' },
  heroGolden: { id: '1786520996264-557f5cce8f12', author: 'Zulfugar Karimov' },
  heroCurls: { id: '1589659058372-61dbbf1bf491', author: 'Julia Coimbra' },
  portraitSoft: { id: '1523761415282-2106778cfb5a', author: 'James Marcom' },
  portraitFlowers: { id: '1623657631441-4c6b1e347472', author: 'Ehsan ahmadnejad' },
  portraitRose: { id: '1555422550-cd4c1f2e21c0', author: 'Ali Pazani' },
  portraitDusk: { id: '1548267068-1a18bc9207c9', author: 'Chema Photo' },
  portraitShadow: { id: '1771919005587-d49d985daa0b', author: 'Leonardo Iribe' },
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

export type PhotoKey = keyof typeof photos;

export const photoUrl = (key: PhotoKey, width = 800) =>
  `https://images.unsplash.com/photo-${photos[key].id}?w=${width}&q=80&auto=format&fit=crop`;

/** Sample photos the user can open and play with before they have their own projects. */
export const samplePhotos: PhotoKey[] = ['coast', 'dog', 'lake', 'hat', 'plant'];

export const photoAuthors = [...new Set(Object.values(photos).map((p) => p.author))];
