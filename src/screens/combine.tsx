import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Canvas, Image as SkImageNode, type SkImage } from '@shopify/react-native-skia';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiCombine } from '@/src/ai/client';
import { combineIdeas, combineRatios, MAX_COMBINE, MAX_COMBINE_PROMPT, MIN_COMBINE, type CombineRatio } from '@/src/ai/combine';
import {
  collageBackgrounds,
  collageCorners,
  collageGaps,
  collageLayouts,
  collageRatios,
  CollageScene,
  ratioValue,
  renderCollage,
  type CollageLayoutId,
  type CollageOptions,
  type CollageRatio,
} from '@/src/combine/collage';
import { encodeBase64, imageFromBase64, loadPhotoPair, resizeImage } from '@/src/editor/imageOps';
import { HScroll } from '@/src/HScroll';
import { ModelChip } from '@/src/ModelPicker';
import { notify } from '@/src/notify';
import { setPendingExport, setPendingPhoto, takePendingCombine } from '@/src/pendingPhoto';
import { ReportAi } from '@/src/ReportAi';
import { colors, font, goldGradient } from '@/src/theme';
import { track } from '@/src/track';
import { HomeButton, IconButton, Swatches } from '@/src/ui';
import { useT } from '@/src/i18n';

/**
 * "Ghép ảnh": 2–3 photos made into one, either by the AI (one natural photo, costs one AI call)
 * or as a collage drawn on the phone (free). Either result opens in the full editor.
 */
type Photo = { id: number; uri: string; image: SkImage };
type Mode = 'ai' | 'collage';

