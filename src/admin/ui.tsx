import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { cardShadow, colors, font } from '../theme';
import { num } from './labels';

/** Building blocks of the admin page: cards, number tiles, a bar chart and table rows. */

type IonName = ComponentProps<typeof Ionicons>['name'];

export function Card({ title, subtitle, right, children, style }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Cards side by side on wide screens, stacked on phones. */
export function Grid({ children, min = 340 }: { children: ReactNode; min?: number }) {
  return <View style={styles.grid}>{wrap(children, min)}</View>;
}

const wrap = (children: ReactNode, min: number) =>
  (Array.isArray(children) ? children : [children]).filter(Boolean).map((c, i) => (
    <View key={i} style={{ flexGrow: 1, flexBasis: min, minWidth: 0 }}>
      {c}
    </View>
  ));

export type Tone = 'gold' | 'green' | 'red' | 'blue' | 'plain';
const toneColor: Record<Tone, string> = { gold: colors.gold, green: '#2E9E6A', red: colors.danger, blue: '#3E7BD6', plain: colors.textSoft };

export function Stat({ icon, label, value, sub, tone = 'gold' }: { icon: IonName; label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: `${toneColor[tone]}1F` }]}>
        <Ionicons name={icon} size={18} color={toneColor[tone]} />
      </View>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={styles.statSub} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.statGrid}>{children}</View>;
}

/**
 * Daily bars; `extra` is drawn on top in red (e.g. failed AI requests). Tapping or hovering a bar shows its numbers.
 */
export function BarChart({
  data,
  color = colors.gold,
  unit,
  extraUnit,
  average,
  averageOver,
  peakOnly,
}: {
  data: { label: string; value: number; extra?: number }[];
  color?: string;
  unit: string;
  extraUnit?: string;
  /** Show the daily average instead of the total (for counts that don't add up, like active devices). */
  average?: boolean;
  /** Bars the average is taken over (e.g. only the hours already past today); all bars by default. */
  averageOver?: number;
  /** Only the highest bar (for values like "most people at once", which neither add up nor average well). */
  peakOnly?: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value + (d.extra ?? 0)));
  const shown = picked !== null ? data[picked] : null;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <View>
      <Text style={styles.chartInfo}>
        {shown
          ? `${shown.label}: ${num(shown.value)} ${unit}${shown.extra ? ` · ${num(shown.extra)} ${extraUnit}` : ''}`
          : peakOnly
            ? `Cao nhất ${num(max)} ${unit}`
            : `${average ? `Trung bình ${num(Math.round(total / Math.max(1, averageOver ?? data.length)))}` : `Tổng ${num(total)}`} ${unit} · cao nhất ${num(max)}`}
      </Text>
      <View style={styles.chart}>
        {data.map((d, i) => (
          <Pressable
            key={d.label + i}
            style={styles.barSlot}
            onPress={() => setPicked(picked === i ? null : i)}
            onHoverIn={() => setPicked(i)}
            onHoverOut={() => setPicked(null)}
            accessibilityLabel={`${d.label}: ${d.value} ${unit}`}
          >
            {d.extra ? <View style={[styles.bar, { height: `${(d.extra / max) * 100}%`, backgroundColor: colors.danger, opacity: 0.8 }]} /> : null}
            <View
              style={[
                styles.bar,
                { height: `${(d.value / max) * 100}%`, backgroundColor: color, opacity: picked === null || picked === i ? 1 : 0.45 },
                d.value > 0 && { minHeight: 2 },
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{data[0]?.label}</Text>
        {data.length > 2 && <Text style={styles.axisText}>{data[Math.floor(data.length / 2)].label}</Text>}
        <Text style={styles.axisText}>{data[data.length - 1]?.label}</Text>
      </View>
    </View>
  );
}

/** A label with a share bar underneath and numbers on the right. */
export function ShareRow({ label, value, of, right, onPress }: { label: string; value: number; of: number; right?: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.shareRow, pressed && { opacity: 0.7 }]}>
      <View style={styles.shareTop}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.rowValue}>{right ?? num(value)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${of ? Math.max(2, (value / of) * 100) : 0}%` }]} />
      </View>
    </Pressable>
  );
}

export function Row({ label, value, sub, valueColor, onPress }: { label: string; value?: string; sub?: string; valueColor?: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMute} /> : null}
    </Pressable>
  );
}

export const Empty = ({ text }: { text: string }) => <Text style={styles.empty}>{text}</Text>;

export function Badge({ text, tone = 'plain' }: { text: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${toneColor[tone]}1F` }]}>
      <Text style={[styles.badgeText, { color: toneColor[tone] }]}>{text}</Text>
    </View>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={String(o.id)} onPress={() => onChange(o.id)} style={[styles.segment, o.id === value && styles.segmentOn]}>
          <Text style={[styles.segmentText, o.id === value && styles.segmentTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Button({ label, icon, onPress, tone = 'gold', disabled }: { label: string; icon?: IonName; onPress: () => void; tone?: 'gold' | 'red' | 'plain'; disabled?: boolean }) {
  const c = tone === 'red' ? colors.danger : tone === 'gold' ? colors.goldDeep : colors.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { borderColor: `${c}55` }, (pressed || disabled) && { opacity: 0.6 }]}
    >
      {icon ? <Ionicons name={icon} size={16} color={c} /> : null}
      <Text style={[styles.buttonText, { color: c }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border, ...cardShadow },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontFamily: font.bold, fontSize: 15, color: colors.text },
  cardSub: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statLabel: { fontFamily: font.medium, fontSize: 12, color: colors.textSoft },
  statValue: { fontFamily: font.bold, fontSize: 22, color: colors.text },
  statSub: { fontFamily: font.regular, fontSize: 11.5, color: colors.textMute },
  chartInfo: { fontFamily: font.medium, fontSize: 12, color: colors.textSoft, marginBottom: 8 },
  chart: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontFamily: font.regular, fontSize: 11, color: colors.textMute },
  shareRow: { gap: 6, paddingVertical: 4 },
  shareTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.gold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, fontFamily: font.medium, fontSize: 13.5, color: colors.text },
  rowSub: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft, marginTop: 2 },
  rowValue: { fontFamily: font.semi, fontSize: 13.5, color: colors.text, textAlign: 'right' },
  empty: { fontFamily: font.regular, fontSize: 13, color: colors.textMute, paddingVertical: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontFamily: font.semi, fontSize: 11 },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%', backgroundColor: colors.surface2, borderRadius: 12, padding: 3, alignSelf: 'flex-start' },
  segment: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  segmentOn: { backgroundColor: colors.surface, ...cardShadow, shadowOpacity: 0.06 },
  segmentText: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  segmentTextOn: { color: colors.text, fontFamily: font.semi },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  buttonText: { fontFamily: font.semi, fontSize: 13.5 },
});
