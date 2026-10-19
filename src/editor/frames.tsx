import { BlurMask, DashPathEffect, FillType, Group, LinearGradient, Path, RadialGradient, Rect, RoundedRect, Skia, vec, type SkPath } from '@shopify/react-native-skia';

/**
 * Frames are drawn over the picture's edges (the canvas keeps its size), in image pixels.
 * Groups of the frame panel: classic, color, cute, retro (labels: frame.cat.<id>; frame names: frame.<id>).
 */
export const FRAME_CATEGORIES = ['all', 'classic', 'color', 'cute', 'retro'] as const;
export type FrameCategory = (typeof FRAME_CATEGORIES)[number];

export const frames = [
  { id: 'none', label: 'frame.none', cat: 'classic' },
  { id: 'white', label: 'frame.white', cat: 'classic' },
  { id: 'polaroid', label: 'frame.polaroid', cat: 'retro' },
  { id: 'black', label: 'frame.black', cat: 'classic' },
  { id: 'gold', label: 'frame.gold', cat: 'classic' },
  { id: 'film', label: 'frame.film', cat: 'retro' },
  { id: 'soft', label: 'frame.soft', cat: 'classic' },
  { id: 'gallery', label: 'frame.gallery', cat: 'classic' },
  { id: 'double', label: 'frame.double', cat: 'classic' },
  { id: 'rounded', label: 'frame.rounded', cat: 'classic' },
  { id: 'oval', label: 'frame.oval', cat: 'classic' },
  { id: 'arch', label: 'frame.arch', cat: 'classic' },
  { id: 'silver', label: 'frame.silver', cat: 'classic' },
  { id: 'cream', label: 'frame.cream', cat: 'color' },
  { id: 'pink', label: 'frame.pink', cat: 'color' },
  { id: 'mint', label: 'frame.mint', cat: 'color' },
  { id: 'sky', label: 'frame.sky', cat: 'color' },
  { id: 'lilac', label: 'frame.lilac', cat: 'color' },
  { id: 'sunset', label: 'frame.sunset', cat: 'color' },
  { id: 'rainbow', label: 'frame.rainbow', cat: 'color' },
  { id: 'scallop', label: 'frame.scallop', cat: 'cute' },
  { id: 'stitch', label: 'frame.stitch', cat: 'cute' },
  { id: 'hearts', label: 'frame.hearts', cat: 'cute' },
  { id: 'stars', label: 'frame.stars', cat: 'cute' },
  { id: 'flowers', label: 'frame.flowers', cat: 'cute' },
  { id: 'confetti', label: 'frame.confetti', cat: 'cute' },
  { id: 'tape', label: 'frame.tape', cat: 'cute' },
  { id: 'filmv', label: 'frame.filmv', cat: 'retro' },
  { id: 'letterbox', label: 'frame.letterbox', cat: 'retro' },
  { id: 'neon', label: 'frame.neon', cat: 'retro' },
  { id: 'vignette', label: 'frame.vignette', cat: 'retro' },
] as const;

export type FrameId = (typeof frames)[number]['id'];

/** Four rectangles forming a border of the given thickness on each side. */
function Border({ w, h, top, right, bottom, left, color }: { w: number; h: number; top: number; right: number; bottom: number; left: number; color: string }) {
  return (
    <Group>
      <Rect x={0} y={0} width={w} height={top} color={color} />
      <Rect x={0} y={h - bottom} width={w} height={bottom} color={color} />
      <Rect x={0} y={top} width={left} height={h - top - bottom} color={color} />
      <Rect x={w - right} y={top} width={right} height={h - top - bottom} color={color} />
    </Group>
  );
}

/** The whole picture minus an inner window (rectangle, rounded rectangle, oval or arch): paint it to frame the photo. */
function windowPath(w: number, h: number, inset: number, shape: 'rect' | 'rounded' | 'oval' | 'arch', radius = 0): SkPath {
  const p = Skia.Path.Make();
  p.addRect(Skia.XYWHRect(0, 0, w, h));
  const inner = Skia.XYWHRect(inset, inset, w - inset * 2, h - inset * 2);
  if (shape === 'rect') p.addRect(inner);
  else if (shape === 'rounded') p.addRRect(Skia.RRectXY(inner, radius, radius));
  else if (shape === 'oval') p.addOval(inner);
  else {
    const r = (w - inset * 2) / 2;
    p.moveTo(inset, h - inset);
    p.lineTo(inset, inset + r);
    p.arcToOval(Skia.XYWHRect(inset, inset, r * 2, r * 2), 180, 180, false);
    p.lineTo(w - inset, h - inset);
    p.close();
  }
  p.setFillType(FillType.EvenOdd);
  return p;
}

