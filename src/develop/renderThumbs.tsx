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
  Skia,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';

import { ILLU_H, ILLU_W, illustrationIds, type IllustrationId } from '../aiIllustrations';
import { renderThumbnail } from '../editor/imageOps';
import { photoData, type PhotoKey } from '../photos';
import { developPresets, presetById, presetDevelop } from './presets';
import { DevelopedImage } from './shader';

/**
 * Development tool, never part of the app: draws the pictures the app ships ready-made, so phones never spend seconds
 * drawing them (they used to be drawn on every visit, which kept the home screen from answering taps):
 * - the preset cards (assets/images/presets/<id>.jpg): the preset's sample photo with the preset at full strength;
 * - the AI tool cards (assets/images/illustrations/<id>.jpg), drawn from the showcase photos so they cost no AI calls,
 *   each hinting at what the tool does (dashed object to remove, blurry vs sharp halves, transparency checkerboard…).
 *
 * After changing a preset, the look shader or a scene: run `node scripts/save-thumbs.cjs`, open the app on localhost
 * (`npx expo start --web --port 8095`) and call `await camiRenderThumbs()` in the browser console; then list new
 * presets in src/develop/presetThumbs.ts.
 */
const W = ILLU_W;
const H = ILLU_H;

const photoCache = new Map<PhotoKey, Promise<SkImage>>();

/** Decoded showcase photo (720px for the Unsplash scenes, the bundled file for the models), cached. */
function loadPhoto(key: PhotoKey) {
  let p = photoCache.get(key);
  if (!p) {
    p = Skia.Data.fromURI(photoData(key, 720)).then((data) => {
      const img = Skia.Image.MakeImageFromEncoded(data);
      if (!img) throw new Error('decode failed');
      return img;
    });
    photoCache.set(key, p);
  }
  return p;
}

const photoFor: Record<IllustrationId, PhotoKey> = {
  erase: 'copacabana',
  enhance: 'modelPeace',
  removebg: 'modelWhite',
  art: 'modelVanity',
  expand: 'cartagena',
  generate: 'modelPeace',
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

/** PNG data URI → JPEG data URI (much smaller for photos). */
const toJpeg = (uri: string) =>
  new Promise<string>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = reject;
    img.src = uri;
  });

const save = async (dir: string, files: Record<string, string>) => {
  const res = await fetch('http://localhost:8099/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dir, files }) });
  if (!res.ok) throw new Error(await res.text());
};

/** Draws every built-in preset card and AI tool card and hands them to scripts/save-thumbs.cjs (slow: minutes). */
export async function renderThumbs() {
  const presets: Record<string, string> = {};
  for (const preset of developPresets) {
    const img = await loadPhoto(preset.photo ?? 'modelPeace');
    const png = await renderThumbnail(<DevelopedImage image={img} develop={presetDevelop(preset)} width={W} height={H} fit="cover" />, W, H);
    presets[`${preset.id}.jpg`] = await toJpeg(png);
  }
  await save('assets/images/presets', presets);
  const illustrations: Record<string, string> = {};
  for (const id of illustrationIds) {
    illustrations[`${id}.jpg`] = await toJpeg(await renderThumbnail(scene(id, await loadPhoto(photoFor[id])), W, H));
  }
  await save('assets/images/illustrations', illustrations);
  return `${Object.keys(presets).length} presets, ${illustrationIds.length} illustrations`;
}
