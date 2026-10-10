import { Ionicons } from '@expo/vector-icons';
import { Canvas, Group, Image as SkImageNode, rect, type SkImage } from '@shopify/react-native-skia';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colors, font } from './theme';
import { useT } from './i18n';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Draws the AI result over the original at the chosen strength. */
export function Blend({ original, result, intensity, width, height }: { original: SkImage; result: SkImage; intensity: number; width: number; height: number }) {
  return (
    <Group>
      <SkImageNode image={original} x={0} y={0} width={width} height={height} fit="fill" />
      <SkImageNode image={result} x={0} y={0} width={width} height={height} fit="fill" opacity={intensity} />
    </Group>
  );
}

/**
 * The photo with a draggable Trước / Sau divider once there is a result.
 * Fills the available space; `comparing` shows only the original.
 */
export function CompareView({
  original,
  result,
  intensity = 1,
  comparing = false,
  busy,
  hint,
}: {
  original: SkImage;
  result: SkImage | null;
  intensity?: number;
  comparing?: boolean;
  busy: string | null;
  /** Shown over the photo before the first result. */
  hint?: string;
}) {
  const t = useT();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [split, setSplit] = useState(0.5);
  const iw = original.width();
  const ih = original.height();
  const scale = box.w && box.h ? Math.min(box.w / iw, box.h / ih) : 0;
  const dw = iw * scale;
  const dh = ih * scale;
  const showAfter = !!result && !comparing;

  const drag = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .enabled(showAfter)
    .onBegin((e) => setSplit(clamp01(e.x / dw)))
    .onUpdate((e) => setSplit(clamp01(e.x / dw)));

  return (
    <View style={styles.area} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {scale > 0 && (
        <GestureDetector gesture={drag}>
          <View style={[styles.photo, { width: dw, height: dh }]}>
            <Canvas style={{ width: dw, height: dh }}>
              <SkImageNode image={original} x={0} y={0} width={dw} height={dh} fit="fill" />
              {showAfter && (
                // "Before" on the left of the divider, "after" on the right.
                <Group clip={rect(dw * split, 0, dw * (1 - split), dh)}>
                  <Blend original={original} result={result} intensity={intensity} width={dw} height={dh} />
                </Group>
              )}
            </Canvas>

            {showAfter && (
              <>
                <View style={[styles.tag, { left: 10 }]}>
                  <Text style={styles.tagText}>{t('common.before')}</Text>
                </View>
                <View style={[styles.tag, { right: 10 }]}>
                  <Text style={styles.tagText}>{t('common.after')}</Text>
                </View>
                <View pointerEvents="none" style={[styles.divider, { left: dw * split - 1 }]} />
                <View pointerEvents="none" style={[styles.handle, { left: dw * split - 17, top: dh / 2 - 17 }]}>
                  <Ionicons name="code-outline" size={16} color="#FFFFFF" />
                </View>
              </>
            )}
            {comparing && result && (
              <View style={[styles.tag, { left: 10 }]}>
                <Text style={styles.tagText}>{t('common.original')}</Text>
              </View>
            )}
            {!result && !busy && hint && (
              <View style={styles.hint}>
                <Text style={styles.hintText}>{hint}</Text>
              </View>
            )}
            {busy && (
              <View style={styles.busy}>
                <ActivityIndicator color={colors.gold} />
                <Text style={styles.busyText}>{busy}</Text>
              </View>
            )}
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photo: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface2 },
  tag: {
    position: 'absolute',
    top: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontFamily: font.medium, fontSize: 12, color: '#FFFFFF' },
  divider: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.9)' },
  handle: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 14,
    padding: 10,
  },
  hintText: { fontFamily: font.medium, fontSize: 13, color: '#FFFFFF', textAlign: 'center' },
  busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  busyText: { fontFamily: font.medium, fontSize: 14, color: '#FFFFFF', textAlign: 'center', paddingHorizontal: 20 },
});
