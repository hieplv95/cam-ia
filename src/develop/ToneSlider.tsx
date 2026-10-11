import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colors, font } from '../theme';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  gradient?: readonly string[];
  onChange: (v: number) => void;
  /** A drag or tap begins (the editor records one undo step per gesture). */
  onStart?: () => void;
};

const THUMB = 18;

/** Slider with a colored track; centered sliders show a signed value. Double-tap resets to 0. */
export function ToneSlider({ label, value, min, max, gradient, onChange, onStart }: Props) {
  const [width, setWidth] = useState(0);
  const centered = min < 0;
  const frac = (value - min) / (max - min);

  const toValue = (x: number) => {
    const f = Math.min(1, Math.max(0, (x - THUMB / 2) / Math.max(1, width - THUMB)));
    return Math.round(min + f * (max - min));
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onBegin((e) => {
      onStart?.();
      onChange(toValue(e.x));
    })
    .onUpdate((e) => onChange(toValue(e.x)));
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e, ok) => {
      if (!ok) return;
      onStart?.();
      onChange(toValue(e.x));
    });
  const reset = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(2)
    .onEnd((_, ok) => {
      if (!ok) return;
      onStart?.();
      onChange(0);
    });

  const shown = centered && value > 0 ? `+${value}` : `${value}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, value !== 0 && { color: colors.gold }]}>{shown}</Text>
      </View>
      <GestureDetector gesture={Gesture.Race(pan, Gesture.Exclusive(reset, tap))}>
        <View style={styles.hit} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {gradient ? (
            <LinearGradient colors={gradient as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.track} />
          ) : (
            <View style={[styles.track, { backgroundColor: colors.border }]}>
              <View
                style={{
                  position: 'absolute',
                  height: '100%',
                  backgroundColor: colors.gold,
                  left: centered ? `${Math.min(frac, 0.5) * 100}%` : 0,
                  width: centered ? `${Math.abs(frac - 0.5) * 100}%` : `${frac * 100}%`,
                }}
              />
            </View>
          )}
          {centered && <View style={styles.tick} />}
          {width > 0 && <View style={[styles.thumb, { left: frac * (width - THUMB) }]} />}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: font.regular, fontSize: 13, color: colors.text },
  value: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft, minWidth: 36, textAlign: 'right' },
  hit: { height: 24, justifyContent: 'center' },
  track: { height: 3, borderRadius: 2, marginHorizontal: THUMB / 2, overflow: 'hidden' },
  tick: { position: 'absolute', left: '50%', width: 1, height: 9, marginLeft: -0.5, backgroundColor: colors.textMute },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.gold,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
