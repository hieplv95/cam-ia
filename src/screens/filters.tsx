import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, Group, Image as SkImageNode, rect, Rect, type SkImage } from '@shopify/react-native-skia';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadPendingPair } from '@/src/editor/imageOps';
import { exportFiltered, FilteredImage, renderFilterThumbs, thumbnailSource } from '@/src/filters/engine';
import { useFilterFavorites } from '@/src/filters/favorites';
import { camFilters, filterById, filterCategories, filtersIn, type CamFilter, type FilterCategory } from '@/src/filters/registry';
import { useT, type MessageKey } from '@/src/i18n';
import { notify } from '@/src/notify';
import { setPendingExport, takePendingPhoto } from '@/src/pendingPhoto';
import { cardShadow, colors, font, goldGradient } from '@/src/theme';

/** The app's cream and gold, like the other screens. */
const tone = {
  bg: colors.bg,
  panel: colors.surface,
  chip: colors.surface2,
  text: colors.text,
  soft: colors.textSoft,
  accent: colors.gold,
};
const HEART = '#E25D7E';

type Shelf = 'all' | 'favorites' | FilterCategory;

const THUMB = 128;
const CARD_W = 62;
const CARD_GAP = 10;
/** A swipe past this share of the photo's width (or a quick flick) changes the filter. */
const SWIPE_SHARE = 0.22;

const ease = (x: number) => 1 - (1 - x) ** 3;

/**
 * CamIA Filters (in the app's cream and gold): the photo large, swipe left / right for the next / previous color filter (the new one slides
 * in under the finger), hold to see the original, pick a category or a thumbnail of the photo itself below, set the
 * intensity, save. Everything runs on the device (src/filters/engine.tsx): no AI, no cost per filter.
 */
