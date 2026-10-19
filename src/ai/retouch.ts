/**
 * Retouch tools and one-tap beauty styles, shared by the Retouch screen, the editor's AI beauty tab and the API
 * route (prompts). Labels are translations: retouch.<id> and retouch.style.<id>.
 * Face and body reshaping (slimmer face, bigger eyes, slimmer waist, longer legs) are only done when picked here.
 */
export const retouchOptions = [
  {
    id: 'skin',
    prompt: 'smooth the skin naturally by reducing blemishes, acne, redness and uneven texture while keeping realistic pores and skin texture',
  },
  {
    id: 'slimface',
    prompt: 'make the face slimmer with a more defined jawline and cheekbones, keeping it clearly the same person',
    reshapes: 'face',
  },
  {
    id: 'bigeyes',
    prompt: 'make the eyes a little bigger and brighter, keeping them natural and symmetrical',
    reshapes: 'face',
  },
  {
    id: 'teeth',
    prompt: 'whiten visible teeth naturally (a natural white, never pure white)',
  },
  {
    id: 'lips',
    prompt: 'add an even, natural lipstick color to the lips (soft rosy nude) with a light healthy shine',
  },
  {
    id: 'waist',
    prompt: 'make the waist slimmer and more defined with natural body proportions, without bending the background or the clothes',
    reshapes: 'body',
  },
  {
    id: 'legs',
    prompt: 'make the legs look longer and slimmer with natural proportions, without bending the background',
    reshapes: 'body',
  },
  {
    id: 'acne',
    prompt: 'remove acne, pimples, spots and small scars while keeping natural skin texture',
  },
  {
    id: 'face',
    prompt: 'subtly enhance the face with balanced, flattering light and clearer, brighter eyes for a fresh, healthy look',
  },
  {
    id: 'eyes',
    prompt: 'reduce dark circles and puffiness under the eyes',
  },
  {
    id: 'light',
    prompt: 'brighten the face and the overall exposure with soft, warm, natural light',
  },
] as const;

export type RetouchOptionId = (typeof retouchOptions)[number]['id'];

export const isRetouchOption = (v: unknown): v is RetouchOptionId => retouchOptions.some((o) => o.id === v);

/** One-tap looks shown above the tools; at most one at a time. */
export const retouchStyles = [
  { id: 'natural', photo: 'lookNatural', prompt: 'a natural, fresh look with minimal, invisible retouching' },
  {
    id: 'luxe',
    photo: 'lookLuxe',
    prompt: 'a glamorous, luxurious editorial look: polished flawless skin, soft studio light, defined makeup and elegant warm tones',
  },
  {
    id: 'latina',
    photo: 'lookLatina',
    prompt: 'a Latina glam look: warm golden-bronze glow, defined brows and lashes, glossy lips and radiant sun-kissed skin',
  },
  {
    id: 'korean',
    photo: 'lookKorean',
    prompt: 'a Korean beauty look: clear luminous glass skin, soft gradient lips, bright airy light and a gentle fresh look',
  },
  {
    id: 'bright',
    photo: 'lookBright',
    prompt: 'a bright selfie look: brighter, luminous, glowing skin and a clean bright exposure',
    lightens: true,
  },
] as const;

export type RetouchStyleId = (typeof retouchStyles)[number]['id'];

export const isRetouchStyle = (v: unknown): v is RetouchStyleId => retouchStyles.some((s) => s.id === v);

export function retouchPrompt(ids: RetouchOptionId[], style?: RetouchStyleId) {
  const picked = retouchOptions.filter((o) => ids.includes(o.id));
  const look = retouchStyles.find((s) => s.id === style);
  const steps = picked.map((o) => `- ${o.prompt}`);
  if (look) steps.unshift(`- give the portrait ${look.prompt}`);
  const reshapes = (part: 'face' | 'body') => picked.some((o) => 'reshapes' in o && o.reshapes === part);
  const keep = [
    'the identity',
    'the age',
    ...(reshapes('face') ? [] : ['the face shape']),
    ...(reshapes('body') ? [] : ['the body shape']),
    ...(look && 'lightens' in look ? [] : ['the skin tone']),
    'the hairstyle',
    'the clothing',
    'the background',
    'the framing',
  ];
  return (
    'Professionally retouch this portrait photo:\n' +
    steps.join('\n') +
    `\nKeep ${keep.join(', ')} exactly the same. ` +
    (reshapes('face') || reshapes('body')
      ? 'Only reshape people who clearly look like adults; never change the face or body shape of anyone who may be under 18. '
      : '') +
    'Never make the result sexual or more revealing. The result must stay a natural, photorealistic photo.'
  );
}
