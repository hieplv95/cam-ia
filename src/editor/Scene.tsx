import {
  BlurMask,
  Group,
  ImageSVG,
  LinearGradient,
  Mask,
  Path,
  Shadow,
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
import { DEFAULT_TEXT_STYLE, fontOf, textBlock, type EditorFonts } from './text';
import type { Doc, RetouchEffect, RetouchLayer, StrokeLayer, TextLayer } from './types';

const retouchEffects: RetouchEffect[] = ['whiten', 'lighten', 'lips', 'blush', 'brows'];

/**
 * Teeth: drain the yellow and brighten. Under-eyes: lift the shadow and warm it a touch, so a bluish dark circle
 * fades into the skin around it (strong enough to see, the soft mask edge keeps it natural).
 */
const retouchMatrix: Record<RetouchEffect, number[]> = {
  whiten: multiply(brightness(0.08), saturate(0.35)),
  lighten: multiply([1, 0, 0, 0, 0.035, 0, 1, 0, 0, 0.018, 0, 0, 1, 0, -0.005, 0, 0, 0, 1, 0], multiply(brightness(0.16), saturate(0.78))),
  // Lipstick: a soft rosy tint (more red, less green and blue), a little richer.
  lips: multiply([1.06, 0, 0, 0, 0.03, 0, 0.8, 0, 0, 0, 0, 0, 0.88, 0, 0.01, 0, 0, 0, 1, 0], saturate(1.25)),
  // Blush: a light pink flush over the cheeks.
  blush: [1.04, 0, 0, 0, 0.05, 0, 0.85, 0, 0, 0, 0, 0, 0.91, 0, 0.02, 0, 0, 0, 1, 0],
  // Brows: darker and a touch richer, so thin or light brows look filled in.
  brows: multiply([0.78, 0, 0, 0, -0.01, 0, 0.76, 0, 0, -0.015, 0, 0, 0.76, 0, -0.015, 0, 0, 0, 1, 0], saturate(1.15)),
};

/** Blush fades out wide; the other brushes keep a tighter edge. */
const maskBlur = (effect: RetouchEffect, width: number) => width * (effect === 'blush' ? 0.45 : 0.25);

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

/** Width and height of a text layer in image pixels. */
export function textSize(fonts: EditorFonts, layer: TextLayer) {
  const b = textBlock(fontOf(fonts, layer), layer.text, BASE_FONT_SIZE);
  const k = layer.size / BASE_FONT_SIZE;
  return { width: b.width * k, height: b.lineHeight * b.lines.length * k };
}

/** One text layer at the base font size, centered on (0, 0): every line, in the layer's look. */
function TextBlock({ font, layer }: { font: SkFont; layer: TextLayer }) {
  const b = textBlock(font, layer.text, BASE_FONT_SIZE);
  const style = layer.style ?? DEFAULT_TEXT_STYLE;
  return (
    <Group>
      {b.lines.map((line, i) => {
        const props = { x: -font.getTextWidth(line) / 2, y: b.center + (i - (b.lines.length - 1) / 2) * b.lineHeight, text: line, font };
        return (
          <Group key={i}>
            {style === 'sticker' && <Text {...props} color="#FFFFFF" style="stroke" strokeWidth={14} strokeJoin="round" />}
            {style === 'outline' && <Text {...props} color="#1E1A17" style="stroke" strokeWidth={9} strokeJoin="round" />}
            <Text {...props} color={layer.color}>
              {style === 'shadow' && <Shadow dx={0} dy={4} blur={7} color="rgba(0,0,0,0.55)" />}
            </Text>
          </Group>
        );
      })}
    </Group>
  );
}

export function Stroke({ layer }: { layer: StrokeLayer }) {
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
  fonts: EditorFonts;
  svgs: Record<string, SkSVG | null>;
};

/** Draws the whole document in image-pixel coordinates. Pure (no hooks) so it also works with drawAsImage. */
export function Scene({ doc, base, fonts, svgs }: SceneProps) {
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
                    <BlurMask blur={maskBlur(effect, l.width)} style="normal" />
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
        const font = fontOf(fonts, layer);
        if (!font) return null;
        return (
          <Group key={layer.id} transform={[...transform, { scale: layer.size / BASE_FONT_SIZE }]}>
            <TextBlock font={font} layer={layer} />
          </Group>
        );
      })}
      <FrameOverlay frame={doc.frame} width={w} height={h} />
    </Group>
  );
}
