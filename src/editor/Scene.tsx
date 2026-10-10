import {
  BlurMask,
  Group,
  ImageSVG,
  LinearGradient,
  Mask,
  Path,
  Skia,
  Text,
  vec,
  type SkFont,
  type SkImage,
  type SkPath,
  type SkSVG,
} from '@shopify/react-native-skia';

import { DevelopedImage } from '../develop/shader';
import { FrameOverlay } from './frames';
import { brightness, multiply, saturate } from './filters';
import type { Doc, RetouchEffect, RetouchLayer, StrokeLayer, TextLayer } from './types';

const retouchEffects: RetouchEffect[] = ['whiten', 'lighten'];

/** Teeth: drain the yellow and brighten. Under-eyes: lift the shadow a little. */
const retouchMatrix: Record<RetouchEffect, number[]> = {
  whiten: multiply(brightness(0.08), saturate(0.35)),
  lighten: multiply(brightness(0.07), saturate(0.85)),
};

/** Fonts are loaded at this size and scaled per layer. */
export const BASE_FONT_SIZE = 100;
/** Stickers are authored on a 100x100 viewBox (see stickers.ts). */
const STICKER_VIEWBOX = 100;

export const rainbowColors = ['#FF3B3B', '#FF9F1C', '#FFD60A', '#3CCFB4', '#4DB5FF', '#8B6CF6'];

export function buildStrokePath(points: number[]): SkPath {
  const path = Skia.Path.Make();
  if (points.length < 2) return path;
  path.moveTo(points[0], points[1]);
  if (points.length === 2) {
    // A single tap still leaves a dot.
    path.lineTo(points[0] + 0.1, points[1]);
    return path;
  }
  for (let i = 2; i < points.length - 2; i += 2) {
    const midX = (points[i] + points[i + 2]) / 2;
    const midY = (points[i + 1] + points[i + 3]) / 2;
    path.quadTo(points[i], points[i + 1], midX, midY);
  }
  path.lineTo(points[points.length - 2], points[points.length - 1]);
  return path;
}

export function textWidth(font: SkFont, layer: TextLayer) {
  return (font.getTextWidth(layer.text) * layer.size) / BASE_FONT_SIZE;
}

function Stroke({ layer }: { layer: StrokeLayer }) {
  const path = buildStrokePath(layer.points);
  const common = {
    path,
    style: 'stroke' as const,
    strokeCap: 'round' as const,
    strokeJoin: 'round' as const,
  };
  if (layer.pen === 'neon') {
    return (
      <Group>
        <Path {...common} color={layer.color} strokeWidth={layer.width * 1.6}>
          <BlurMask blur={layer.width * 0.8} style="normal" />
        </Path>
        <Path {...common} color="#FFFFFF" strokeWidth={layer.width * 0.45} />
      </Group>
    );
  }
  if (layer.pen === 'rainbow') {
    const b = path.computeTightBounds();
    return (
      <Path {...common} strokeWidth={layer.width}>
        <LinearGradient
          start={vec(b.x, b.y)}
          end={vec(b.x + Math.max(b.width, 1), b.y + Math.max(b.height, 1))}
          colors={rainbowColors}
        />
      </Path>
    );
  }
  return <Path {...common} color={layer.color} strokeWidth={layer.width} />;
}

type SceneProps = {
  doc: Doc;
  /** Higher-resolution version of doc.image to draw instead (full-size export). */
  base?: SkImage;
  font: SkFont | null;
  svgs: Record<string, SkSVG | null>;
};

/** Draws the whole document in image-pixel coordinates. Pure (no hooks) so it also works with drawAsImage. */
export function Scene({ doc, base, font, svgs }: SceneProps) {
  const w = doc.image.width();
  const h = doc.image.height();
  return (
    <Group>
      <DevelopedImage image={base ?? doc.image} develop={doc.develop} width={w} height={h} />
      {retouchEffects.map((effect) => {
        const areas = doc.layers.filter((l): l is RetouchLayer => l.kind === 'retouch' && l.effect === effect);
        if (!areas.length) return null;
        return (
          <Mask
            key={effect}
            mode="alpha"
            mask={
              <Group>
                {areas.map((l) => (
                  <Path key={l.id} path={buildStrokePath(l.points)} style="stroke" strokeWidth={l.width} strokeCap="round" strokeJoin="round" color="#000000">
                    <BlurMask blur={l.width * 0.25} style="normal" />
                  </Path>
                ))}
              </Group>
            }
          >
            <DevelopedImage image={base ?? doc.image} develop={doc.develop} width={w} height={h} tint={retouchMatrix[effect]} />
          </Mask>
        );
      })}
      {doc.layers.map((layer) => {
        if (layer.kind === 'retouch') return null;
        if (layer.kind === 'stroke') return <Stroke key={layer.id} layer={layer} />;
        const transform = [
          { translateX: layer.x },
          { translateY: layer.y },
          { rotate: layer.rotation },
        ];
        if (layer.kind === 'sticker') {
          const svg = svgs[layer.stickerId];
          if (!svg) return null;
          // ImageSVG ignores width/height on some platforms, so draw at the 100px viewBox and scale.
          return (
            <Group key={layer.id} transform={[...transform, { scale: layer.size / STICKER_VIEWBOX }]}>
              <ImageSVG svg={svg} x={-STICKER_VIEWBOX / 2} y={-STICKER_VIEWBOX / 2} width={STICKER_VIEWBOX} height={STICKER_VIEWBOX} />
            </Group>
          );
        }
        if (!font) return null;
        const k = layer.size / BASE_FONT_SIZE;
        const tw = font.getTextWidth(layer.text);
        // Baseline sits ~35% below the visual center for Baloo 2.
        const textProps = { x: -tw / 2, y: BASE_FONT_SIZE * 0.35, text: layer.text, font };
        return (
          <Group key={layer.id} transform={[...transform, { scale: k }]}>
            <Text {...textProps} color="#FFFFFF" style="stroke" strokeWidth={14} strokeJoin="round" />
            <Text {...textProps} color={layer.color} />
          </Group>
        );
      })}
      <FrameOverlay frame={doc.frame} width={w} height={h} />
    </Group>
  );
}
