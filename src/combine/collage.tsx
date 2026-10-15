import { Fill, Group, Image, rect, rrect, type SkImage } from '@shopify/react-native-skia';

import { MAX_SIDE, renderImage } from '../editor/imageOps';
import type { MessageKey } from '../i18n/core';

/** "Ghép khung": photos laid out side by side on a background, drawn on the device (no AI, free). */

type Cell = { x: number; y: number; w: number; h: number };

export type CollageLayoutId = 'row' | 'col' | 'left' | 'top';

/** Cells in 0..1 of the frame, one per photo (photo 1 takes the big cell). */
export const collageLayouts: { id: CollageLayoutId; label: MessageKey; cells: (n: number) => Cell[] }[] = [
  {
    id: 'row',
    label: 'combine.layout.row',
    cells: (n) => Array.from({ length: n }, (_, i) => ({ x: i / n, y: 0, w: 1 / n, h: 1 })),
  },
  {
    id: 'col',
    label: 'combine.layout.col',
    cells: (n) => Array.from({ length: n }, (_, i) => ({ x: 0, y: i / n, w: 1, h: 1 / n })),
  },
  {
    id: 'left',
    label: 'combine.layout.left',
    cells: (n) =>
      n < 3
        ? [{ x: 0, y: 0, w: 0.6, h: 1 }, { x: 0.6, y: 0, w: 0.4, h: 1 }]
        : [{ x: 0, y: 0, w: 0.6, h: 1 }, { x: 0.6, y: 0, w: 0.4, h: 0.5 }, { x: 0.6, y: 0.5, w: 0.4, h: 0.5 }],
  },
  {
    id: 'top',
    label: 'combine.layout.top',
    cells: (n) =>
      n < 3
        ? [{ x: 0, y: 0, w: 1, h: 0.6 }, { x: 0, y: 0.6, w: 1, h: 0.4 }]
        : [{ x: 0, y: 0, w: 1, h: 0.6 }, { x: 0, y: 0.6, w: 0.5, h: 0.4 }, { x: 0.5, y: 0.6, w: 0.5, h: 0.4 }],
  },
];

export const collageRatios = ['1:1', '4:5', '3:4', '9:16', '16:9'] as const;
export type CollageRatio = (typeof collageRatios)[number];

export const ratioValue = (r: string) => {
  const [w, h] = r.split(':').map(Number);
  return w / h;
};

/** Space between photos and around them, as a fraction of the frame's shorter side. */
export const collageGaps = [
  { id: 'none', label: 'common.none', value: 0 },
  { id: 'thin', label: 'common.small', value: 0.012 },
  { id: 'medium', label: 'common.medium', value: 0.028 },
  { id: 'thick', label: 'common.large', value: 0.05 },
] as const satisfies readonly { id: string; label: MessageKey; value: number }[];

/** Rounded corners of each photo, as a fraction of the frame's shorter side. */
export const collageCorners = [
  { id: 'square', label: 'combine.corner.square', value: 0 },
  { id: 'soft', label: 'combine.corner.soft', value: 0.02 },
  { id: 'round', label: 'combine.corner.round', value: 0.05 },
] as const satisfies readonly { id: string; label: MessageKey; value: number }[];

export const collageBackgrounds = ['#FFFFFF', '#FBF6EC', '#FDE2E4', '#DCEBFB', '#DDF3E4', '#2B2B2B'] as const;

export type CollageOptions = { layout: CollageLayoutId; gap: number; corner: number; background: string };

/** Draws the collage in a width × height frame (used for the live preview and for the final picture). */
export function CollageScene({ photos, width, height, options }: { photos: SkImage[]; width: number; height: number; options: CollageOptions }) {
  const layout = collageLayouts.find((l) => l.id === options.layout) ?? collageLayouts[0];
  const side = Math.min(width, height);
  const g = options.gap * side;
  const r = options.corner * side;
  // Outer padding and inner gaps are both g: each cell is placed in the frame minus one gap, then shrunk by one gap.
  const W = width - g;
  const H = height - g;
  return (
    <Group>
      <Fill color={options.background} />
      {layout.cells(photos.length).map((c, i) => {
        const box = rect(g + c.x * W, g + c.y * H, Math.max(1, c.w * W - g), Math.max(1, c.h * H - g));
        return (
          <Group key={i} clip={rrect(box, r, r)}>
            <Image image={photos[i]} x={box.x} y={box.y} width={box.width} height={box.height} fit="cover" />
          </Group>
        );
      })}
    </Group>
  );
}

/** The finished collage at working resolution (longer side MAX_SIDE), ready for the editor or export. */
export function renderCollage(photos: SkImage[], ratio: CollageRatio, options: CollageOptions) {
  const k = ratioValue(ratio);
  const width = k >= 1 ? MAX_SIDE : Math.round(MAX_SIDE * k);
  const height = k >= 1 ? Math.round(MAX_SIDE / k) : MAX_SIDE;
  return renderImage(<CollageScene photos={photos} width={width} height={height} options={options} />, width, height);
}