let nextId = 1;

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** A small drawing of a collage layout for its button. */
function LayoutIcon({ id, count, active }: { id: CollageLayoutId; count: number; active: boolean }) {
  const layout = collageLayouts.find((l) => l.id === id)!;
  return (
    <View style={styles.layoutIcon}>
      {layout.cells(count).map((c, i) => (
        <View
          key={i}
          style={[
            styles.layoutCell,
            { left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` },
            active && { backgroundColor: i === 0 ? colors.gold : colors.goldSoft, borderColor: colors.surface },
          ]}
        />
      ))}
    </View>
  );
}

export default function Combine() {
  const t = useT();
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [mode, setMode] = useState<Mode>('ai');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  // AI
  const [prompt, setPrompt] = useState('');
  const [aiRatio, setAiRatio] = useState<CombineRatio>('auto');
  const [result, setResult] = useState<{ b64: string; image: SkImage; key: string } | null>(null);

  // Collage
  const [layout, setLayout] = useState<CollageLayoutId>('row');
  const [ratio, setRatio] = useState<CollageRatio>('1:1');
  const [gap, setGap] = useState<number>(collageGaps[2].value);
  const [corner, setCorner] = useState<number>(collageCorners[1].value);
  const [background, setBackground] = useState<string>(collageBackgrounds[0]);
  const options: CollageOptions = { layout, gap, corner, background };

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const addUris = async (uris: string[]) => {
    if (!uris.length) return;
    setBusy(t('common.openingPhoto'));
    try {
      const loaded: Photo[] = [];
      for (const uri of uris) {
        try {
          loaded.push({ id: nextId++, uri, image: (await loadPhotoPair(uri)).image });
        } catch (e: any) {
          notify(e?.message ?? t('common.cantOpenPhoto'));
        }
      }
      setPhotos((list) => [...list, ...loaded].slice(0, MAX_COMBINE));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    addUris(takePendingCombine().slice(0, MAX_COMBINE));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickMore = async () => {
    const room = MAX_COMBINE - photos.length;
    if (room <= 0 || busy) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsMultipleSelection: room > 1,
        selectionLimit: room,
        orderedSelection: true,
      });
      if (res.canceled) return;
      if (res.assets.length > room) showToast(t('combine.tooMany', { n: MAX_COMBINE }));
      await addUris(res.assets.slice(0, room).map((a) => a.uri));
    } catch (e: any) {
      notify(e?.message ?? t('common.cantOpenPhoto'));
    }
  };

  const remove = (id: number) => setPhotos((list) => list.filter((p) => p.id !== id));
  /** Tapping a photo makes it photo 1 (the big cell of a collage, the main scene for the AI). */
  const makeFirst = (id: number) => setPhotos((list) => [...list.filter((p) => p.id === id), ...list.filter((p) => p.id !== id)]);

  const enough = photos.length >= MIN_COMBINE;
  const images = photos.map((p) => p.image);
  const aiKey = JSON.stringify([photos.map((p) => p.id), prompt.trim(), aiRatio]);
  const fresh = !!result && result.key === aiKey;

  const runAi = async () => {
    if (!enough || busy) return;
    setBusy(t('combine.working'));
    try {
      const inputs = await Promise.all(images.map(async (img) => encodeBase64(await resizeImage(img, 1024), 88)));
      const out = await aiCombine(inputs, prompt.trim(), aiRatio);
      setResult({ b64: out.image, image: await imageFromBase64(out.image), key: aiKey });
      showToast(`Xong ✨ ${out.summary}`);
    } catch (e: any) {
      showToast(e?.message ?? t('common.aiError'));
    } finally {
      setBusy(null);
    }
  };

  /** The picture to hand on: the AI result, or the collage drawn at full working size. */
  const finished = async (): Promise<SkImage | null> => {
    if (mode === 'ai') return result?.image ?? null;
    if (!enough) return null;
    setBusy(t('combine.making'));
    try {
      const img = await renderCollage(images, ratio, options);
      track('combine_collage', layout);
      return img;
    } catch (e: any) {
      notify(e?.message ?? t('common.error'));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const edit = async () => {
    if (mode === 'ai' && result) {
      setPendingPhoto({ kind: 'base64', data: result.b64 });
      router.push('/editor');
      return;
    }
    const img = await finished();
    if (!img) return;
    setPendingPhoto({ kind: 'image', image: img });
    router.push('/editor');
  };

  const save = async () => {
    const img = await finished();
    if (!img) return;
    setPendingExport(img);
    router.push('/export');
  };

  /* ---------- Preview ---------- */

  const showResult = mode === 'ai' && fresh;
  // Before the AI runs, the photos are shown side by side; a collage shows its frame.
  const frameRatio = showResult && result
    ? result.image.width() / result.image.height()
    : mode === 'collage'
      ? ratioValue(ratio)
      : Math.min(2, Math.max(0.75, images.reduce((s, img) => s + img.width() / img.height(), 0)));
  const fit = box.w && box.h ? Math.min(box.w / frameRatio, box.h) : 0;
  const fw = fit * frameRatio;
  const fh = fit;
  const previewOptions: CollageOptions = mode === 'collage' ? options : { layout: 'row', gap: 0.015, corner: 0.03, background: colors.surface };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.column}>
        <View style={styles.header}>
          <IconButton icon={{ set: 'ion', name: 'chevron-back' }} onPress={leave} />
          <Text style={styles.title} numberOfLines={1}>
            {t('combine.title')}
          </Text>
          <HomeButton />
        </View>

        <View style={styles.preview} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {photos.length === 0 ? (
            <Pressable onPress={pickMore} disabled={!!busy} style={({ pressed }) => [styles.empty, pressed && { opacity: 0.8 }]}>
              <View style={styles.emptyIcon}>
                <Ionicons name="images-outline" size={30} color={colors.gold} />
              </View>
              <Text style={styles.emptyTitle}>{t('combine.emptyTitle')}</Text>
              <Text style={styles.emptySub}>{t('combine.emptySub', { n: MAX_COMBINE })}</Text>
            </Pressable>
          ) : fit > 0 ? (
            <View style={[styles.frame, { width: fw, height: fh }]}>
              <Canvas style={{ width: fw, height: fh }}>
                {showResult && result ? (
                  <SkImageNode image={result.image} x={0} y={0} width={fw} height={fh} fit="contain" />
                ) : (
                  <CollageScene photos={images} width={fw} height={fh} options={previewOptions} />
                )}
              </Canvas>
              {mode === 'ai' && !fresh && !busy && (
                <View style={styles.hint}>
                  <Text style={styles.hintText}>{enough ? t('combine.aiHint', { n: photos.length }) : t('combine.needMore')}</Text>
                </View>
              )}
            </View>
          ) : null}
          {busy && (
            <View style={styles.busy}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.busyText}>{busy}</Text>
            </View>
          )}
        </View>

        {/* The chosen photos, in order: tap one to make it photo 1. */}
        <View style={styles.strip}>
          {photos.map((p, i) => (
            <Pressable key={p.id} onPress={() => makeFirst(p.id)} disabled={!!busy} style={[styles.thumb, i === 0 && styles.thumbFirst]} accessibilityLabel={t('combine.makeFirst')}>
              <Image source={{ uri: p.uri }} style={styles.thumbImg} resizeMode="cover" />
              <Text style={styles.thumbNo}>{i + 1}</Text>
              <Pressable hitSlop={6} onPress={() => remove(p.id)} disabled={!!busy} style={styles.thumbRemove} accessibilityLabel={t('common.delete')}>
                <Ionicons name="close" size={13} color="#FFFFFF" />
              </Pressable>
            </Pressable>
          ))}
          {photos.length < MAX_COMBINE && (
            <Pressable onPress={pickMore} disabled={!!busy} style={({ pressed }) => [styles.thumb, styles.addThumb, pressed && { opacity: 0.7 }]} accessibilityLabel={t('combine.add')}>
              <Ionicons name="add" size={24} color={colors.gold} />
              <Text style={styles.addText}>{t('combine.add')}</Text>
            </Pressable>
          )}
          {photos.length > 1 && <Text style={styles.stripHint}>{t('combine.orderHint')}</Text>}
        </View>

        <View style={styles.tabs}>
          {(['ai', 'collage'] as const).map((m) => {
            const active = mode === m;
            return (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.tab, active && styles.tabActive]}>
                <Ionicons name={m === 'ai' ? 'sparkles' : 'grid-outline'} size={15} color={active ? colors.onGold : colors.textSoft} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t(m === 'ai' ? 'combine.modeAi' : 'combine.modeCollage')}</Text>
                {m === 'collage' && <Text style={[styles.free, active && { color: colors.onGold }]}>{t('combine.free')}</Text>}
              </Pressable>
            );
          })}
        </View>

        <ScrollView style={styles.controls} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {mode === 'ai' ? (
            <>
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder={t('combine.placeholder')}
                placeholderTextColor={colors.textMute}
                maxLength={MAX_COMBINE_PROMPT}
                multiline
                style={styles.input}
              />
              <HScroll contentContainerStyle={styles.chips}>
                {combineIdeas.map((idea) => (
                  <Chip key={idea} label={t(idea)} onPress={() => setPrompt(t(idea))} />
                ))}
              </HScroll>
              <Text style={styles.label}>{t('generate.ratio')}</Text>
              <HScroll contentContainerStyle={styles.chips}>
                {combineRatios.map((r) => (
                  <Chip key={r} label={r === 'auto' ? t('combine.ratioAuto') : r} active={aiRatio === r} onPress={() => setAiRatio(r)} />
                ))}
              </HScroll>
              <ModelChip />
            </>
          ) : (
            <>
              <Text style={styles.label}>{t('combine.layout')}</Text>
              <View style={styles.layouts}>
                {collageLayouts.map((l) => {
                  const active = layout === l.id;
                  return (
                    <Pressable key={l.id} onPress={() => setLayout(l.id)} style={[styles.layoutBtn, active && styles.layoutBtnActive]}>
                      <LayoutIcon id={l.id} count={Math.max(MIN_COMBINE, photos.length)} active={active} />
                      <Text numberOfLines={1} style={[styles.layoutText, active && { color: colors.goldDeep }]}>
                        {t(l.label)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.label}>{t('generate.ratio')}</Text>
              <HScroll contentContainerStyle={styles.chips}>
                {collageRatios.map((r) => (
                  <Chip key={r} label={r} active={ratio === r} onPress={() => setRatio(r)} />
                ))}
              </HScroll>
              <Text style={styles.label}>{t('combine.gap')}</Text>
              <HScroll contentContainerStyle={styles.chips}>
                {collageGaps.map((g) => (
                  <Chip key={g.id} label={t(g.label)} active={gap === g.value} onPress={() => setGap(g.value)} />
                ))}
              </HScroll>
              <Text style={styles.label}>{t('combine.corner')}</Text>
              <HScroll contentContainerStyle={styles.chips}>
                {collageCorners.map((c) => (
                  <Chip key={c.id} label={t(c.label)} active={corner === c.value} onPress={() => setCorner(c.value)} />
                ))}
              </HScroll>
              <Text style={styles.label}>{t('combine.background')}</Text>
              <Swatches colorsList={[...collageBackgrounds]} value={background} onChange={setBackground} />
            </>
          )}
        </ScrollView>

        {mode === 'ai' && !fresh ? (
          <Pressable disabled={!enough || !!busy} onPress={runAi} style={({ pressed }) => [(pressed || !!busy || !enough) && { opacity: 0.55 }]}>
            <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
              <Ionicons name="sparkles" size={17} color={colors.onGold} />
              <Text style={styles.primaryText}>{result ? t('combine.again') : t('combine.run')}</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={styles.actions}>
            <Pressable onPress={edit} disabled={!enough || !!busy} style={({ pressed }) => [styles.secondary, (pressed || !enough) && { opacity: 0.6 }]}>
              {/* Opens the picture in the full editor (crop, colors, beauty, text, stickers, AI…). */}
              <Ionicons name="options-outline" size={18} color={colors.text} />
              <Text style={styles.secondaryText} numberOfLines={1}>
                {t('studio.openEditor')}
              </Text>
            </Pressable>
            <Pressable onPress={save} disabled={!enough || !!busy} style={({ pressed }) => [{ flex: 1.2 }, (pressed || !enough) && { opacity: 0.6 }]}>
              <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
                <Ionicons name="download-outline" size={18} color={colors.onGold} />
                <Text style={styles.primaryText}>{t('common.saveImage')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
        {mode === 'ai' && fresh && (
          // Another try with the same photos and request (one more AI call).
          <Pressable onPress={runAi} disabled={!!busy} style={styles.redo}>
            <MaterialCommunityIcons name="refresh" size={15} color={colors.textSoft} />
            <Text style={styles.redoText}>{t('combine.again')}</Text>
          </Pressable>
        )}
        {mode === 'ai' && fresh && result && !busy && <ReportAi tool="combine" image={result.image} prompt={prompt} />}
      </View>

      {toast && (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  column: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 14, paddingBottom: 8, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, gap: 8 },
  title: { flex: 1, textAlign: 'center', fontFamily: font.semi, fontSize: 17, color: colors.text },
  preview: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  frame: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface2 },
  empty: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
    padding: 20,
  },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: font.semi, fontSize: 16, color: colors.text, textAlign: 'center' },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: colors.textSoft, textAlign: 'center' },
  hint: { position: 'absolute', left: 10, right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  hintText: { fontFamily: font.medium, fontSize: 12.5, color: '#FFFFFF', textAlign: 'center' },
  busy: { ...StyleSheet.absoluteFillObject, borderRadius: 16, backgroundColor: 'rgba(42,32,24,0.5)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  busyText: { fontFamily: font.medium, fontSize: 14, color: '#FFFFFF', textAlign: 'center', paddingHorizontal: 20 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thumb: { width: 58, height: 58, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface2 },
  thumbFirst: { borderColor: colors.gold },
  thumbImg: { width: '100%', height: '100%' },
  thumbNo: {
    position: 'absolute',
    left: 3,
    top: 3,
    minWidth: 18,
    textAlign: 'center',
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#FFFFFF',
    fontFamily: font.semi,
    fontSize: 11,
  },
  thumbRemove: { position: 'absolute', right: 3, top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  addThumb: { borderStyle: 'dashed', borderColor: colors.gold, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: font.medium, fontSize: 10.5, color: colors.goldDeep, marginTop: -2 },
  stripHint: { flex: 1, fontFamily: font.regular, fontSize: 11.5, lineHeight: 15, color: colors.textSoft },
  tabs: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: colors.surface2 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 11 },
  tabActive: { backgroundColor: colors.gold },
  tabText: { fontFamily: font.semi, fontSize: 13.5, color: colors.textSoft },
  tabTextActive: { color: colors.onGold },
  free: { fontFamily: font.medium, fontSize: 10.5, color: colors.gold },
  controls: { flexGrow: 0, maxHeight: '40%' },
  label: { fontFamily: font.semi, fontSize: 13.5, color: colors.text, marginTop: 2 },
  input: {
    minHeight: 46,
    maxHeight: 90,
    textAlignVertical: 'top',
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  chips: { gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  chipTextActive: { color: colors.onGold },
  layouts: { flexDirection: 'row', gap: 8 },
  layoutBtn: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  layoutBtnActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  layoutIcon: { width: 30, height: 30 },
  layoutCell: { position: 'absolute', borderWidth: 1.5, borderColor: colors.surface, borderRadius: 3, backgroundColor: colors.border },
  layoutText: { fontFamily: font.medium, fontSize: 11, color: colors.textSoft },
  actions: { flexDirection: 'row', gap: 10 },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    paddingVertical: 14,
  },
  secondaryText: { fontFamily: font.medium, fontSize: 14, color: colors.text },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 14 },
  primaryText: { fontFamily: font.semi, fontSize: 16, color: colors.onGold },
  redo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 2, marginTop: -4 },
  redoText: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  toast: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    maxWidth: '90%',
  },
  toastText: { fontFamily: font.medium, color: colors.text, fontSize: 14, textAlign: 'center' },
});
