/** Light "ivory" theme: warm cream background, white cards with soft shadows, bronze-gold accent. */
export const colors = {
  bg: '#FAF6F0',
  surface: '#FFFFFF',
  surface2: '#F5EFE6',
  border: '#ECE3D6',
  gold: '#B98A4E',
  goldDeep: '#9C7038',
  goldSoft: 'rgba(185,138,78,0.12)',
  /** Text on the light champagne gold buttons. */
  onGold: '#3A2A17',
  text: '#2A2018',
  textSoft: '#7D7064',
  textMute: '#A99D90',
  danger: '#E5484D',
};

/** Light champagne buttons ("Chỉnh ngay", "Lưu"…), dark text on top. */
export const goldGradient = ['#F1DFBE', '#D9B27C'] as const;
/** Deeper bronze for small badges with white text (PRO). */
export const bronzeGradient = ['#C9A06A', '#A27440'] as const;

/** Soft warm shadow for white cards. */
export const cardShadow = {
  shadowColor: '#8B6A3E',
  shadowOpacity: 0.1,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

export const font = {
  serif: 'PlayfairDisplay_600SemiBold',
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semi: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
};

/** Palette used by text, drawing, and pen tools. */
export const paintColors = [
  '#FF5FA2',
  '#FF3B3B',
  '#FF9F1C',
  '#FFD60A',
  '#3CCFB4',
  '#4DB5FF',
  '#8B6CF6',
  '#FFFFFF',
  '#1A1A1A',
];

/** Content column width on tablets and desktop web. */
export const MAX_CONTENT_WIDTH = 720;
