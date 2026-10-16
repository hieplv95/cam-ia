/**
 * AI video (Gemini Omni) on /video: made from the user's own description, optionally starting from a photo.
 * Shared by the page and the API route; the server builds the English instruction here.
 */

export const MAX_VIDEO_PROMPT = 2000;

/**
 * One generation is one clip of at most CLIP_SECONDS; 20 and 30 seconds are made of 2 or 3 clips made at the same
 * time and joined on the server (src/server/videoJoin.ts). Each clip counts as one video (free tries, points).
 */
export const VIDEO_SECONDS = [5, 8, 10, 20, 30] as const;
export const CLIP_SECONDS = 10;
export const clipsFor = (seconds: number) => Math.max(1, Math.ceil(seconds / CLIP_SECONDS));
export type VideoSeconds = (typeof VIDEO_SECONDS)[number];
export const DEFAULT_VIDEO_SECONDS: VideoSeconds = 10;
export const cleanSeconds = (v: unknown): VideoSeconds => ((VIDEO_SECONDS as readonly unknown[]).includes(v) ? (v as VideoSeconds) : DEFAULT_VIDEO_SECONDS);

/**
 * The instruction sent to the video model for one clip. `part`: which clip of a longer video this is (0-based);
 * every clip gets the whole description and is told which part of it to show, so the joined video looks continuous.
 */
export function videoPrompt(description: string, opts: { hasImage: boolean; music: boolean; seconds?: VideoSeconds; part?: { index: number; count: number } }) {
  const part = opts.part && opts.part.count > 1 ? opts.part : null;
  const seconds = part ? CLIP_SECONDS : (opts.seconds ?? DEFAULT_VIDEO_SECONDS);
  const which = !part ? '' : part.index === 0 ? 'the beginning' : part.index === part.count - 1 ? 'the ending' : 'the middle part';
  return [
    `Vertical 9:16 video, ${seconds} seconds long.`,
    part
      ? `This is clip ${part.index + 1} of ${part.count} of one continuous ${part.count * CLIP_SECONDS}-second video that will be joined together: ` +
        `show ${which} of the description below, and keep exactly the same characters, outfits, place, light and camera style as the other clips.` +
        (part.index > 0 ? ' Start right where the previous clip ends, with no intro.' : '')
      : '',
    opts.hasImage ? 'Start from the attached photo: keep its subjects, their look and the place exactly as they appear in it.' : '',
    `The user's description of the video (may be in any language; follow it closely): "${description.trim()}".`,
    'Unless the description says otherwise: photorealistic, sharp, natural light.',
    opts.music ? 'Audio: fitting background music, unless the description asks for something else.' : 'Audio: no music, only natural sounds.',
    'No captions or watermark unless asked. Friendly and wholesome.',
  ]
    .filter(Boolean)
    .join(' ');
}
