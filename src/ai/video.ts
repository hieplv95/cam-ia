/**
 * AI video (Gemini Omni) on /video. Shared by the page and the API route: the page sends a template id,
 * the server builds the English instruction here. Template names are translated (video.t.<id>).
 */

export const MAX_VIDEO_EXTRA = 2000;

/**
 * One generation is one clip of at most CLIP_SECONDS; 20 and 30 seconds are made of 2 or 3 clips made at the same
 * time and joined on the server (src/server/videoJoin.ts). Each clip counts as one video (free tries, points).
 */
export const VIDEO_SECONDS = [5, 8, 10, 20, 30] as const;
export const CLIP_SECONDS = 10;
export const clipsFor = (seconds: number) => Math.max(1, Math.ceil(seconds / CLIP_SECONDS));
export type VideoSeconds = (typeof VIDEO_SECONDS)[number];
export const DEFAULT_VIDEO_SECONDS: VideoSeconds = 10;
export const cleanSeconds = (v: unknown): VideoSeconds => (VIDEO_SECONDS as readonly unknown[]).includes(v) ? (v as VideoSeconds) : DEFAULT_VIDEO_SECONDS;

/** The templates' scene timings are written for 10 seconds; shorter videos get them scaled down. */
const scaleShots = (shots: string, seconds: number) =>
  seconds === 10 ? shots : shots.replace(/\((\d+)-(\d+)s\)/g, (_, a, b) => `(${Math.round((a * seconds) / 10)}-${Math.round((b * seconds) / 10)}s)`);

export type VideoTemplate = {
  id: string;
  /** The scenes, written for the animals of the photo (or two cats when there is no photo). */
  shots: string;
};

export const videoTemplates: VideoTemplate[] = [
  {
    id: 'dance',
    shots:
      'Shot 1 (0-2s): close-up, the first one throws both front paws up and shouts with its mouth wide open. ' +
      'Shot 2 (2-4s): close-up, the second one grabs its head with both paws, shocked face, mouth open. ' +
      'Shot 3 (4-7s): wide shot, both dance side by side in sync, waving their paws left and right and hopping to the beat. ' +
      'Shot 4 (7-10s): both run to the camera and hug it like a selfie, faces squished against the lens.',
  },
  {
    id: 'surprised',
    shots:
      'Shot 1 (0-3s): medium shot, they stand still looking at the camera. ' +
      'Shot 2 (3-6s): sudden close-up, they grab their heads with both paws, eyes wide, mouths open in shock. ' +
      'Shot 3 (6-10s): they look at each other, then back at the camera, and shake their heads in disbelief.',
  },
  {
    id: 'selfie',
    shots:
      'Shot 1 (0-4s): wide shot, they notice the camera and run toward it on their hind legs. ' +
      'Shot 2 (4-10s): they grab the camera like a selfie, faces very close to the lens, cheeks squished, then hug each other happily.',
  },
  {
    id: 'walk',
    shots:
      'Shot 1 (0-5s): low-angle shot, they walk toward the camera on their hind legs like fashion models on a runway, confident steps. ' +
      'Shot 2 (5-10s): they stop, pose with one paw on the hip, turn their heads to the camera with a cool look.',
  },
  { id: 'custom', shots: '' },
];

export const videoTemplate = (id: unknown) => videoTemplates.find((t) => t.id === id);

/** The instruction sent to the video model. */
/** What each later clip of a 20 / 30 second template video shows (the first clip plays the template's own scenes). */
const NEXT_PARTS = [
  'They keep going with new funny moves: a spin, a jump, a dramatic pose, reacting to each other and to the camera.',
  'Grand finale: they do their best move together, then end close to the camera with big happy expressions.',
];

/**
 * The instruction sent to the video model for one clip. `part`: which clip of a longer video this is (0-based);
 * every clip describes the same characters and place so the joined video looks continuous.
 */
export function videoPrompt(
  template: VideoTemplate,
  opts: { hasImage: boolean; extra?: string; music: boolean; seconds?: VideoSeconds; part?: { index: number; count: number } },
) {
  const extra = opts.extra?.trim();
  const part = opts.part && opts.part.count > 1 ? opts.part : null;
  const seconds = part ? CLIP_SECONDS : (opts.seconds ?? DEFAULT_VIDEO_SECONDS);
  const custom = !template.shots;
  const subject = opts.hasImage
    ? 'Animate the animal or animals from the attached photo as the stars of the video. Keep exactly their look: species, breed, fur colors and markings, eye color and size. ' +
      'If the photo shows only one animal, it is the only star.'
    : // Their own description says who is in it.
      custom
      ? ''
      : 'Two fluffy cats, one orange-and-white and one grey British shorthair.';
  const story = !template.shots ? '' : !part || part.index === 0 ? scaleShots(template.shots, seconds) : NEXT_PARTS[Math.min(part.index - 1, NEXT_PARTS.length - 1)];
  const scenes = story ? `They stand on their hind legs like humans and act in this funny, energetic short video with fast cuts on the beat. ${story}` : '';
  const stage = !part
    ? ''
    : `This is clip ${part.index + 1} of ${part.count} of one continuous ${part.count * CLIP_SECONDS}-second video that will be joined together: ` +
      `keep exactly the same characters, outfits, place, light and camera style as the other clips` +
      (custom ? `, and show ${part.index === 0 ? 'the beginning' : part.index === part.count - 1 ? 'the ending' : 'the middle part'} of the description below.` : '.') +
      (part.index > 0 ? ' Start right where the previous clip ends, with no intro.' : '');
  return [
    `Vertical 9:16 video, ${seconds} seconds long, photorealistic, sharp, natural light.`,
    stage,
    subject,
    scenes,
    extra
      ? custom
        ? `The user's description of the video (may be in any language; follow it closely): "${extra}".`
        : `Request from the user (may be in any language; it takes priority over the scenes above): "${extra}".`
      : '',
    opts.music ? 'Audio: upbeat, catchy, funny dance music.' : 'Audio: no music, only natural sounds.',
    'No text, no captions, no watermark. Friendly and wholesome.',
  ]
    .filter(Boolean)
    .join(' ');
}
