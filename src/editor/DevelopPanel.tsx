import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CurveEditor } from '../develop/CurveEditor';
import { ToneSlider } from '../develop/ToneSlider';
import { colorSliders, defaultDevelop, detailSliders, hslRanges, isDefault, lightSliders, type Develop, type HslRange } from '../develop/types';
import { useT } from '../i18n';
import { Icon, type IconSpec } from '../icons';
import { font } from '../theme';
import { filterName, filters } from './filters';
import { ec, Pill } from './ui';

type Section = 'light' | 'color' | 'curves' | 'hsl' | 'detail';

const sections: { id: Section; icon: IconSpec }[] = [
  { id: 'light', icon: { set: 'ion', name: 'sunny-outline' } },
  { id: 'color', icon: { set: 'ion', name: 'color-filter-outline' } },
  { id: 'curves', icon: { set: 'mci', name: 'chart-bell-curve-cumulative' } },
  { id: 'hsl', icon: { set: 'mci', name: 'palette-outline' } },
  { id: 'detail', icon: { set: 'ion', name: 'triangle-outline' } },
];

const hslColor = (deg: number, s = 85, l = 55) => `hsl(${((deg % 360) + 360) % 360}, ${s}%, ${l}%)`;

/**
 * "Điều chỉnh" in the editor: the same color tools as the separate color screen (light, color, curves, HSL,
 * detail), the quick color looks and a reset. `onStart` marks the beginning of a drag (one undo step),
 * `onChange` follows the drag, `onCommit` is a single change (a look, the reset).
 */
export function DevelopPanel({
  develop,
  lookThumbs,
  onStart,
  onChange,
  onCommit,
}: {
  develop: Develop;
  lookThumbs: Record<string, string>;
  onStart: () => void;
  onChange: (fn: (d: Develop) => Develop) => void;
  onCommit: (fn: (d: Develop) => Develop) => void;
}) {
  const t = useT();
  const [section, setSection] = useState<Section>('light');
  const [hslRange, setHslRange] = useState<HslRange>('orange');
  const range = hslRanges.find((r) => r.id === hslRange)!;
  const hsl = develop.hsl[hslRange];

  const set = <G extends 'light' | 'color' | 'detail'>(group: G, key: keyof Develop[G], v: number) =>
    onChange((d) => ({ ...d, [group]: { ...d[group], [key]: v } }));
  const setHsl = (key: 'hue' | 'sat' | 'lum', v: number) =>
    onChange((d) => ({ ...d, hsl: { ...d.hsl, [hslRange]: { ...d.hsl[hslRange], [key]: v } } }));

  // Reset brings the colors back to normal; the beauty settings (Làm đẹp tab) stay as they are.
  const colorsUntouched = isDefault({ ...develop, beauty: defaultDevelop().beauty });

  const sliders = section === 'light' ? lightSliders : section === 'color' ? colorSliders : section === 'detail' ? detailSliders : null;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionsRow} contentContainerStyle={styles.sections}>
        {sections.map((s) => (
          <Pill key={s.id} label={t(`adjust.tab.${s.id}`)} icon={s.icon} active={section === s.id} onPress={() => setSection(s.id)} />
        ))}
      </ScrollView>

      <View style={styles.body}>
        {section === 'curves' ? (
          <CurveEditor
            curves={develop.curves}
            onStart={onStart}
            onChange={(ch, pts) => onChange((d) => ({ ...d, curves: { ...d.curves, [ch]: pts } }))}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.sliders} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {sliders?.map((s) => (
              <ToneSlider
                key={s.key}
                label={t(s.label)}
                min={s.min}
                max={s.max}
                gradient={s.gradient}
                value={(develop[section as 'light' | 'color' | 'detail'] as Record<string, number>)[s.key]}
                onStart={onStart}
                onChange={(v) => set(section as 'light', s.key as keyof Develop['light'], v)}
              />
            ))}
            {section === 'hsl' && (
              <>
                <View style={styles.hslDots}>
                  {hslRanges.map((r) => (
                    <Pressable
                      key={r.id}
                      accessibilityLabel={t(r.label)}
                      onPress={() => setHslRange(r.id)}
                      style={[styles.hslRing, hslRange === r.id && { borderColor: ec.text }]}
                    >
                      <View style={[styles.hslDot, { backgroundColor: r.color }]} />
                    </Pressable>
                  ))}
                </View>
                <ToneSlider
                  label={t('develop.hue', { range: t(range.label) })}
                  min={-100}
                  max={100}
                  value={hsl.hue}
                  gradient={[hslColor(range.center - 30), hslColor(range.center), hslColor(range.center + 30)]}
                  onStart={onStart}
                  onChange={(v) => setHsl('hue', v)}
                />
                <ToneSlider
                  label={t('develop.hslSat')}
                  min={-100}
                  max={100}
                  value={hsl.sat}
                  gradient={[hslColor(range.center, 0), hslColor(range.center, 95)]}
                  onStart={onStart}
                  onChange={(v) => setHsl('sat', v)}
                />
                <ToneSlider
                  label={t('develop.hslLum')}
                  min={-100}
                  max={100}
                  value={hsl.lum}
                  gradient={[hslColor(range.center, 80, 12), hslColor(range.center), hslColor(range.center, 80, 92)]}
                  onStart={onStart}
                  onChange={(v) => setHsl('lum', v)}
                />
              </>
            )}
          </ScrollView>
        )}
      </View>

      <View style={styles.bottom}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.looks} style={{ flex: 1 }}>
          {filters.map((f) => (
            <Pressable key={f.id} accessibilityLabel={filterName(f.id)} onPress={() => onCommit((d) => ({ ...d, look: f.id }))}>
              <View style={[styles.look, develop.look === f.id && styles.lookActive]}>
                {lookThumbs[f.id] ? <Image source={{ uri: lookThumbs[f.id] }} style={styles.lookImg} /> : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          disabled={colorsUntouched}
          onPress={() => onCommit((d) => ({ ...defaultDevelop(), beauty: d.beauty }))}
          style={[styles.reset, colorsUntouched && { opacity: 0.4 }]}
          accessibilityLabel={t('common.reset')}
        >
          <Icon icon={{ set: 'ion', name: 'refresh' }} size={16} color={ec.text} />
          <Text style={styles.resetText}>{t('common.reset')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 8 },
  // A horizontal ScrollView grows by default on the web: keep the row of section pills at its own height.
  sectionsRow: { flexGrow: 0, flexShrink: 0 },
  sections: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  body: { flex: 1, minHeight: 0, paddingHorizontal: 14 },
  sliders: { gap: 6, paddingBottom: 4 },
  hslDots: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  hslRing: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  hslDot: { width: 18, height: 18, borderRadius: 9 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  looks: { gap: 6 },
  look: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', backgroundColor: ec.surface2, borderWidth: 2, borderColor: 'transparent' },
  lookActive: { borderColor: ec.gold },
  lookImg: { width: '100%', height: '100%' },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ec.border,
    backgroundColor: ec.surface,
  },
  resetText: { fontFamily: font.medium, fontSize: 12.5, color: ec.text },
});