/** Points spaced about `step` apart along the middle of a border of thickness t. */
function borderPoints(w: number, h: number, t: number, step: number) {
  const pts: { x: number; y: number }[] = [];
  const along = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) pts.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n });
  };
  const c = t / 2;
  along(c, c, w - c, c);
  along(w - c, c, w - c, h - c);
  along(w - c, h - c, c, h - c);
  along(c, h - c, c, c);
  return pts;
}

// Made on first use: on the web Skia finishes loading after the modules are evaluated.
const shapes: { heart?: SkPath; star?: SkPath } = {};
const heartPath = () =>
  (shapes.heart ??= Skia.Path.MakeFromSVGString(
    'M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z',
  )!);
const starPath = () => (shapes.star ??= Skia.Path.MakeFromSVGString('M50 6 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38 Z')!);

/** A 100x100 shape centred on (x, y) at `size` pixels. */
function Shape({ path, x, y, size, color, rotate = 0 }: { path: SkPath; x: number; y: number; size: number; color: string; rotate?: number }) {
  return (
    <Group transform={[{ translateX: x }, { translateY: y }, { rotate }, { scale: size / 100 }, { translateX: -50 }, { translateY: -50 }]}>
      <Path path={path} color={color} />
    </Group>
  );
}

/** Same colors every time for the same picture size (no flicker between renders). */
const seeded = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const plainColor: Partial<Record<FrameId, string>> = { cream: '#F4ECDF', pink: '#FFD6E5', mint: '#CFF2E4', sky: '#D4E9FF', lilac: '#E6DBFF' };

