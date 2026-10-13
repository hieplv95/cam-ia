import { Group, Image as SkImageNode, Shadow, useImage, type SkImage } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { encodeBase64, imageFromBase64, renderImage, resizeImage } from './editor/imageOps';

/** White "Camia.app" script signature on a transparent background (exported photos, blog pictures). */
const SIGNATURE_ASSET = require('@/assets/images/brand/camia-signature.png');
// Web bundles an image as { uri }, which Skia's loader does not read: hand it the address instead.
const SIGNATURE: number | string = Platform.OS === 'web' ? SIGNATURE_ASSET.uri : SIGNATURE_ASSET;

/** The signature as a Skia image (null while it loads). */
export const useSignature = () => useImage(SIGNATURE);

/** The picture with the optional Camia.app signature in the bottom-right corner, in image pixels. */
export function Signed({ image, logo, watermark }: { image: SkImage; logo: SkImage | null; watermark: boolean }) {
  const w = image.width();
  const h = image.height();
  const side = Math.min(w, h);
  const lw = side * 0.34;
  const lh = logo ? (lw * logo.height()) / logo.width() : 0;
  const margin = side * 0.035;
  return (
    <Group>
      <SkImageNode image={image} x={0} y={0} width={w} height={h} fit="fill" />
      {watermark && logo && (
        <SkImageNode image={logo} x={w - lw - margin} y={h - lh - margin * 0.6} width={lw} height={lh} fit="contain" opacity={0.95}>
          {/* A soft shadow keeps the white script readable on light photos. */}
          <Shadow dx={0} dy={side * 0.002} blur={side * 0.006} color="rgba(0,0,0,0.45)" />
        </SkImageNode>
      )}
    </Group>
  );
}

/** A picture resized to `maxSide`, signed when `logo` is given, as JPEG base64. */
export async function signedJpegOf(image: SkImage, logo: SkImage | null, maxSide = 1600, quality = 86) {
  const img = await resizeImage(image, maxSide);
  const out = logo ? await renderImage(<Signed image={img} logo={logo} watermark />, img.width(), img.height()) : img;
  return encodeBase64(out, quality);
}

/** Same, from base64 PNG/JPEG (e.g. what the AI returned). */
export const signedJpeg = async (base64: string, logo: SkImage | null, maxSide?: number, quality?: number) =>
  signedJpegOf(await imageFromBase64(base64), logo, maxSide, quality);
