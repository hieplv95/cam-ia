/**
 * AI video (Gemini Omni), being tried out on the admin page first. Shared by the admin tab and the API route:
 * the page sends a template id, the server builds the English instruction here.
 */

export const MAX_VIDEO_EXTRA = 400;

export type VideoTemplate = {
  id: string;
  /** Shown on the admin page (Vietnamese only, like the rest of it). */
  label: string;
  /** The scenes, written for the animals of the photo (or two cats when there is no photo). */
  shots: string;
};

export const videoTemplates: VideoTemplate[] = [
  {
    id: 'dance',
    label: 'Nhảy trend',
    shots:
      'Shot 1 (0-2s): close-up, the first one throws both front paws up and shouts with its mouth wide open. ' +
      'Shot 2 (2-4s): close-up, the second one grabs its head with both paws, shocked face, mouth open. ' +
      'Shot 3 (4-7s): wide shot, both dance side by side in sync, waving their paws left and right and hopping to the beat. ' +
      'Shot 4 (7-10s): both run to the camera and hug it like a selfie, faces squished against the lens.',
  },
  {
    id: 'surprised',
    label: 'Ngạc nhiên ôm đầu',
    shots:
      'Shot 1 (0-3s): medium shot, they stand still looking at the camera. ' +
      'Shot 2 (3-6s): sudden close-up, they grab their heads with both paws, eyes wide, mouths open in shock. ' +
      'Shot 3 (6-10s): they look at each other, then back at the camera, and shake their heads in disbelief.',
  },
  {
    id: 'selfie',
    label: 'Ôm camera selfie',
    shots:
      'Shot 1 (0-4s): wide shot, they notice the camera and run toward it on their hind legs. ' +
      'Shot 2 (4-10s): they grab the camera like a selfie, faces very close to the lens, cheeks squished, then hug each other happily.',
  },
  {
    id: 'walk',
    label: 'Catwalk thời trang',
    shots:
      'Shot 1 (0-5s): low-angle shot, they walk toward the camera on their hind legs like fashion models on a runway, confident steps. ' +
      'Shot 2 (5-10s): they stop, pose with one paw on the hip, turn their heads to the camera with a cool look.',
  },
  { id: 'custom', label: 'Tự mô tả', shots: '' },
];

export const videoTemplate = (id: unknown) => videoTemplates.find((t) => t.id === id);

/** The instruction sent to the video model. */
export function videoPrompt(template: VideoTemplate, opts: { hasImage: boolean; extra?: string; music: boolean }) {
  const extra = opts.extra?.trim();
  const subject = opts.hasImage
    ? 'Animate the animal or animals from the attached photo as the stars of the video. Keep exactly their look: species, breed, fur colors and markings, eye color and size. ' +
      'If the photo shows only one animal, it is the only star.'
    : 'Two fluffy cats, one orange-and-white and one grey British shorthair.';
  const scenes = template.shots
    ? `They stand on their hind legs like humans and act in this funny, energetic short video with fast cuts on the beat. ${template.shots}`
    : '';
  return [
    'Vertical 9:16 video, about 10 seconds, photorealistic, sharp, natural light.',
    subject,
    scenes,
    extra ? `Request from the user (may be in any language): "${extra}".` : '',
    opts.music ? 'Audio: upbeat, catchy, funny dance music.' : 'Audio: no music, only natural sounds.',
    'No text, no captions, no watermark. Friendly and wholesome.',
  ]
    .filter(Boolean)
    .join(' ');
}