export function FrameOverlay({ frame, width: w, height: h }: { frame: FrameId; width: number; height: number }) {
  const m = Math.min(w, h);
  const color = plainColor[frame];
  if (color) {
    const t = m * 0.05;
    return <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color={color} />;
  }
  switch (frame) {
    case 'none':
      return null;
    case 'white': {
      const t = m * 0.04;
      return <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color="#FFFFFF" />;
    }
    case 'polaroid': {
      const t = m * 0.045;
      return <Border w={w} h={h} top={t} right={t} bottom={m * 0.18} left={t} color="#FBFAF6" />;
    }
    case 'black': {
      const t = m * 0.04;
      return <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color="#111111" />;
    }
    case 'gold': {
      const a = m * 0.03;
      const b = m * 0.048;
      return (
        <Group>
          <RoundedRect x={a} y={a} width={w - a * 2} height={h - a * 2} r={m * 0.01} color="#E4C48E" style="stroke" strokeWidth={m * 0.006} />
          <RoundedRect x={b} y={b} width={w - b * 2} height={h - b * 2} r={m * 0.006} color="#E4C48E" style="stroke" strokeWidth={m * 0.0025} />
        </Group>
      );
    }
    case 'silver': {
      const a = m * 0.03;
      const b = m * 0.048;
      return (
        <Group>
          <RoundedRect x={a} y={a} width={w - a * 2} height={h - a * 2} r={m * 0.01} color="#E3E7EC" style="stroke" strokeWidth={m * 0.008} />
          <RoundedRect x={b} y={b} width={w - b * 2} height={h - b * 2} r={m * 0.006} color="#BFC6CF" style="stroke" strokeWidth={m * 0.003} />
        </Group>
      );
    }
    case 'film': {
      const band = h * 0.075;
      const hole = band * 0.42;
      const gap = hole * 0.9;
      const count = Math.floor(w / (hole + gap));
      const holes = Array.from({ length: count }, (_, i) => gap / 2 + i * (hole + gap));
      return (
        <Group>
          <Border w={w} h={h} top={band} right={0} bottom={band} left={0} color="#121212" />
          {holes.map((x) => (
            <Group key={x}>
              <RoundedRect x={x} y={(band - hole) / 2} width={hole} height={hole} r={hole * 0.2} color="#F4EFE7" opacity={0.85} />
              <RoundedRect x={x} y={h - band + (band - hole) / 2} width={hole} height={hole} r={hole * 0.2} color="#F4EFE7" opacity={0.85} />
            </Group>
          ))}
        </Group>
      );
    }
    case 'filmv': {
      const band = w * 0.075;
      const hole = band * 0.42;
      const gap = hole * 0.9;
      const count = Math.floor(h / (hole + gap));
      const holes = Array.from({ length: count }, (_, i) => gap / 2 + i * (hole + gap));
      return (
        <Group>
          <Border w={w} h={h} top={0} right={band} bottom={0} left={band} color="#121212" />
          {holes.map((y) => (
            <Group key={y}>
              <RoundedRect x={(band - hole) / 2} y={y} width={hole} height={hole} r={hole * 0.2} color="#F4EFE7" opacity={0.85} />
              <RoundedRect x={w - band + (band - hole) / 2} y={y} width={hole} height={hole} r={hole * 0.2} color="#F4EFE7" opacity={0.85} />
            </Group>
          ))}
        </Group>
      );
    }
    case 'soft':
      return (
        <Rect x={0} y={0} width={w} height={h}>
          <RadialGradient
            c={vec(w / 2, h / 2)}
            r={Math.hypot(w, h) / 2}
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.95)']}
            positions={[0, 0.62, 1]}
          />
        </Rect>
      );
    case 'vignette':
      return (
        <Rect x={0} y={0} width={w} height={h}>
          <RadialGradient
            c={vec(w / 2, h / 2)}
            r={Math.hypot(w, h) / 2}
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
            positions={[0, 0.55, 1]}
          />
        </Rect>
      );
    case 'gallery': {
      const t = m * 0.08;
      return (
        <Group>
          <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color="#FFFFFF" />
          <Rect x={t} y={t} width={w - t * 2} height={h - t * 2} color="#C9C4BC" style="stroke" strokeWidth={m * 0.003} />
        </Group>
      );
    }
    case 'double': {
      const outer = m * 0.012;
      const t = m * 0.045;
      return (
        <Group>
          <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color="#FFFFFF" />
          <Border w={w} h={h} top={outer} right={outer} bottom={outer} left={outer} color="#1E1A17" />
          <Rect x={t} y={t} width={w - t * 2} height={h - t * 2} color="#1E1A17" style="stroke" strokeWidth={m * 0.004} />
        </Group>
      );
    }
    case 'rounded':
      return <Path path={windowPath(w, h, m * 0.035, 'rounded', m * 0.09)} color="#FFFFFF" />;
    case 'oval':
      return <Path path={windowPath(w, h, m * 0.04, 'oval')} color="#FFFFFF" />;
    case 'arch':
      return <Path path={windowPath(w, h, m * 0.06, 'arch')} color="#F4ECDF" />;
    case 'sunset':
    case 'rainbow':
      return (
        <Path path={windowPath(w, h, m * 0.05, 'rect')}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(w, h)}
            colors={frame === 'sunset' ? ['#FF7AB6', '#FF9F6B', '#FFD36B'] : ['#FF3B3B', '#FF9F1C', '#FFD60A', '#3CCFB4', '#4DB5FF', '#8B6CF6']}
          />
        </Path>
      );
    case 'scallop': {
      const t = m * 0.035;
      const r = m * 0.022;
      return (
        <Group>
          <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color="#FFFFFF" />
          {borderPoints(w, h, t * 2, r * 2).map((p, i) => (
            <RoundedRect key={i} x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} r={r} color="#FFFFFF" />
          ))}
        </Group>
      );
    }
    case 'stitch': {
      const t = m * 0.05;
      const s = t * 0.55;
      return (
        <Group>
          <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color="#F4ECDF" />
          <Rect x={s} y={s} width={w - s * 2} height={h - s * 2} color="#B08968" style="stroke" strokeWidth={m * 0.004}>
            <DashPathEffect intervals={[m * 0.016, m * 0.01]} />
          </Rect>
        </Group>
      );
    }
    case 'hearts': {
      const t = m * 0.06;
      return (
        <Group>
          <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color="#FFD6E5" />
          {borderPoints(w, h, t, t * 1.6).map((p, i) => (
            <Shape key={i} path={heartPath()} x={p.x} y={p.y} size={t * 0.62} color={i % 2 ? '#FF5FA2' : '#FF8FB8'} rotate={(seeded(i) - 0.5) * 0.5} />
          ))}
        </Group>
      );
    }
    case 'stars': {
      const t = m * 0.06;
      return (
        <Group>
          <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color="#1F2A4D" />
          {borderPoints(w, h, t, t * 1.5).map((p, i) => (
            <Shape key={i} path={starPath()} x={p.x} y={p.y} size={t * (0.4 + seeded(i) * 0.3)} color={i % 3 ? '#FFD36B' : '#FFFFFF'} rotate={seeded(i + 7) * 0.6} />
          ))}
        </Group>
      );
    }
    case 'flowers': {
      const t = m * 0.065;
      return (
        <Group>
          <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color="#FFF7EC" />
          {borderPoints(w, h, t, t * 1.5).map((p, i) => {
            const r = t * 0.16;
            const petal = ['#FF8FB8', '#B9A6FF', '#7FD6C2', '#FFB866'][i % 4];
            return (
              <Group key={i}>
                {[0, 1, 2, 3, 4].map((k) => {
                  const a = (k * 2 * Math.PI) / 5;
                  return <RoundedRect key={k} x={p.x + Math.cos(a) * r * 1.3 - r} y={p.y + Math.sin(a) * r * 1.3 - r} width={r * 2} height={r * 2} r={r} color={petal} />;
                })}
                <RoundedRect x={p.x - r * 0.8} y={p.y - r * 0.8} width={r * 1.6} height={r * 1.6} r={r * 0.8} color="#FFD60A" />
              </Group>
            );
          })}
        </Group>
      );
    }
    case 'confetti': {
      const t = m * 0.06;
      const palette = ['#FF5FA2', '#4DB5FF', '#FFD60A', '#7FE3CF', '#8B6CF6', '#FF8A3D'];
      return (
        <Group>
          <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color="#FFFFFF" />
          {borderPoints(w, h, t, t * 0.55).map((p, i) => {
            const s = t * (0.16 + seeded(i) * 0.14);
            const dx = (seeded(i + 3) - 0.5) * t * 0.6;
            const dy = (seeded(i + 5) - 0.5) * t * 0.6;
            return (
              <Group key={i} transform={[{ translateX: p.x + dx }, { translateY: p.y + dy }, { rotate: seeded(i + 9) * Math.PI }]}>
                <RoundedRect x={-s} y={-s * 0.45} width={s * 2} height={s * 0.9} r={i % 3 ? s * 0.2 : s * 0.45} color={palette[i % palette.length]} />
              </Group>
            );
          })}
        </Group>
      );
    }
    case 'tape': {
      const t = m * 0.04;
      const tw = m * 0.3;
      const th = m * 0.08;
      return (
        <Group>
          <Border w={w} h={h} top={t} right={t} bottom={t} left={t} color="#FFFFFF" />
          <Group transform={[{ translateX: m * 0.13 }, { translateY: m * 0.09 }, { rotate: -Math.PI / 4 }]}>
            <Rect x={-tw / 2} y={-th / 2} width={tw} height={th} color="rgba(255,176,200,0.8)" />
          </Group>
          <Group transform={[{ translateX: w - m * 0.13 }, { translateY: m * 0.09 }, { rotate: Math.PI / 4 }]}>
            <Rect x={-tw / 2} y={-th / 2} width={tw} height={th} color="rgba(159,227,207,0.8)" />
          </Group>
        </Group>
      );
    }
    case 'letterbox': {
      const band = h * 0.11;
      return <Border w={w} h={h} top={band} right={0} bottom={band} left={0} color="#000000" />;
    }
    case 'neon': {
      const a = m * 0.045;
      const props = { x: a, y: a, width: w - a * 2, height: h - a * 2, r: m * 0.04, style: 'stroke' as const };
      return (
        <Group>
          <RoundedRect {...props} color="#FF4FD8" strokeWidth={m * 0.03}>
            <BlurMask blur={m * 0.02} style="normal" />
          </RoundedRect>
          <RoundedRect {...props} color="#FFE6FA" strokeWidth={m * 0.008} />
        </Group>
      );
    }
    default:
      return null;
  }
}
