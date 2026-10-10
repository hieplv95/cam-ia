/** Shared between the app and the API route (prompts). Labels are translations: aiPreset.<id>. */
export const aiPresets = [
  {
    id: 'cartoon3d',
    emoji: '🧸',
    prompt:
      'Transform this photo into a cute 3D animated movie style illustration with soft lighting, smooth shapes and vibrant colors. Keep the same people, poses, clothing, composition and background layout, and keep faces recognizable.',
  },
  {
    id: 'coloring',
    emoji: '🖍️',
    prompt:
      "Convert this photo into a black-and-white children's coloring book page: clean, bold black outlines on a pure white background, no shading, no gray, no color. Simplify small details so a young child can color it in.",
  },
  {
    id: 'watercolor',
    emoji: '💧',
    prompt:
      'Repaint this photo as a soft, dreamy watercolor painting with gentle pastel colors and visible paper texture. Keep the same subjects and composition.',
  },
  {
    id: 'anime',
    emoji: '🌸',
    prompt:
      'Redraw this photo as a hand-drawn anime illustration with clean line art, soft cel shading and a bright, cheerful color palette. Keep the same people, poses and composition.',
  },
  {
    id: 'beach',
    emoji: '🏖️',
    prompt:
      'Keep the people and main subject exactly as they are and replace only the background with a sunny tropical beach with turquoise water, white sand and palm trees. Match the lighting naturally.',
  },
  {
    id: 'space',
    emoji: '🚀',
    prompt:
      'Keep the people and main subject exactly as they are and replace only the background with a colorful, friendly outer space scene with planets, stars and a glowing nebula. Match the lighting naturally.',
  },
  {
    id: 'castle',
    emoji: '🏰',
    prompt:
      'Keep the people and main subject exactly as they are and replace only the background with a magical fairytale castle on a hill with pink and purple sunset sky. Match the lighting naturally.',
  },
  {
    id: 'snow',
    emoji: '❄️',
    prompt: 'Add gentle falling snowflakes and a light dusting of snow to this scene, making it feel like a cozy winter day. Do not change the people.',
  },
  {
    id: 'wings',
    emoji: '🧚',
    prompt:
      'Add a pair of sparkly, translucent fairy wings behind the main person in this photo, with a few tiny magical sparkles around them. Do not change their face or clothing.',
  },
  {
    id: 'enhance',
    emoji: '✨',
    prompt:
      'Improve the quality of this photo: fix exposure and white balance, reduce noise and blur, and make colors natural and vivid. Do not change faces, body shapes or content.',
  },
  {
    id: 'erase',
    emoji: '🧹',
    prompt:
      'Remove distracting objects, clutter and strangers from the background of this photo, filling the removed areas naturally. Keep the main subject exactly as it is.',
  },
  {
    id: 'retouch',
    emoji: '💫',
    // Deliberately gentle: no slimming, skin whitening or face reshaping.
    prompt:
      'Gently retouch this portrait: even out the lighting on faces, remove red-eye, small blemishes and stray hairs, and add a soft natural glow. Keep natural skin texture, skin tone, face shape, body shape and age exactly as they are.',
  },
  {
    id: 'expand',
    emoji: '🖼️',
    // The app pads the photo with white borders before sending it (see EXPAND_PADDING).
    prompt:
      'This photo has empty white borders around it. Fill the white border area by naturally extending the scene outward, matching the content, perspective, lighting and style seamlessly. Do not change anything in the original center area.',
  },
  {
    id: 'whitebg',
    emoji: '🤍',
    prompt: 'Keep the main subject exactly as it is and replace the entire background with a clean, plain pure white background.',
  },
] as const;

export type AiPresetId = (typeof aiPresets)[number]['id'];
