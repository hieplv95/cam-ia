import { ColorMatrix, ImageShader, Rect, rect, Shader, Skia, type SkImage, type SkRuntimeEffect } from '@shopify/react-native-skia';

import { buildMatrix, multiply } from '../editor/filters';
import { defaultAdjust } from '../editor/types';
import { DEVELOP_SKSL, developUniforms } from './developSksl';
import type { Develop } from './types';

let effect: SkRuntimeEffect | null | undefined;

/** Compiled lazily: Skia (CanvasKit on web) is not available when modules are first evaluated on the server. */
export function developEffect() {
  if (effect === undefined) {
    effect = Skia.RuntimeEffect.Make(DEVELOP_SKSL);
    if (!effect) console.error('Develop shader failed to compile');
  }
  return effect;
}

/** The developed picture filling a width×height area; used for the live preview and for export. */
export function DevelopedImage({
  image,
  develop,
  width,
  height,
  fit = 'fill',
  tint,
  strength = 1,
}: {
  image: SkImage;
  develop: Develop;
  width: number;
  height: number;
  /** "cover" crops to fill thumbnails of a different aspect ratio. */
  fit?: 'fill' | 'cover';
  /** Extra color matrix applied after the look (used by the retouch brushes). */
  tint?: number[];
  /** 0–1: how much of the result shows over the untouched photo (CamIA Filters intensity). */
  strength?: number;
}) {
  const source = developEffect();
  if (!source) return null;
  const look = develop.look !== 'none' ? buildMatrix(develop.look, defaultAdjust) : null;
  const matrix = look && tint ? multiply(tint, look) : (tint ?? look);
  return (
    <Rect x={0} y={0} width={width} height={height}>
      <Shader source={source} uniforms={developUniforms(develop, width, height, strength)}>
        <ImageShader image={image} fit={fit} rect={rect(0, 0, width, height)} />
      </Shader>
      {matrix && <ColorMatrix matrix={matrix} />}
    </Rect>
  );
}
