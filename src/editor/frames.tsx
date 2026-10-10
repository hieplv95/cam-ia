import { Group, RadialGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia';

/** Frames are drawn over the picture's edges (the canvas keeps its size), in image pixels. */
export const frames = [
  { id: 'none', label: 'frame.none' },
  { id: 'white', label: 'frame.white' },
  { id: 'polaroid', label: 'frame.polaroid' },
  { id: 'black', label: 'frame.black' },
  { id: 'gold', label: 'frame.gold' },
  { id: 'film', label: 'frame.film' },
  { id: 'soft', label: 'frame.soft' },
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

export function FrameOverlay({ frame, width: w, height: h }: { frame: FrameId; width: number; height: number }) {
  const m = Math.min(w, h);
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
  }
}
