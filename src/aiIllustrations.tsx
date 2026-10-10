import {
  Blur,
  Circle,
  ColorMatrix,
  DashPathEffect,
  Group,
  Image,
  Line,
  Mask,
  RadialGradient,
  Rect,
  rect,
  RoundedRect,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

import { presetById, presetDevelop } from './develop/presets';
import { loadPhoto } from './develop/PresetCard';
import { DevelopedImage } from './develop/shader';
import { renderThumbnail } from './editor/imageOps';
import type { PhotoKey } from './photos';

/**
 * Card artwork for the AI tools screen, drawn with Skia from the showcase photos so it costs no AI calls.
 * Each one hints at what the tool does (dashed object to remove, blurry vs sharp halves, transparency checkerboard…).
 */
export type IllustrationId = 'erase' | 'enhance' | 'removebg' | 'art' | 'expand' | 'generate';

export const ILLU_W = 360;
export const ILLU_H = 280;
const W = ILLU_W;
const H = ILLU_H;

const photoFor: Record<IllustrationId, PhotoKey> = {
  erase: 'copacabana',
  enhance: 'portraitSoft',
  removebg: 'portraitRose',
  art: 'heroGolden',
  expand: 'cartagena',
  generate: 'hero',
};

const cover = (img: SkImage, x = 0, y = 0, w = W, h = H) => <Image image={img} x={x} y={y} width={w} height={h} fit="cover" />;

function Checkerboard({ size = 16 }: { size?: number }) {
  const cells = [];
  for (let y = 0; y < H; y += size) {
    for (let x = 0; x < W; x += size) {
      if ((x / size + y / size) % 2 === 0) cells.push(<Rect key={`${x}-${y}`} x={x} y={y} width={size} height={size} color="#E6E2DC" />);
    }
  }
  return (
    <Group>
      <Rect x={0} y={0} width={W} height={H} color="#FFFFFF" />
      {cells}
    </Group>
  );
}

function scene(id: IllustrationId, img: SkImage) {
  switch (id) {
    case 'erase': {
      const bx = W * 0.6;
      const by = H * 0.18;
      const bw = W * 0.28;
      const bh = H * 0.72;
      const cx = bx + bw / 2;
      return (
        <Group>
          {cover(img)}
          <RoundedRect x={bx} y={by} width={bw} height={bh} r={10} color="rgba(255,95,162,0.25)" />
          <Circle cx={cx} cy={by + bh * 0.22} r={bw * 0.17} color="rgba(255,95,162,0.85)" />
          <RoundedRect x={cx - bw * 0.26} y={by + bh * 0.38} width={bw * 0.52} height={bh * 0.55} r={bw * 0.2} color="rgba(255,95,162,0.85)" />
          <RoundedRect x={bx} y={by} width={bw} height={bh} r={10} color="#FFFFFF" style="stroke" strokeWidth={2.5}>
            <DashPathEffect intervals={[9, 6]} />
          </RoundedRect>
        </Group>
      );
    }
    case 'enhance':
      return (
        <Group>
          <Group clip={rect(0, 0, W / 2, H)}>
            <Image image={img} x={0} y={0} width={W} height={H} fit="cover">
              <Blur blur={5} />
            </Image>
          </Group>
          <Group clip={rect(W / 2, 0, W / 2, H)}>{cover(img)}</Group>
          <Line p1={vec(W / 2, 0)} p2={vec(W / 2, H)} color="#FFFFFF" strokeWidth={3} />
        </Group>
      );
    case 'removebg':
      // An oval fade around the face suggests the background being cut away to transparency.
      return (
        <Group>
          <Checkerboard />
          <Mask
            mode="alpha"
            mask={
              <Group transform={[{ translateX: W / 2 }, { translateY: H * 0.55 }, { scaleX: 0.62 }, { translateX: -W / 2 }, { translateY: -H * 0.55 }]}>
                <Rect x={0} y={0} width={W} height={H}>
                  <RadialGradient c={vec(W / 2, H * 0.55)} r={H * 0.62} colors={['#000000', '#000000', 'rgba(0,0,0,0)']} positions={[0, 0.72, 1]} />
                </Rect>
              </Group>
            }
          >
            {cover(img)}
          </Mask>
        </Group>
      );
    case 'art': {
      // Vivid colors with softened detail read as "painted" next to the untouched half.
      const frida = presetById('frida');
      const painted = frida ? presetDevelop(frida, 100) : null;
      return (
        <Group>
          <Group clip={rect(0, 0, W / 2, H)}>{cover(img)}</Group>
          <Group clip={rect(W / 2, 0, W / 2, H)}>
            {painted ? (
              <DevelopedImage image={img} develop={{ ...painted, detail: { ...painted.detail, clarity: -60, grain: 0 } }} width={W} height={H} fit="cover" />
            ) : (
              cover(img)
            )}
            <Rect x={W / 2} y={0} width={W / 2} height={H} color="rgba(255,240,220,0.12)" />
          </Group>
          <Line p1={vec(W / 2, 0)} p2={vec(W / 2, H)} color="#FFFFFF" strokeWidth={4} />
        </Group>
      );
    }
    case 'expand': {
      const ix = W * 0.2;
      const iy = H * 0.18;
      const iw = W * 0.6;
      const ih = H * 0.64;
      return (
        <Group>
          <Image image={img} x={-W * 0.15} y={-H * 0.15} width={W * 1.3} height={H * 1.3} fit="cover">
            <Blur blur={6} />
            <ColorMatrix matrix={[0.85, 0, 0, 0, 0.12, 0, 0.85, 0, 0, 0.12, 0, 0, 0.85, 0, 0.12, 0, 0, 0, 1, 0]} />
          </Image>
          <Group clip={rect(ix, iy, iw, ih)}>{cover(img, ix, iy, iw, ih)}</Group>
          <RoundedRect x={ix} y={iy} width={iw} height={ih} r={4} color="#FFFFFF" style="stroke" strokeWidth={2.5}>
            <DashPathEffect intervals={[10, 6]} />
          </RoundedRect>
        </Group>
      );
    }
    case 'generate':
      return (
        <Group>
          {cover(img)}
          <Rect x={0} y={0} width={W} height={H}>
            <RadialGradient c={vec(W * 0.8, H * 0.15)} r={W * 0.6} colors={['rgba(255,214,150,0.45)', 'rgba(255,214,150,0)']} />
          </Rect>
        </Group>
      );
  }
}

const cache = new Map<IllustrationId, Promise<string>>();

function illustration(id: IllustrationId) {
  let p = cache.get(id);
  if (!p) {
    p = loadPhoto(photoFor[id]).then((img) => renderThumbnail(scene(id, img), W, H));
    cache.set(id, p);
  }
  return p;
}

/** Data URI of a tool's card artwork, or null while it renders. */
export function useIllustration(id: IllustrationId) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    illustration(id)
      .then((u) => alive && setUri(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);
  return uri;
}
