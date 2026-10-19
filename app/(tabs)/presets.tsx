import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { removeCustomPreset, useCustomPresets } from '@/src/develop/customPresets';
import { developPresets, presetCategories, presetDescription, type DevelopPreset, type PresetCategory } from '@/src/develop/presets';
import { Dialog } from '@/src/Dialog';
import { PresetCard, usePresetThumbnail, useSavedPresets } from '@/src/develop/PresetCard';
import { ToneSlider } from '@/src/develop/ToneSlider';
import { usePhotoSource } from '@/src/photoSource';
import { colors, font, goldGradient, MAX_CONTENT_WIDTH } from '@/src/theme';
import { AppHeader } from '@/src/ui';
import { HScroll } from '@/src/HScroll';
import { useT } from '@/src/i18n';

type Tab = PresetCategory | 'saved' | 'mine';

const GAP = 10;
const SHEET_SPACE = 210;

/** Lowercase without Vietnamese accents, so "den trang" finds "Đen trắng". */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

export default function Presets() {
  const t = useT();
  const { choose } = usePhotoSource();
  const { saved, toggle } = useSavedPresets();
  const [tab, setTab] = useState<Tab>('portrait');
  const [selectedId, setSelectedId] = useState('softglow');
  const [intensity, setIntensity] = useState(70);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [width, setWidth] = useState(0);
  const custom = useCustomPresets();
  const [removing, setRemoving] = useState<DevelopPreset | null>(null);
  const all = [...custom, ...developPresets];

  const columns = width > 560 ? 3 : 2;
  const cardWidth = width ? (width - GAP * (columns - 1)) / columns : 0;

  const q = fold(query.trim());
  const list = q
    ? all.filter((p) => fold(`${p.name} ${presetDescription(p)}`).includes(q))
    : tab === 'mine'
      ? custom
      : tab === 'saved'
        ? developPresets.filter((p) => saved.includes(p.id))
        : developPresets.filter((p) => p.categories.includes(tab));
  const selected = all.find((p) => p.id === selectedId) ?? developPresets[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: SHEET_SPACE }} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <AppHeader />

          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('presets.title')}</Text>
              <Text style={styles.sub}>{t('presets.sub')}</Text>
            </View>
            <Pressable
              accessibilityLabel={t('presets.search')}
              onPress={() => {
                setSearching((s) => !s);
                setQuery('');
              }}
              style={[styles.searchBtn, searching && { borderColor: colors.gold }]}
            >
              <Ionicons name={searching ? 'close' : 'search'} size={18} color={searching ? colors.gold : colors.text} />
            </Pressable>
          </View>

          {searching && (
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={t('presets.searchPlaceholder')}
              placeholderTextColor={colors.textMute}
              style={styles.search}
            />
          )}

          {!q && (
            <HScroll contentContainerStyle={styles.chips}>
              {[{ id: 'mine' as const, label: 'common.mine' as const }, ...presetCategories, { id: 'saved' as const, label: 'presets.saved' as const }].map((c) => {
                const active = tab === c.id;
                return (
                  <Pressable key={c.id} onPress={() => setTab(c.id)} style={[styles.chip, active && styles.chipActive]}>
                    {c.id === 'saved' && <Ionicons name="bookmark" size={12} color={active ? colors.onGold : colors.textSoft} />}
                    {c.id === 'mine' && <Ionicons name="color-palette" size={12} color={active ? colors.onGold : colors.textSoft} />}
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(c.label)}</Text>
                  </Pressable>
                );
              })}
            </HScroll>
          )}

          <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {cardWidth > 0 &&
              list.map((p) => (
                <PresetCard
                  key={p.id}
                  preset={p}
                  width={cardWidth}
                  selected={p.id === selected.id}
                  saved={saved.includes(p.id)}
                  onPress={() => setSelectedId(p.id)}
                  onToggleSave={p.custom ? undefined : () => toggle(p.id)}
                  onRemove={p.custom ? () => setRemoving(p) : undefined}
                />
              ))}
          </View>
          {list.length === 0 && (
            <Text style={styles.empty}>
              {q
                ? t('presets.notFound')
                : tab === 'mine'
                  ? t('presets.mineEmpty')
                  : t('presets.savedEmpty')}
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.sheetWrap} pointerEvents="box-none">
        <SelectedSheet
          preset={selected}
          saved={selected.custom ? undefined : saved.includes(selected.id)}
          intensity={intensity}
          onIntensity={setIntensity}
          onToggleSave={() => toggle(selected.id)}
          onApply={() => choose({ type: 'adjust', preset: selected.id, intensity })}
        />
      </View>

      <Dialog
        visible={!!removing}
        title={t('presets.removeTitle', { name: removing?.name ?? '' })}
        message={t('presets.removeMsg')}
        onClose={() => setRemoving(null)}
        actions={[
          {
            label: t('presets.removeRecipe'),
            destructive: true,
            onPress: () => {
              if (removing) removeCustomPreset(removing.id);
              if (removing?.id === selectedId) setSelectedId('softglow');
              setRemoving(null);
            },
          },
          { label: t('common.keep'), onPress: () => setRemoving(null) },
        ]}
      />
    </SafeAreaView>
  );
}

function SelectedSheet({
  preset,
  saved,
  intensity,
  onIntensity,
  onToggleSave,
  onApply,
}: {
  preset: DevelopPreset;
  /** Undefined for the user's own recipes, which can't be bookmarked. */
  saved?: boolean;
  intensity: number;
  onIntensity: (v: number) => void;
  onToggleSave: () => void;
  onApply: () => void;
}) {
  const t = useT();
  const thumb = usePresetThumbnail(preset);
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetTop}>
        <Image source={thumb} style={styles.sheetThumb} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetName}>{preset.name}</Text>
          <Text style={styles.sheetDesc} numberOfLines={2}>
            {presetDescription(preset)}
          </Text>
        </View>
        {saved !== undefined && (
          <Pressable hitSlop={10} onPress={onToggleSave} accessibilityLabel={saved ? t('presets.unfavorite') : t('presets.favorite')}>
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? colors.gold : colors.text} />
          </Pressable>
        )}
      </View>
      <ToneSlider label={t('common.intensity')} min={0} max={100} value={intensity} onChange={onIntensity} />
      <Pressable onPress={onApply} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
        <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.apply}>
          <Text style={styles.applyText}>{t('presets.apply')}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.onGold} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: 16, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 6 },
  title: { fontFamily: font.serif, fontSize: 32, color: colors.text, lineHeight: 40 },
  sub: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: colors.textSoft, maxWidth: 300 },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  search: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chips: { gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  chipTextActive: { color: colors.onGold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  empty: { fontFamily: font.regular, fontSize: 13, color: colors.textSoft, textAlign: 'center', paddingVertical: 24 },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 10, paddingBottom: 8 },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH - 12,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  sheetTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetThumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.surface2 },
  sheetName: { fontFamily: font.semi, fontSize: 15, color: colors.text },
  sheetDesc: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.textSoft },
  apply: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 12 },
  applyText: { fontFamily: font.semi, fontSize: 15, color: colors.onGold },
});
