import { Ionicons } from '@expo/vector-icons';
import { Canvas, DashPathEffect, Group, Image, rect, RoundedRect, type SkFont, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colors, font } from '../theme';
import { Scene, textWidth } from './Scene';
import { newId, type Doc, type Layer, type PenKind, type RetouchEffect, type TransformableLayer } from './types';
import { useT } from '../i18n';

export type PenSettings = { color: string; width: number; kind: PenKind };

type Props = {
  doc: Doc;
  font: SkFont | null;
  svgs: Record<string, SkSVG | null>;
  /** 'retouch' paints a mask for a free beauty effect instead of colored ink. */
  mode: 'move' | 'draw' | 'retouch';
  pen: PenSettings;
  brush?: { effect: RetouchEffect; width: number };
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  checkpoint: () => void;
  update: (fn: (doc: Doc) => Doc) => void;
  /** When set, shows this "before" picture left of a draggable divider instead of editing layers. */
  compareWith?: SkImage | null;
};

const MIN_SIZE = 20;

export function layerExtents(layer: TransformableLayer, font: SkFont | null) {
  if (layer.kind === 'sticker') return { hw: layer.size / 2, hh: layer.size / 2 };
  const tw = font ? textWidth(font, layer) : layer.size * layer.text.length * 0.5;
  return { hw: tw / 2 + layer.size * 0.15, hh: layer.size * 0.55 };
}

const isTransformable = (l: Layer): l is TransformableLayer => l.kind === 'sticker' || l.kind === 'text';

export function EditorCanvas({ doc, font, svgs, mode, pen, brush, selectedId, onSelect, checkpoint, update, compareWith }: Props) {
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
  const drawingId = useRef<string | null>(null);

  const toImage = (x: number, y: number) => ({ x: x / scale, y: y / scale });
  const findLayer = (id: string | null) =>
    docRef.current.layers.find((l): l is TransformableLayer => l.id === id && isTransformable(l));

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
      const { hw, hh } = layerExtents(l, font);
      if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) return l.id;
    }
    return null;
  };

  const patchLayer = (id: string, patch: Partial<TransformableLayer>) =>
    update((d) => ({
      ...d,
      layers: d.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
    }));

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(mode === 'move' ? 2 : 0)
    .onStart((e) => {
      const p = toImage(e.x, e.y);
      if (mode === 'retouch' && brush) {
        checkpoint();
        const id = newId();
        drawingId.current = id;
        update((d) => ({
          ...d,
          layers: [...d.layers, { kind: 'retouch', id, points: [p.x, p.y], width: brush.width / scale, effect: brush.effect }],
        }));
        return;
      }
      if (mode === 'draw') {
        checkpoint();
        const id = newId();
        drawingId.current = id;
        update((d) => ({
          ...d,
          layers: [
            ...d.layers,
            { kind: 'stroke', id, points: [p.x, p.y], color: pen.color, width: pen.width / scale, pen: pen.kind },
          ],
        }));
        return;
      }
      const hit = hitTest(p.x, p.y);
      const layer = findLayer(hit ?? (e.numberOfPointers > 1 ? selRef.current : null));
      if (!layer) {
        panStart.current = null;
        return;
      }
      if (layer.id !== selRef.current) onSelect(layer.id);
      checkpoint();
      panStart.current = { id: layer.id, x: layer.x, y: layer.y };
    })
    .onUpdate((e) => {
      if (mode !== 'move') {
        const id = drawingId.current;
        const p = toImage(e.x, e.y);
        update((d) => ({
          ...d,
          layers: d.layers.map((l) =>
            l.id === id && (l.kind === 'stroke' || l.kind === 'retouch') ? { ...l, points: [...l.points, p.x, p.y] } : l,
          ),
        }));
        return;
      }
      const s = panStart.current;
      if (s) patchLayer(s.id, { x: s.x + e.translationX / scale, y: s.y + e.translationY / scale });
    })
    .onFinalize(() => {
      drawingId.current = null;
      panStart.current = null;
    });

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      const layer = findLayer(selRef.current);
      if (!layer) return;
      checkpoint();
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
      const layer = findLayer(selRef.current);
      if (!layer) return;
      checkpoint();
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
      onSelect(hitTest(p.x, p.y));
    });

  const dragSplit = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => setSplit(Math.min(1, Math.max(0, e.x / (iw * scale)))))
    .onUpdate((e) => setSplit(Math.min(1, Math.max(0, e.x / (iw * scale)))));

  const gesture = compareWith
    ? dragSplit
    : mode !== 'move'
      ? pan
      : Gesture.Exclusive(Gesture.Simultaneous(pan, pinch, rotation), tap);

  const selected = findLayer(selectedId);
  const sel = selected ? layerExtents(selected, font) : null;

  return (
    <View style={styles.area} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {scale > 0 && (
        <GestureDetector gesture={gesture}>
          <View style={[styles.frame, { width: iw * scale, height: ih * scale }]}>
            <Canvas style={{ width: iw * scale, height: ih * scale }}>
              <Group transform={[{ scale }]}>
                <Scene doc={doc} font={font} svgs={svgs} />
                {compareWith && (
                  <Group clip={rect(0, 0, iw * split, ih)}>
                    <Image image={compareWith} x={0} y={0} width={iw} height={ih} fit="fill" />
                  </Group>
                )}
                {!compareWith && selected && sel && (
                  <Group
                    transform={[{ translateX: selected.x }, { translateY: selected.y }, { rotate: selected.rotation }]}
                  >
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
  frame: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000000',
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