export default function Filters() {
  const t = useT();
  const router = useRouter();
  const [image, setImage] = useState<SkImage | null>(null);
  const [full, setFull] = useState<SkImage | null>(null);
  const [small, setSmall] = useState<SkImage | null>(null);
  const [busy, setBusy] = useState<string | null>(t('common.openingPhoto'));
  const [filterId, setFilterId] = useState<string | null>(null);
  const [intensities, setIntensities] = useState<Record<string, number>>({});
  const [shelf, setShelf] = useState<Shelf>('all');
  const { favorites, toggle: toggleFavorite } = useFilterFavorites();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [comparing, setComparing] = useState(false);
  const [drag, setDrag] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [hint, setHint] = useState(true);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const win = useWindowDimensions();
  const strip = useRef<ScrollView>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animating = useRef(false);

  const filter = filterId ? (filterById(filterId) ?? null) : null;
  const intensityOf = useCallback((f: CamFilter | null) => (f ? (intensities[f.id] ?? f.intensity) : 0), [intensities]);
  const intensity = intensityOf(filter);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const goHome = () => (router.canDismiss() ? router.dismissTo('/') : router.replace('/'));

  useEffect(() => {
    const pending = takePendingPhoto();
    if (!pending || pending.kind === 'blank') {
      router.replace('/');
      return;
    }
    loadPendingPair(pending)
      .then(async (p) => {
        setImage(p.image);
        setFull(p.full ?? p.image);
        setSmall(await thumbnailSource(p.image, THUMB));
      })
      .catch((e) => {
        notify(e.message ?? t('common.cantOpenPhoto'));
        leave();
      })
      .finally(() => setBusy(null));
    const hide = setTimeout(() => setHint(false), 6000);
    return () => clearTimeout(hide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The filters on the current shelf, after "Gốc" (the photo as it was).
  const shelfFilters = useMemo(
    () =>
      shelf === 'all'
        ? camFilters
        : shelf === 'favorites'
          ? favorites.map((id) => filterById(id)).filter((f): f is CamFilter => !!f)
          : filtersIn(shelf),
    [shelf, favorites],
  );
  const sequence: (CamFilter | null)[] = useMemo(() => [null, ...shelfFilters], [shelfFilters]);
  const index = sequence.findIndex((f) => (f?.id ?? null) === filterId);
  const neighbor = (dir: 1 | -1): CamFilter | null | undefined => {
    // From a filter that is not on this shelf, forward goes to the shelf's first filter, back to the original.
    const i = index < 0 ? (dir > 0 ? 1 : 0) : index + dir;
    return i >= 0 && i < sequence.length ? sequence[i] : undefined;
  };

  // Thumbnails of the user's own photo, made for the shelf being looked at and kept.
  const making = useRef(new Set<string>());
  useEffect(() => {
    if (!small) return;
    const missing = sequence.filter((f) => {
      const key = f?.id ?? 'original';
      return !thumbs[key] && !making.current.has(key);
    });
    if (!missing.length) return;
    missing.forEach((f) => making.current.add(f?.id ?? 'original'));
    renderFilterThumbs(small, missing, THUMB)
      .then((urls) => setThumbs((prev) => ({ ...prev, ...Object.fromEntries(missing.map((f, i) => [f?.id ?? 'original', urls[i]])) })))
      .catch(() => missing.forEach((f) => making.current.delete(f?.id ?? 'original')));
  }, [small, sequence, thumbs]);

  const choose = (f: CamFilter | null) => {
    setFilterId(f?.id ?? null);
    setHint(false);
    setFlash(f?.name ?? t('filters.original'));
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 900);
    const i = sequence.findIndex((x) => (x?.id ?? null) === (f?.id ?? null));
    if (i >= 0) strip.current?.scrollTo({ x: Math.max(0, i * (CARD_W + CARD_GAP) - 120), animated: true });
  };

  /** Slides the reveal edge from `from` to `to` (points), then calls `done`. */
  const slide = (from: number, to: number, ms: number, done?: () => void) => {
    animating.current = true;
    const start = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / ms);
      setDrag(from + (to - from) * ease(k));
      if (k < 1) requestAnimationFrame(tick);
      else {
        animating.current = false;
        done?.();
      }
    };
    requestAnimationFrame(tick);
  };

  // Until the stage has been measured, a guess from the window lets the photo show at once.
  const stageW = box.w || Math.min(win.width, 620) - 24;
  const stageH = box.h || win.height - 330;
  const scale = image && stageW > 0 && stageH > 0 ? Math.min(stageW / image.width(), stageH / image.height()) : 0;
  const dw = image ? Math.round(image.width() * scale) : 0;
  const dh = image ? Math.round(image.height() * scale) : 0;

  /** Next (dir 1) or previous (-1) filter, with the same slide as a swipe (arrow keys, end of a swipe). */
  const step = (dir: 1 | -1, from = 0) => {
    const next = neighbor(dir);
    if (next === undefined || !dw) {
      slide(from, 0, 160);
      return;
    }
    slide(from, dir > 0 ? -dw : dw, 200, () => {
      choose(next);
      setDrag(0);
    });
  };

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-12, 12])
    .failOffsetY([-24, 24])
    .onUpdate((e) => {
      if (animating.current || comparing) return;
      const dir = e.translationX < 0 ? 1 : -1;
      // Past the first or last filter the photo only gives a little.
      setDrag(neighbor(dir) === undefined ? e.translationX / 4 : Math.max(-dw, Math.min(dw, e.translationX)));
    })
    .onEnd((e) => {
      if (animating.current || comparing) return;
      const dir = e.translationX < 0 ? 1 : -1;
      const far = Math.abs(e.translationX) > dw * SWIPE_SHARE || Math.abs(e.velocityX) > 700;
      if (far && neighbor(dir) !== undefined) step(dir, Math.max(-dw, Math.min(dw, e.translationX)));
      else slide(drag, 0, 160);
    });
  const hold = Gesture.LongPress()
    .runOnJS(true)
    .minDuration(280)
    .maxDistance(12)
    .onStart(() => setComparing(true))
    .onFinalize(() => setComparing(false));

  // Arrow keys on a computer.
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') stepRef.current(1);
      else if (e.key === 'ArrowLeft') stepRef.current(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const save = async () => {
    if (!full) return;
    setBusy(t('common.preparing'));
    try {
      setPendingExport(await exportFiltered(full, filter, intensity), { logo: false });
      router.push('/export');
    } catch (e: any) {
      notify(e.message ?? t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const revealed = drag !== 0 ? neighbor(drag < 0 ? 1 : -1) : undefined;
  const edge = drag < 0 ? dw + drag : drag;
  const favorite = !!filter && favorites.includes(filter.id);
  const shelves: { id: Shelf; label: string }[] = [
    { id: 'all', label: t('filters.all') },
    { id: 'favorites', label: t('filters.favorites') },
    ...filterCategories.map((c) => ({ id: c as Shelf, label: t(`filters.cat.${c}` as MessageKey) })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.column}>
        <View style={styles.header}>
          <Pressable onPress={leave} hitSlop={8} style={styles.roundBtn} accessibilityLabel={t('common.back')}>
            <Ionicons name="chevron-back" size={22} color={tone.text} />
          </Pressable>
          <Text style={styles.title}>{t('filters.title')}</Text>
          <Pressable onPress={save} disabled={!full || !!busy} style={({ pressed }) => pressed && { opacity: 0.85 }}>
            <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtn}>
              <Ionicons name="download-outline" size={17} color={colors.onGold} />
              <Text style={styles.saveText}>{t('common.save')}</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.stage} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {image && dw > 0 ? (
            <GestureDetector gesture={Gesture.Race(swipe, hold)}>
              <View style={[styles.photo, { width: dw, height: dh }]}>
                <Canvas style={{ width: dw, height: dh }}>
                  {comparing ? (
                    <SkImageNode image={image} x={0} y={0} width={dw} height={dh} fit="fill" />
                  ) : (
                    <FilteredImage image={image} filter={filter} intensity={intensity} width={dw} height={dh} />
                  )}
                  {revealed !== undefined && !comparing && (
                    <>
                      <Group clip={drag < 0 ? rect(edge, 0, dw - edge, dh) : rect(0, 0, edge, dh)}>
                        <FilteredImage image={image} filter={revealed} intensity={intensityOf(revealed)} width={dw} height={dh} />
                      </Group>
                      <Rect x={edge - 1} y={0} width={2} height={dh} color="rgba(255,255,255,0.9)" />
                    </>
                  )}
                </Canvas>
                <View pointerEvents="none" style={styles.tag}>
                  <Text style={styles.tagText}>{comparing || !filter ? t('filters.original') : filter.name}</Text>
                </View>
                {flash && !comparing && drag === 0 && (
                  <View pointerEvents="none" style={styles.flash}>
                    <Text style={styles.flashText}>{flash}</Text>
                  </View>
                )}
                {hint && (
                  <View pointerEvents="none" style={styles.hint}>
                    <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                    <Text style={styles.hintText}>{t('filters.swipeHint')}</Text>
                  </View>
                )}
                <View style={styles.photoActions}>
                  <Pressable
                    onPressIn={() => setComparing(true)}
                    onPressOut={() => setComparing(false)}
                    style={styles.photoBtn}
                    accessibilityLabel={t('filters.holdCompare')}
                  >
                    <Ionicons name="contrast-outline" size={18} color="#FFFFFF" />
                  </Pressable>
                  {filter && (
                    <Pressable
                      onPress={() => toggleFavorite(filter.id)}
                      style={styles.photoBtn}
                      accessibilityLabel={favorite ? t('filters.unfavorite') : t('filters.favorite')}
                    >
                      <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={18} color={favorite ? HEART : '#FFFFFF'} />
                    </Pressable>
                  )}
                </View>
              </View>
            </GestureDetector>
          ) : (
            <ActivityIndicator color={tone.accent} />
          )}
        </View>

        <View style={styles.panel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.shelves}>
            {shelves.map((s) => (
              <Pressable key={s.id} onPress={() => setShelf(s.id)} style={[styles.chip, shelf === s.id && styles.chipActive]}>
                {s.id === 'favorites' && <Ionicons name="heart" size={12} color={shelf === s.id ? '#FFFFFF' : HEART} />}
                <Text style={[styles.chipText, shelf === s.id && styles.chipTextActive]}>{s.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.cards}>
            {sequence.map((f) => {
              const key = f?.id ?? 'original';
              const active = (f?.id ?? null) === filterId;
              return (
                <Pressable key={key} onPress={() => choose(f)} style={[styles.card, active && styles.cardActive]}>
                  <View style={styles.cardImg}>{thumbs[key] ? <Image source={{ uri: thumbs[key] }} style={StyleSheet.absoluteFill} /> : null}</View>
                  <Text numberOfLines={1} style={[styles.cardText, active && styles.cardTextActive]}>
                    {f ? f.name : t('filters.original')}
                  </Text>
                </Pressable>
              );
            })}
            {shelf === 'favorites' && !shelfFilters.length && <Text style={styles.empty}>{t('filters.noFavorites')}</Text>}
          </ScrollView>

          {filter ? (
            <View style={styles.intensityRow}>
              <Text style={styles.intensityLabel}>{t('filters.intensity')}</Text>
              <IntensitySlider value={intensity} onChange={(v) => setIntensities((m) => ({ ...m, [filter.id]: v }))} />
              <Text style={styles.intensityValue}>{intensity}</Text>
            </View>
          ) : (
            <Text style={styles.pickHint}>{t('filters.pickHint')}</Text>
          )}
        </View>

        <Pressable onPress={goHome} style={({ pressed }) => [styles.homeBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
          <Ionicons name="home-outline" size={18} color={tone.text} />
          <Text style={styles.homeText}>{t('tabs.home')}</Text>
        </Pressable>
      </View>

      {busy && image && (
        <View style={styles.overlay}>
          <ActivityIndicator color={tone.accent} />
          <Text style={styles.overlayText}>{busy}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const KNOB = 20;

/** 0–100 slider for the dark panel (drag or tap anywhere on the track). */
function IntensitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [width, setWidth] = useState(0);
  const toValue = (x: number) => Math.round(Math.min(1, Math.max(0, (x - KNOB / 2) / Math.max(1, width - KNOB))) * 100);
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-3, 3])
    .failOffsetY([-14, 14])
    .onBegin((e) => onChange(toValue(e.x)))
    .onUpdate((e) => onChange(toValue(e.x)));
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e, ok) => ok && onChange(toValue(e.x)));
  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <View style={styles.sliderHit} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${value}%` }]} />
        </View>
        {width > 0 && <View style={[styles.knob, { left: (value / 100) * (width - KNOB) }]} />}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tone.bg },
  column: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 },
  roundBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.semi, fontSize: 16, color: tone.text },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  saveText: { fontFamily: font.semi, fontSize: 14, color: colors.onGold },
  stage: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  photo: { borderRadius: 22, overflow: 'hidden', backgroundColor: tone.chip, ...cardShadow },
  tag: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 },
  tagText: { fontFamily: font.semi, fontSize: 13, color: '#FFFFFF' },
  flash: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  flashText: {
    fontFamily: font.serif,
    fontSize: 30,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  hint: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  hintText: { fontFamily: font.medium, fontSize: 13, color: '#FFFFFF' },
  photoActions: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 8 },
  photoBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  panel: { backgroundColor: tone.panel, borderRadius: 24, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, gap: 12, ...cardShadow },
  row: { flexGrow: 0, flexShrink: 0 },
  shelves: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: tone.chip, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  chipActive: { backgroundColor: tone.accent },
  chipText: { fontFamily: font.medium, fontSize: 12.5, color: tone.soft },
  chipTextActive: { color: '#FFFFFF', fontFamily: font.semi },
  cards: { paddingHorizontal: 12, gap: CARD_GAP, alignItems: 'flex-start' },
  card: { width: CARD_W + 6, alignItems: 'center', gap: 5, padding: 3, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  cardActive: { borderColor: tone.accent },
  cardImg: { width: CARD_W - 2, height: CARD_W + 10, borderRadius: 12, overflow: 'hidden', backgroundColor: tone.chip },
  cardText: { fontFamily: font.medium, fontSize: 10.5, color: tone.soft, maxWidth: CARD_W + 2 },
  cardTextActive: { color: colors.goldDeep, fontFamily: font.semi },
  empty: { fontFamily: font.regular, fontSize: 12.5, color: tone.soft, alignSelf: 'center', marginLeft: 6 },
  intensityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  intensityLabel: { fontFamily: font.medium, fontSize: 12.5, color: tone.soft },
  intensityValue: { fontFamily: font.semi, fontSize: 13, color: tone.text, width: 28, textAlign: 'right' },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: tone.chip,
    paddingVertical: 11,
  },
  homeText: { fontFamily: font.medium, fontSize: 14, color: tone.text },
  pickHint: { fontFamily: font.regular, fontSize: 12.5, color: tone.soft, textAlign: 'center', paddingVertical: 6 },
  sliderHit: { flex: 1, height: 32, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: tone.accent },
  knob: { position: 'absolute', width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: tone.accent },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(250,246,240,0.82)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  overlayText: { fontFamily: font.medium, fontSize: 14, color: tone.text },
});
