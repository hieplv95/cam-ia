import { Ionicons } from '@expo/vector-icons';
import { Canvas, DashPathEffect, Group, Image, Line, Path, Rect, rect, RoundedRect, Skia, vec, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { memo, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colors, font } from '../theme';
import { moveCrop, resizeCrop, type CropCorner, type CropRect } from './crop';
import { buildStrokePath, Scene, Stroke, textSize } from './Scene';
import type { EditorFonts } from './text';
import { newId, type Doc, type EraseMark, type Layer, type PenKind, type RetouchEffect, type TransformableLayer } from './types';
import { useT } from '../i18n';

export type PenSettings = { color: string; width: number; kind: PenKind };

type Props = {
  doc: Doc;
  fonts: EditorFonts;
  svgs: Record<string, SkSVG | null>;
  /** 'retouch' paints a mask for a free beauty effect; 'erase' marks what to remove; 'crop' shows the crop frame. */
  mode: 'move' | 'draw' | 'retouch' | 'erase' | 'crop';
  pen: PenSettings;
  brush?: { effect: RetouchEffect; width: number };
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  checkpoint: () => void;
  update: (fn: (doc: Doc) => Doc) => void;
  /** When set, shows this "before" picture left of a draggable divider instead of editing layers. */
  compareWith?: SkImage | null;
  /** "Xóa vật thể": the marks painted so far, the brush width (screen points) and how to change them. */
  erase?: { marks: EraseMark[]; width: number; onChange: (fn: (marks: EraseMark[]) => EraseMark[]) => void };
  /** Free crop: the frame (image pixels), the locked shape (width / height, null = free) and where to report changes. */
  crop?: { rect: CropRect; ratio: number | null; onChange: (rect: CropRect) => void };
};

/** How close (screen points) a touch must be to a corner of the crop frame to drag that corner. */
const CORNER_HIT = 30;

/**
 * While a beauty brush is being drawn: a light hint of what it will do (the real effect, applied when the finger
 * lifts, is subtle; a bright white preview made the result look like the stroke had vanished).
 */
const BRUSH_PREVIEW: Record<RetouchEffect, string> = {
  whiten: 'rgba(255,255,255,0.3)',
  lighten: 'rgba(255,236,214,0.3)',
  lips: 'rgba(226,80,112,0.32)',
  blush: 'rgba(240,120,140,0.26)',
  brows: 'rgba(70,45,30,0.3)',
};

/** Translucent red, so the object stays visible under the mark. */
export const ERASE_MARK_COLOR = 'rgba(255, 45, 85, 0.5)';

const MIN_SIZE = 20;

export function layerExtents(layer: TransformableLayer, fonts: EditorFonts) {
  if (layer.kind === 'sticker') return { hw: layer.size / 2, hh: layer.size / 2 };
  const { width, height } = textSize(fonts, layer);
  return { hw: width / 2 + layer.size * 0.15, hh: height / 2 + layer.size * 0.1 };
}

const isTransformable = (l: Layer): l is TransformableLayer => l.kind === 'sticker' || l.kind === 'text';

export function EditorCanvas({ doc, fonts, svgs, mode, pen, brush, selectedId, onSelect, checkpoint, update, compareWith, erase, crop }: Props) {
  const t = useT();
  const [split, setSplit] = useState(0.5);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const iw = doc.image.width();
  const ih = doc.image.height();
  const scale = box.w && box.h ? Math.min(box.w / iw, box.h / ih) : 0;

  // Gesture callbacks outlive a render, so they read the latest values through refs.
  const docRef = useRef(doc);
  docRef.current = doc;
  const selRef = useRef(selectedId);
  selRef.current = selectedId;
  const panStart = useRef<{ id: string; x: number; y: number } | null>(null);
  const pinchStart = useRef<{ id: string; size: number } | null>(null);
  const rotateStart = useRef<{ id: string; rotation: number } | null>(null);
  // The stroke being drawn (pen, beauty brush or erase brush) stays here until the finger lifts, so only the
  // canvas redraws while drawing; the whole editor updating on every move made the stroke lag and jitter.
  const live = useRef<{ kind: 'stroke' | 'retouch' | 'erase'; points: number[]; width: number } | null>(null);
  const [, setLiveTick] = useState(0);
  // Crop frame being dragged (kept here until the finger lifts, like the strokes).
  const cropDrag = useRef<{ handle: CropCorner | 'move'; start: CropRect } | null>(null);
  const liveCrop = useRef<CropRect | null>(null);
  const frame = useRef<number | null>(null);
  const redrawLive = () => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setLiveTick((n) => n + 1);
    });
  };

  // Everything the gesture callbacks need, always current. The gestures themselves are created once per mode:
  // re-creating them on every render made the gesture library drop a handler in the middle of a drag
  // ("No handler for tag …"), since the canvas redraws on every move while drawing or cropping.
  const latest = useRef({ mode, crop, erase, brush, pen, scale, iw, ih, fonts, checkpoint, update, onSelect });
  latest.current = { mode, crop, erase, brush, pen, scale, iw, ih, fonts, checkpoint, update, onSelect };

  const isMove = mode === 'move';
  const comparing = !!compareWith;
  const gesture = useMemo(() => {
    const L = () => latest.current;
    const toImage = (x: number, y: number) => ({ x: x / L().scale, y: y / L().scale });
    const layerAt = (id: string | null) => docRef.current.layers.find((l): l is TransformableLayer => l.id === id && isTransformable(l));
    const hitTest = (x: number, y: number) => {
      const layers = docRef.current.layers;
      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i];
        if (!isTransformable(l)) continue;
        const dx = x - l.x;
        const dy = y - l.y;
        const cos = Math.cos(l.rotation);
        const sin = Math.sin(l.rotation);
        const lx = dx * cos + dy * sin;
        const ly = -dx * sin + dy * cos;
        const { hw, hh } = layerExtents(l, L().fonts);
        if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) return l.id;
      }
      return null;
    };
    const patchLayer = (id: string, patch: Partial<TransformableLayer>) =>
      L().update((d) => ({
        ...d,
        layers: d.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
      }));

    const pan = Gesture.Pan()
      .runOnJS(true)
      .minDistance(isMove ? 2 : 0)
      .onStart((e) => {
        const { mode, crop, erase, brush, pen, scale } = L();
        const p = toImage(e.x, e.y);
        if (mode === 'crop' && crop) {
          const r = crop.rect;
          const corners: [CropCorner, number, number][] = [
            ['nw', r.x, r.y],
            ['ne', r.x + r.w, r.y],
            ['sw', r.x, r.y + r.h],
            ['se', r.x + r.w, r.y + r.h],
          ];
          const near = corners.find(([, cx, cy]) => Math.hypot((cx - p.x) * scale, (cy - p.y) * scale) <= CORNER_HIT);
          const inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
          cropDrag.current = near ? { handle: near[0], start: r } : inside ? { handle: 'move', start: r } : null;
          return;
        }
        const kind = mode === 'erase' && erase ? 'erase' : mode === 'retouch' && brush ? 'retouch' : mode === 'draw' ? 'stroke' : null;
        if (kind) {
          const width = (kind === 'erase' ? erase!.width : kind === 'retouch' ? brush!.width : pen.width) / scale;
          live.current = { kind, points: [p.x, p.y], width };
          redrawLive();
          return;
        }
        const hit = hitTest(p.x, p.y);
        const layer = layerAt(hit ?? (e.numberOfPointers > 1 ? selRef.current : null));
        if (!layer) {
          panStart.current = null;
          return;
        }
        if (layer.id !== selRef.current) L().onSelect(layer.id);
        L().checkpoint();
        panStart.current = { id: layer.id, x: layer.x, y: layer.y };
      })
      .onUpdate((e) => {
        const { crop, scale, iw, ih } = L();
        const drag = cropDrag.current;
        if (drag && crop) {
          const dx = e.translationX / scale;
          const dy = e.translationY / scale;
          liveCrop.current =
            drag.handle === 'move' ? moveCrop(drag.start, dx, dy, iw, ih) : resizeCrop(drag.start, drag.handle, dx, dy, crop.ratio, iw, ih);
          redrawLive();
          return;
        }
        if (live.current) {
          const p = toImage(e.x, e.y);
          live.current.points.push(p.x, p.y);
          redrawLive();
          return;
        }
        const s = panStart.current;
        if (s) patchLayer(s.id, { x: s.x + e.translationX / scale, y: s.y + e.translationY / scale });
      })
      .onFinalize(() => {
        const { crop, erase, brush, pen, checkpoint, update } = L();
        panStart.current = null;
        if (cropDrag.current) {
          cropDrag.current = null;
          if (liveCrop.current) crop?.onChange(liveCrop.current);
          liveCrop.current = null;
          redrawLive();
          return;
        }
        const done = live.current;
        if (!done) return;
        live.current = null;
        redrawLive();
        // One finished stroke = one step in the edit history.
        if (done.kind === 'erase') {
          erase?.onChange((marks) => [...marks, { points: done.points, width: done.width }]);
        } else if (done.kind === 'retouch' && brush) {
          checkpoint();
          update((d) => ({ ...d, layers: [...d.layers, { kind: 'retouch', id: newId(), points: done.points, width: done.width, effect: brush.effect }] }));
        } else if (done.kind === 'stroke') {
          checkpoint();
          update((d) => ({
            ...d,
            layers: [...d.layers, { kind: 'stroke', id: newId(), points: done.points, color: pen.color, width: done.width, pen: pen.kind }],
          }));
        }
      });

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => {
        const layer = layerAt(selRef.current);
        if (!layer) return;
        L().checkpoint();
        pinchStart.current = { id: layer.id, size: layer.size };
      })
      .onUpdate((e) => {
        const s = pinchStart.current;
        if (s) patchLayer(s.id, { size: Math.max(MIN_SIZE, s.size * e.scale) });
      })
      .onFinalize(() => {
        pinchStart.current = null;
      });

    const rotation = Gesture.Rotation()
      .runOnJS(true)
      .onStart(() => {
        const layer = layerAt(selRef.current);
        if (!layer) return;
        L().checkpoint();
        rotateStart.current = { id: layer.id, rotation: layer.rotation };
      })
      .onUpdate((e) => {
        const s = rotateStart.current;
        if (s) patchLayer(s.id, { rotation: s.rotation + e.rotation });
      })
      .onFinalize(() => {
        rotateStart.current = null;
      });

    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, success) => {
        if (!success) return;
        const p = toImage(e.x, e.y);
        L().onSelect(hitTest(p.x, p.y));
      });

    const splitAt = (x: number) => setSplit(Math.min(1, Math.max(0, x / (L().iw * L().scale))));
    const dragSplit = Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => splitAt(e.x))
      .onUpdate((e) => splitAt(e.x));

    return comparing ? dragSplit : !isMove ? pan : Gesture.Exclusive(Gesture.Simultaneous(pan, pinch, rotation), tap);
  }, [isMove, comparing]);

  const drawing = live.current;

  // Drawn on a separate transparent canvas on top, so dragging only redraws these and never the photo underneath.
  const overlay = !compareWith && mode !== 'move';
  // On web, Skia keeps drawing into the old-sized surface when a canvas is resized (after a crop or rotate the
  // new picture showed up shrunk in a corner), so each displayed size gets a fresh canvas.
  const sizeKey = `${Math.round(iw * scale)}x${Math.round(ih * scale)}`;

  return (
    <View style={styles.area} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {scale > 0 && (
        <GestureDetector gesture={gesture}>
          <View style={[styles.frame, { width: iw * scale, height: ih * scale }]}>
            <PhotoLayer key={sizeKey} doc={doc} fonts={fonts} svgs={svgs} scale={scale} compareWith={compareWith ?? null} split={split} selectedId={selectedId} />
            {overlay && (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Canvas key={sizeKey} style={{ width: iw * scale, height: ih * scale }}>
                  <Group transform={[{ scale }]}>
                    {drawing?.kind === 'stroke' && (
                      <Stroke layer={{ kind: 'stroke', id: 'live', points: drawing.points, color: pen.color, width: drawing.width, pen: pen.kind }} />
                    )}
                    {drawing?.kind === 'retouch' && (
                      <Path
                        path={buildStrokePath(drawing.points)}
                        style="stroke"
                        strokeWidth={drawing.width}
                        strokeCap="round"
                        strokeJoin="round"
                        color={BRUSH_PREVIEW[brush?.effect ?? 'whiten']}
                      />
                    )}
                    {mode === 'erase' &&
                      [...(erase?.marks ?? []), ...(drawing?.kind === 'erase' ? [drawing] : [])].map((m, i) => (
                        <Path
                          key={i}
                          path={buildStrokePath(m.points)}
                          style="stroke"
                          strokeWidth={m.width}
                          strokeCap="round"
                          strokeJoin="round"
                          color={ERASE_MARK_COLOR}
                        />
                      ))}
                    {mode === 'crop' && crop && <CropOverlay rect={liveCrop.current ?? crop.rect} iw={iw} ih={ih} scale={scale} />}
                  </Group>
                </Canvas>
              </View>
            )}
            {compareWith && (
              <>
                <View style={[styles.tag, { left: 10 }]}>
                  <Text style={styles.tagText}>{t('common.before')}</Text>
                </View>
                <View style={[styles.tag, { right: 10 }]}>
                  <Text style={styles.tagText}>{t('common.after')}</Text>
                </View>
                <View pointerEvents="none" style={[styles.divider, { left: iw * scale * split - 1 }]} />
                <View pointerEvents="none" style={[styles.handle, { left: iw * scale * split - 18, top: (ih * scale) / 2 - 18 }]}>
                  <Ionicons name="code-outline" size={16} color="#FFFFFF" />
                </View>
              </>
            )}
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'center', margin: 12 },
  // Soft warm shadow on the light editor background (as on the home cards).
  frame: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    shadowColor: '#8B6A3E',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  tag: { position: 'absolute', top: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { fontFamily: font.medium, fontSize: 12, color: '#FFFFFF' },
  divider: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.95)' },
  handle: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** The crop frame drawn over the photo (image pixels; line widths in screen points). */
function CropOverlay({ rect: r, iw, ih, scale }: { rect: CropRect; iw: number; ih: number; scale: number }) {
  const px = 1 / scale;
  const shade = 'rgba(0,0,0,0.5)';
  const arm = Math.min(22 * px, r.w / 3, r.h / 3);
  const corners = Skia.Path.Make();
  for (const [cx, cy, sx, sy] of [
    [r.x, r.y, 1, 1],
    [r.x + r.w, r.y, -1, 1],
    [r.x, r.y + r.h, 1, -1],
    [r.x + r.w, r.y + r.h, -1, -1],
  ]) {
    corners.moveTo(cx + sx * arm, cy);
    corners.lineTo(cx, cy);
    corners.lineTo(cx, cy + sy * arm);
  }
  return (
    <Group>
      <Rect x={0} y={0} width={iw} height={r.y} color={shade} />
      <Rect x={0} y={r.y + r.h} width={iw} height={ih - r.y - r.h} color={shade} />
      <Rect x={0} y={r.y} width={r.x} height={r.h} color={shade} />
      <Rect x={r.x + r.w} y={r.y} width={iw - r.x - r.w} height={r.h} color={shade} />
      {[1, 2].map((i) => (
        <Group key={i}>
          <Line p1={vec(r.x + (r.w * i) / 3, r.y)} p2={vec(r.x + (r.w * i) / 3, r.y + r.h)} color="rgba(255,255,255,0.55)" strokeWidth={px} />
          <Line p1={vec(r.x, r.y + (r.h * i) / 3)} p2={vec(r.x + r.w, r.y + (r.h * i) / 3)} color="rgba(255,255,255,0.55)" strokeWidth={px} />
        </Group>
      ))}
      <Rect x={r.x} y={r.y} width={r.w} height={r.h} color="white" style="stroke" strokeWidth={1.5 * px} />
      <Path path={corners} color="white" style="stroke" strokeWidth={4 * px} strokeCap="square" />
    </Group>
  );
}

/** The photo with its layers, the before/after split and the selection frame. */
const PhotoLayer = memo(function PhotoLayer({
  doc,
  fonts,
  svgs,
  scale,
  compareWith,
  split,
  selectedId,
}: {
  doc: Doc;
  fonts: EditorFonts;
  svgs: Record<string, SkSVG | null>;
  scale: number;
  compareWith: SkImage | null;
  split: number;
  selectedId: string | null;
}) {
  const iw = doc.image.width();
  const ih = doc.image.height();
  const selected = doc.layers.find((l): l is TransformableLayer => l.id === selectedId && isTransformable(l));
  const sel = selected ? layerExtents(selected, fonts) : null;
  return (
    <Canvas style={{ width: iw * scale, height: ih * scale }}>
      <Group transform={[{ scale }]}>
        <Scene doc={doc} fonts={fonts} svgs={svgs} />
        {compareWith && (
          <Group clip={rect(0, 0, iw * split, ih)}>
            <Image image={compareWith} x={0} y={0} width={iw} height={ih} fit="fill" />
          </Group>
        )}
        {!compareWith && selected && sel && (
          <Group transform={[{ translateX: selected.x }, { translateY: selected.y }, { rotate: selected.rotation }]}>
            <RoundedRect
              x={-sel.hw - 6 / scale}
              y={-sel.hh - 6 / scale}
              width={sel.hw * 2 + 12 / scale}
              height={sel.hh * 2 + 12 / scale}
              r={10 / scale}
              color={colors.gold}
              style="stroke"
              strokeWidth={2.5 / scale}
            >
              <DashPathEffect intervals={[10 / scale, 7 / scale]} />
            </RoundedRect>
          </Group>
        )}
      </Group>
    </Canvas>
  );
});
