import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Icon, type IconSpec } from '../icons';
import { font } from '../theme';
import { HScroll } from '../HScroll';

/** The editor uses a dark palette so photo colors read accurately; the gold accent matches the rest of Cami. */
export const ec = {
  bg: '#0F0E0D',
  surface: '#1A1816',
  surface2: '#24211E',
  border: '#36312B',
  text: '#F4EFE7',
  textSoft: '#A8A097',
  textMute: '#6E675F',
  gold: '#D8B98C',
  goldSoft: 'rgba(216,185,140,0.16)',
  onGold: '#1A1408',
};

/** Text tabs with an underline under the active one (Cơ bản · Làm đẹp · …). */
export function CategoryTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T | null;
  onChange: (id: T) => void;
}) {
  return (
    <HScroll tone="dark" contentContainerStyle={styles.tabs}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <Pressable key={t.id} onPress={() => onChange(t.id)} style={styles.tab}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            <View style={[styles.underline, active && { backgroundColor: ec.gold }]} />
          </Pressable>
        );
      })}
    </HScroll>
  );
}

/** Round icon button with a label under it. */
export function ToolCircle({ icon, label, active, onPress }: { icon: IconSpec; label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tool, pressed && { opacity: 0.7 }]}>
      <View style={[styles.circle, active && styles.circleActive]}>
        <Icon icon={icon} size={21} color={active ? ec.gold : ec.text} />
      </View>
      <Text numberOfLines={2} style={[styles.toolLabel, active && { color: ec.gold }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ToolRow({ children }: { children: ReactNode }) {
  return (
    <HScroll tone="dark" contentContainerStyle={styles.toolRow}>
      {children}
    </HScroll>
  );
}

const THUMB = 20;

/** Track + thumb + signed value ("+20"). Double-tap resets to 0. */
export function EditorSlider({
  value,
  min,
  max,
  onStart,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onStart?: () => void;
  onChange: (v: number) => void;
  label?: string;
}) {
  const [width, setWidth] = useState(0);
  const centered = min < 0;
  const frac = (value - min) / (max - min);
  const toValue = (x: number) => Math.round(min + Math.min(1, Math.max(0, (x - THUMB / 2) / Math.max(1, width - THUMB))) * (max - min));

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-3, 3])
    .failOffsetY([-14, 14])
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

  const fillLeft = centered ? Math.min(frac, 0.5) : 0;
  const fillWidth = centered ? Math.abs(frac - 0.5) : frac;
  const shown = centered && value > 0 ? `+${value}` : `${value}`;

  return (
    <View style={styles.sliderRow}>
      {label ? <Text style={styles.sliderLabel}>{label}</Text> : null}
      <GestureDetector gesture={Gesture.Race(pan, Gesture.Exclusive(reset, tap))}>
        <View style={styles.sliderHit} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={styles.track}>
            <View style={[styles.fill, { left: `${fillLeft * 100}%`, width: `${fillWidth * 100}%` }]} />
          </View>
          {centered && <View style={styles.tick} />}
          {width > 0 && <View style={[styles.thumb, { left: frac * (width - THUMB) }]} />}
        </View>
      </GestureDetector>
      <Text style={[styles.sliderValue, value !== 0 && { color: ec.gold }]}>{shown}</Text>
    </View>
  );
}

/** Small pill choice used for crop ratios, pen sizes, categories… */
export function Pill({ label, active, onPress, icon }: { label: string; active?: boolean; onPress: () => void; icon?: IconSpec }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      {icon ? <Icon icon={icon} size={15} color={active ? ec.onGold : ec.textSoft} /> : null}
      <Text style={[styles.pillText, active && { color: ec.onGold }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 12, gap: 18 },
  tab: { alignItems: 'center', paddingTop: 4 },
  tabText: { fontFamily: font.medium, fontSize: 14, color: ec.textSoft },
  tabTextActive: { color: ec.text, fontFamily: font.semi },
  underline: { width: 22, height: 2.5, borderRadius: 2, marginTop: 6, backgroundColor: 'transparent' },
  toolRow: { paddingHorizontal: 10, gap: 4 },
  tool: { width: 68, alignItems: 'center', gap: 6 },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ec.surface2,
    borderWidth: 1,
    borderColor: ec.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: { borderColor: ec.gold, backgroundColor: ec.goldSoft },
  toolLabel: { fontFamily: font.regular, fontSize: 11, lineHeight: 14, color: ec.textSoft, textAlign: 'center' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  sliderLabel: { fontFamily: font.regular, fontSize: 12, color: ec.textSoft, width: 66 },
  sliderHit: { flex: 1, height: 30, justifyContent: 'center' },
  track: { height: 3, borderRadius: 2, marginHorizontal: THUMB / 2, backgroundColor: ec.border, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, backgroundColor: ec.gold },
  tick: { position: 'absolute', left: '50%', width: 1, height: 10, marginLeft: -0.5, backgroundColor: ec.textMute },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  sliderValue: { fontFamily: font.semi, fontSize: 13, color: ec.textSoft, width: 38, textAlign: 'right' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: ec.surface2,
    borderWidth: 1,
    borderColor: ec.border,
  },
  pillActive: { backgroundColor: ec.gold, borderColor: ec.gold },
  pillText: { fontFamily: font.medium, fontSize: 13, color: ec.textSoft },
});
