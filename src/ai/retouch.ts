/** Retouch tools, shared by the Retouch screen and the API route (prompts). Labels are translations: retouch.<id>. */
export const retouchOptions = [
  {
    id: 'face',
    prompt: 'subtly enhance the face with balanced, flattering light and clearer, brighter eyes for a fresh, healthy look',
  },
  {
    id: 'skin',
    prompt: 'smooth the skin naturally by reducing blemishes, acne, redness and uneven texture while keeping realistic pores and skin texture',
  },
  {
    id: 'teeth',
    prompt: 'whiten visible teeth naturally (a natural white, never pure white)',
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

export function retouchPrompt(ids: RetouchOptionId[]) {
  const steps = retouchOptions.filter((o) => ids.includes(o.id)).map((o) => `- ${o.prompt}`);
  return (
    'Professionally retouch this portrait photo:\n' +
    steps.join('\n') +
    '\nKeep the identity, face shape, body shape, age, skin tone, hairstyle, clothing, background and framing exactly the same. ' +
    'The result must stay a natural, photorealistic photo.'
  );
}
