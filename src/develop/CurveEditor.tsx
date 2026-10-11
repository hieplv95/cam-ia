import { Canvas, Circle, Group, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colors, font } from '../theme';
import { curveAt, type CurveChannel } from './types';
import { useT, type MessageKey } from '../i18n';

const channels: { id: CurveChannel; label: MessageKey | 'RGB'; color: string }[] = [
  { id: 'rgb', label: 'RGB', color: colors.text },
  { id: 'r', label: 'curve.r', color: '#F04438' },
  { id: 'g', label: 'curve.g', color: '#32C25C' },
  { id: 'b', label: 'curve.b', color: '#3B82F6' },
];

const PAD = 10;

/** Tone curve with 5 draggable points (fixed x positions, drag up/down). */
export function CurveEditor({
  curves,
  onChange,
  onStart,
}: {
  curves: Record<CurveChannel, number[]>;
  onChange: (channel: CurveChannel, points: number[]) => void;
  /** A drag begins (the editor records one undo step per drag). */
  onStart?: () => void;
}) {
  const t = useT();
  const [channel, setChannel] = useState<CurveChannel>('rgb');
  const [box, setBox] = useState({ w: 0, h: 0 });
  const dragging = useRef<number | null>(null);
  const points = curves[channel];
  const color = channels.find((c) => c.id === channel)!.color;

  const w = box.w - PAD * 2;
  const h = box.h - PAD * 2;
  const px = (x: number) => PAD + x * w;
  const py = (y: number) => PAD + (1 - y) * h;

  const setPoint = (i: number, y: number) => {
    const next = [...points];
    next[i] = Math.min(1, Math.max(0, 1 - (y - PAD) / h));
    onChange(channel, next);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => {
      onStart?.();
      dragging.current = Math.round(Math.min(1, Math.max(0, (e.x - PAD) / w)) * 4);
      setPoint(dragging.current, e.y);
    })
    .onUpdate((e) => dragging.current !== null && setPoint(dragging.current, e.y))
    .onFinalize(() => {
      dragging.current = null;
    });

  const path = Skia.Path.Make();
  if (w > 0) {
    for (let k = 0; k <= 48; k++) {
      const x = k / 48;
      if (k === 0) path.moveTo(px(x), py(curveAt(points, x)));
      else path.lineTo(px(x), py(curveAt(points, x)));
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.channels}>
        {channels.map((c) => (
          <Pressable key={c.id} onPress={() => setChannel(c.id)} style={[styles.chip, channel === c.id && styles.chipActive]}>
            <View style={[styles.dot, { backgroundColor: c.color }]} />
            <Text style={[styles.chipText, channel === c.id && { color: colors.gold }]}>{c.label === 'RGB' ? 'RGB' : t(c.label)}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => onChange(channel, [0, 0.25, 0.5, 0.75, 1])} style={styles.chip}>
          <Text style={styles.chipText}>{t('common.reset')}</Text>
        </Pressable>
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.area} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {w > 0 && (
            <Canvas style={{ width: box.w, height: box.h }}>
              {[0.25, 0.5, 0.75].map((g) => (
                <Line key={`v${g}`} p1={vec(px(g), PAD)} p2={vec(px(g), PAD + h)} color={colors.border} strokeWidth={1} />
              ))}
              {[0.25, 0.5, 0.75].map((g) => (
                <Line key={`h${g}`} p1={vec(PAD, py(g))} p2={vec(PAD + w, py(g))} color={colors.border} strokeWidth={1} />
              ))}
              <Line p1={vec(px(0), py(0))} p2={vec(px(1), py(1))} color={colors.textMute} strokeWidth={1} opacity={0.5} />
              <Path path={path} style="stroke" strokeWidth={2} color={color} />
              {points.map((y, i) => (
                <Group key={i}>
                  <Circle cx={px(i / 4)} cy={py(y)} r={6} color={colors.bg} />
                  <Circle cx={px(i / 4)} cy={py(y)} r={6} color={color} style="stroke" strokeWidth={2} />
                </Group>
              ))}
            </Canvas>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 8 },
  channels: { flexDirection: 'row', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: font.medium, fontSize: 12, color: colors.text },
  area: { flex: 1, minHeight: 110, borderRadius: 12, backgroundColor: colors.surface2, overflow: 'hidden' },
});
