import { generateText } from './gemini';
import { canvasKit } from './stamp';

/**
 * "Restore old photos" › take the print out of its surroundings.
 * Customers photograph a print where it is (on a table, a wall, an altar, in a frame or a hand), usually at an angle.
 * The image model keeps the canvas it is given, so asking it to crop is unreliable: instead a vision model finds the
 * four corners of the print and we flatten it here, then only the print is sent to be restored.
 */

type Point = [number, number];

const LOCATE =
  'This picture may be a photo taken OF a printed photograph: lying on a table, on a wall or an altar, in a frame or an album, or held in a hand, often at an angle. ' +
  'Find the printed photograph and give the four corners of its picture area (inside any white paper border, mat or frame), ' +
  'as x and y from 0 to 1000 of the picture width and height, in the order top-left, top-right, bottom-right, bottom-left. ' +
  'If the picture is already just the photograph filling the frame, or there is no printed photograph, set found to false. ' +
  'Answer with JSON only: {"found": true, "corners": [[x, y], [x, y], [x, y], [x, y]]}';

/** Corners in pixels, clockwise from the top-left, or null when the picture is just the print (or nothing usable was found). */
export async function locatePrint(imageBase64: string, width: number, height: number): Promise<Point[] | null> {
  const { text } = await generateText(LOCATE, 'You locate objects in images precisely and answer with JSON only.', {
    json: true,
    image: imageBase64,
    temperature: 0,
    timeoutMs: 30_000,
  });
  const data = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const raw: unknown[] = Array.isArray(data?.corners) ? data.corners : [];
  if (data?.found !== true || raw.length !== 4) return null;
  const points = raw.map((p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [NaN, NaN]));
  if (points.some(([x, y]) => !(x >= 0 && x <= 1000 && y >= 0 && y <= 1000))) return null;
  return checkQuad(clockwise(points.map(([x, y]) => [(x / 1000) * width, (y / 1000) * height] as Point)), width, height);
}

/** Sorts four points clockwise starting from the top-left, whatever order the model gave them in. */
function clockwise(points: Point[]): Point[] {
  const cx = points.reduce((s, p) => s + p[0], 0) / 4;
  const cy = points.reduce((s, p) => s + p[1], 0) / 4;
  const sorted = [...points].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  const start = sorted.reduce((best, p, i) => (p[0] + p[1] < sorted[best][0] + sorted[best][1] ? i : best), 0);
  return [...sorted.slice(start), ...sorted.slice(0, start)];
}

const area = (q: Point[]) => Math.abs(q.reduce((s, p, i) => s + p[0] * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * p[1], 0)) / 2;

/** A convex quadrilateral that is clearly smaller than the picture (otherwise there is nothing to take out). */
function checkQuad(q: Point[], width: number, height: number): Point[] | null {
  const cross = q.map((p, i) => {
    const a = q[(i + 1) % 4];
    const b = q[(i + 2) % 4];
    return (a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0]);
  });
  if (!cross.every((c) => c > 0) && !cross.every((c) => c < 0)) return null;
  const share = area(q) / (width * height);
  return share >= 0.08 && share <= 0.9 ? q : null;
}

/** The 3×3 matrix (row-major) that maps the four `from` points onto the four `to` points. */
function homography(from: Point[], to: Point[]): number[] {
  const a: number[][] = [];
  from.forEach(([x, y], i) => {
    const [u, v] = to[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  // Gaussian elimination with partial pivoting on the 8×9 augmented matrix.
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k < 9; k++) a[r][k] -= f * a[c][k];
    }
  }
  return [...a.map((row, i) => row[8] / row[i]), 1];
}

const MAX_SIDE = 2048;

/** Flattens the print inside `corners` (clockwise from the top-left) into its own JPEG (base64). */
export async function warpPrint(imageBase64: string, corners: Point[]): Promise<string> {
  const CK = await canvasKit();
  const image = CK.MakeImageFromEncoded(Buffer.from(imageBase64, 'base64'));
  if (!image) throw new Error('cannot decode image');
  const dist = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const [tl, tr, br, bl] = corners;
  let w = Math.max(dist(tl, tr), dist(bl, br));
  let h = Math.max(dist(tl, bl), dist(tr, br));
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const surface = CK.MakeSurface(w, h);
  try {
    const canvas = surface.getCanvas();
    canvas.concat(homography(corners, [[0, 0], [w, 0], [w, h], [0, h]]));
    canvas.drawImageOptions(image, 0, 0, CK.FilterMode.Linear, CK.MipmapMode.Linear, null);
    const bytes = surface.makeImageSnapshot().encodeToBytes(CK.ImageFormat.JPEG, 92);
    if (!bytes) throw new Error('cannot encode image');
    return Buffer.from(bytes).toString('base64');
  } finally {
    surface.delete();
    image.delete();
  }
}

/** Size of a JPEG or PNG (base64). */
export async function imageSize(imageBase64: string): Promise<{ width: number; height: number } | null> {
  const CK = await canvasKit();
  const image = CK.MakeImageFromEncoded(Buffer.from(imageBase64, 'base64'));
  if (!image) return null;
  const size = { width: image.width(), height: image.height() };
  image.delete();
  return size;
}

/** Only the print, flattened, or null to send the picture as it is (no print found, or it already fills the picture). */
export async function isolatePrint(imageBase64: string): Promise<string | null> {
  try {
    const size = await imageSize(imageBase64);
    if (!size) return null;
    const corners = await locatePrint(imageBase64, size.width, size.height);
    return corners ? await warpPrint(imageBase64, corners) : null;
  } catch (e) {
    // The restore still runs on the whole picture, with the instruction to take the print out.
    console.warn('[restore] could not isolate the print:', e instanceof Error ? e.message : e);
    return null;
  }
}
