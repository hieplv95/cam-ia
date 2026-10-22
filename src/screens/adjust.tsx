import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Canvas, ColorMatrix, Image as SkImageNode, type SkImage } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CurveEditor } from '@/src/develop/CurveEditor';
import { DevelopedImage } from '@/src/develop/shader';
import { ToneSlider } from '@/src/develop/ToneSlider';
import { addCustomPreset, findPreset, loadCustomPresets, nextRecipeName } from '@/src/develop/customPresets';
import { presetDevelop } from '@/src/develop/presets';
import { Dialog } from '@/src/Dialog';
import {
  colorSliders,
  defaultDevelop,
  detailSliders,
  hslRanges,
  isDefault,
  lightSliders,
  type Develop,
  type HslRange,
} from '@/src/develop/types';
import { buildMatrix, filterName, filters } from '@/src/editor/filters';
import { loadPendingPair, renderImage, renderJpegThumbnail, renderThumbnail, resizeImage } from '@/src/editor/imageOps';
import { defaultAdjust } from '@/src/editor/types';
import { Icon, type IconSpec } from '@/src/icons';
import { notify } from '@/src/notify';
import { setPendingExport, setPendingPhoto, takePendingPhoto } from '@/src/pendingPhoto';
import { colors, font, goldGradient } from '@/src/theme';
import { trackPreset } from '@/src/track';
import { HomeButton, IconButton } from '@/src/ui';
import { HScroll } from '@/src/HScroll';
import { useT } from '@/src/i18n';

type Tab = 'light' | 'color' | 'curves' | 'hsl' | 'detail';

const tabs: { id: Tab; icon: IconSpec }[] = [
  { id: 'light', icon: { set: 'ion', name: 'sunny-outline' } },
  { id: 'color', icon: { set: 'ion', name: 'color-filter-outline' } },
  { id: 'curves', icon: { set: 'mci', name: 'chart-bell-curve-cumulative' } },
  { id: 'hsl', icon: { set: 'mci', name: 'palette-outline' } },
  { id: 'detail', icon: { set: 'ion', name: 'triangle-outline' } },
];

const hslColor = (deg: number, s = 85, l = 55) => `hsl(${((deg % 360) + 360) % 360}, ${s}%, ${l}%)`;

function Preview({ image, develop, showOriginal }: { image: SkImage; develop: Develop; showOriginal: boolean }) {
  const t = useT();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const iw = image.width();
  const ih = image.height();
  const scale = box.w && box.h ? Math.min(box.w / iw, box.h / ih) : 0;
  const dw = Math.round(iw * scale);
  const dh = Math.round(ih * scale);
  return (
    <View style={styles.previewArea} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {scale > 0 && (
        <View style={[styles.photo, { width: dw, height: dh }]}>
          <Canvas style={{ width: dw, height: dh }}>
            {showOriginal ? (
              <SkImageNode image={image} x={0} y={0} width={dw} height={dh} fit="fill" />
            ) : (
              <DevelopedImage image={image} develop={develop} width={dw} height={dh} />
            )}
          </Canvas>
          {showOriginal && (
            <View style={styles.originalTag}>
              <Text style={styles.originalText}>{t('common.original')}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function Adjust() {
  const t = useT();
  const router = useRouter();
  const [image, setImage] = useState<SkImage | null>(null);
  /** Full-resolution original, developed only when exporting. */
  const [full, setFull] = useState<SkImage | null>(null);
  const [hist, setHist] = useState<{ past: Develop[]; present: Develop; future: Develop[] }>(() => ({ past: [], present: defaultDevelop(), future: [] }));
  const develop = hist.present;
  const lastEdit = useRef(0);
  const [recipeName, setRecipeName] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('color');
  const [hslRange, setHslRange] = useState<HslRange>('orange');
  const [comparing, setComparing] = useState(false);
  const [busy, setBusy] = useState<string | null>(t('common.openingPhoto'));
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  // Phones: the PRO badge gives its room to the title and the home button.
  const narrow = useWindowDimensions().width < 420;
  const [looks, setLooks] = useState<Record<string, string>>({});

  /** Slider drags arrive as many small changes; changes less than 600 ms apart form a single undo step. */
  const setDevelop = (next: Develop | ((d: Develop) => Develop)) => {
    const now = Date.now();
    const merge = now - lastEdit.current < 600;
    lastEdit.current = now;
    setHist((h) => {
      const value = typeof next === 'function' ? next(h.present) : next;
      if (value === h.present) return h;
      return { past: merge && h.past.length ? h.past : [...h.past, h.present].slice(-50), present: value, future: [] };
    });
  };
  const undo = () => {
    lastEdit.current = 0;
    setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  };
  const redo = () => {
    lastEdit.current = 0;
    setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => {
    const pending = takePendingPhoto();
    if (!pending || pending.kind === 'blank') {
      router.replace('/');
      return;
    }
    const intent = pending.intent;
    if (intent?.type === 'adjust' && intent.preset) {
      const { preset: id, intensity = 100 } = intent;
      // The user's own recipes are stored on the device; make sure they are loaded before looking one up.
      loadCustomPresets().then(() => {
        const preset = findPreset(id);
        if (!preset) return;
        trackPreset(preset.id);
        setHist({ past: [], present: presetDevelop(preset, intensity), future: [] });
      });
    }
    loadPendingPair(pending)
      .then((p) => {
        setImage(p.image);
        setFull(p.full ?? p.image);
      })
      .catch((e) => {
        notify(e.message ?? t('common.cantOpenPhoto'));
        leave();
      })
      .finally(() => setBusy(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Film strip: the photo with each color look.
  useEffect(() => {
    if (!image) return;
    let alive = true;
    (async () => {
      const small = await resizeImage(image, 160);
      const entries = await Promise.all(
        filters.map(async (f) => [
          f.id,
          await renderThumbnail(
            <SkImageNode image={small} x={0} y={0} width={112} height={112} fit="cover">
              <ColorMatrix matrix={buildMatrix(f.id, defaultAdjust)} />
            </SkImageNode>,
            112,
            112,
          ),
        ]),
      );
      if (alive) setLooks(Object.fromEntries(entries));
    })();
    return () => {
      alive = false;
    };
  }, [image]);

  const set = <G extends 'light' | 'color' | 'detail'>(group: G, key: keyof Develop[G], v: number) =>
    setDevelop((d) => ({ ...d, [group]: { ...d[group], [key]: v } }));

  /** Applies the develop settings to the given picture at its own size. */
  const render = (img: SkImage | null) => {
    if (!img) throw new Error(t('adjust.noPhoto'));
    const w = img.width();
    const h = img.height();
    return renderImage(<DevelopedImage image={img} develop={develop} width={w} height={h} />, w, h);
  };

  const openExport = async () => {
    setMenu(false);
    setBusy(t('common.preparing'));
    try {
      setPendingExport(await render(full));
      router.push('/export');
    } catch (e: any) {
      showToast(e.message ?? t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const openEditor = async () => {
    setMenu(false);
    setBusy(t('adjust.openingEditor'));
    try {
      const fullOut = full && full !== image ? await render(full) : undefined;
      setPendingPhoto({ kind: 'image', image: await render(image), full: fullOut });
      router.replace('/editor');
    } catch (e: any) {
      showToast(e.message ?? t('common.error'));
      setBusy(null);
    }
  };

  const askRecipe = async () => {
    setMenu(false);
    if (isDefault(develop)) {
      showToast(t('recipe.adjustFirst'));
      return;
    }
    setRecipeName(nextRecipeName(await loadCustomPresets()));
  };

  const saveRecipe = async () => {
    const name = recipeName ?? '';
    setRecipeName(null);
    if (!image) return;
    try {
      const small = await resizeImage(image, 480);
      const thumb = await renderJpegThumbnail(<DevelopedImage image={small} develop={develop} width={360} height={280} fit="cover" />, 360, 280);
      const p = await addCustomPreset(name, develop, thumb);
      showToast(t('recipe.savedToPresets', { name: p.name }));
    } catch (e: any) {
      showToast(e.message ?? t('recipe.saveFailed'));
    }
  };

  const range = hslRanges.find((r) => r.id === hslRange)!;
  const hslValues = develop.hsl[hslRange];
  const setHsl = (key: 'hue' | 'sat' | 'lum', v: number) =>
    setDevelop((d) => ({ ...d, hsl: { ...d.hsl, [hslRange]: { ...d.hsl[hslRange], [key]: v } } }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.column}>
        <View style={styles.header}>
          <IconButton icon={{ set: 'ion', name: 'chevron-back' }} onPress={leave} />
          <Text style={styles.title} numberOfLines={1}>
            {t('adjust.title')}
          </Text>
          <View style={styles.headerRight}>
            <Pressable hitSlop={6} onPress={undo} disabled={!hist.past.length} accessibilityLabel={t('common.undo')} style={!hist.past.length && styles.dim}>
              <Ionicons name="arrow-undo-outline" size={21} color={colors.text} />
            </Pressable>
            <Pressable hitSlop={6} onPress={redo} disabled={!hist.future.length} accessibilityLabel={t('common.redo')} style={!hist.future.length && styles.dim}>
              <Ionicons name="arrow-redo-outline" size={21} color={colors.text} />
            </Pressable>
            <Pressable hitSlop={6} onPress={askRecipe} disabled={!image} accessibilityLabel={t('adjust.saveRecipe')}>
              <Ionicons name="bookmark-outline" size={20} color={colors.text} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => setMenu(true)} disabled={!image}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </Pressable>
            {!narrow && (
              <View style={styles.proPill}>
                <MaterialCommunityIcons name="crown" size={13} color={colors.gold} />
                <Text style={styles.proText}>PRO</Text>
              </View>
            )}
            <HomeButton style={{ minWidth: 0, paddingHorizontal: 0 }} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {image ? (
            <Preview image={image} develop={develop} showOriginal={comparing} />
          ) : (
            <View style={[styles.previewArea, styles.center]}>
              <ActivityIndicator color={colors.gold} />
            </View>
          )}
          {image && (
            <Pressable
              accessibilityLabel={t('adjust.holdOriginal')}
              onPressIn={() => setComparing(true)}
              onPressOut={() => setComparing(false)}
              style={styles.compareBtn}
            >
              <Ionicons name="contrast-outline" size={18} color="#FFFFFF" />
            </Pressable>
          )}
        </View>

        <View style={styles.tabs}>
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable key={item.id} onPress={() => setTab(item.id)} style={[styles.tab, active && styles.tabActive]}>
                <Icon icon={item.icon} size={21} color={active ? colors.gold : colors.text} />
                <Text numberOfLines={1} style={[styles.tabLabel, active && { color: colors.gold }]}>
                  {t(`adjust.tab.${item.id}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.panel}>
          {tab === 'curves' ? (
            <CurveEditor curves={develop.curves} onChange={(ch, pts) => setDevelop((d) => ({ ...d, curves: { ...d.curves, [ch]: pts } }))} />
          ) : (
            <ScrollView contentContainerStyle={styles.sliders} showsVerticalScrollIndicator={false}>
              {tab === 'light' &&
                lightSliders.map((s) => (
                  <ToneSlider key={s.key} label={t(s.label)} min={s.min} max={s.max} gradient={s.gradient} value={develop.light[s.key]} onChange={(v) => set('light', s.key, v)} />
                ))}
              {tab === 'color' &&
                colorSliders.map((s) => (
                  <ToneSlider key={s.key} label={t(s.label)} min={s.min} max={s.max} gradient={s.gradient} value={develop.color[s.key]} onChange={(v) => set('color', s.key, v)} />
                ))}
              {tab === 'detail' &&
                detailSliders.map((s) => (
                  <ToneSlider key={s.key} label={t(s.label)} min={s.min} max={s.max} gradient={s.gradient} value={develop.detail[s.key]} onChange={(v) => set('detail', s.key, v)} />
                ))}
              {tab === 'hsl' && (
                <>
                  <View style={styles.hslDots}>
                    {hslRanges.map((r) => (
                      <Pressable
                        key={r.id}
                        accessibilityLabel={t(r.label)}
                        onPress={() => setHslRange(r.id)}
                        style={[styles.hslDotRing, hslRange === r.id && { borderColor: colors.text }]}
                      >
                        <View style={[styles.hslDot, { backgroundColor: r.color }]} />
                      </Pressable>
                    ))}
                  </View>
                  <ToneSlider
                    label={t('develop.hue', { range: t(range.label) })}
                    min={-100}
                    max={100}
                    value={hslValues.hue}
                    gradient={[hslColor(range.center - 30), hslColor(range.center), hslColor(range.center + 30)]}
                    onChange={(v) => setHsl('hue', v)}
                  />
                  <ToneSlider
                    label={t('develop.hslSat')}
                    min={-100}
                    max={100}
                    value={hslValues.sat}
                    gradient={[hslColor(range.center, 0), hslColor(range.center, 95)]}
                    onChange={(v) => setHsl('sat', v)}
                  />
                  <ToneSlider
                    label={t('develop.hslLum')}
                    min={-100}
                    max={100}
                    value={hslValues.lum}
                    gradient={[hslColor(range.center, 80, 12), hslColor(range.center), hslColor(range.center, 80, 92)]}
                    onChange={(v) => setHsl('lum', v)}
                  />
                </>
              )}
            </ScrollView>
          )}
        </View>

        <HScroll style={{ flexGrow: 0 }} contentContainerStyle={styles.strip}>
          {filters.map((f) => (
            <Pressable key={f.id} accessibilityLabel={filterName(f.id)} onPress={() => setDevelop((d) => ({ ...d, look: f.id }))}>
              <View style={[styles.look, develop.look === f.id && styles.lookActive]}>
                {looks[f.id] ? <Image source={{ uri: looks[f.id] }} style={styles.lookImg} /> : null}
              </View>
            </Pressable>
          ))}
        </HScroll>

        <View style={styles.actions}>
          <Pressable
            disabled={isDefault(develop)}
            onPress={() => setDevelop(defaultDevelop())}
            style={[styles.resetBtn, isDefault(develop) && { opacity: 0.4 }]}
          >
            <Ionicons name="refresh" size={18} color={colors.text} />
            <Text style={styles.resetText}>{t('common.reset')}</Text>
          </Pressable>
          <Pressable disabled={!image || !!busy} onPress={openExport} style={({ pressed }) => [{ flex: 1.2 }, pressed && { opacity: 0.85 }]}>
            <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtn}>
              <Text style={styles.saveText}>{t('common.save')}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.onGold} />
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenu(false)}>
          <View style={styles.menu}>
            <MenuItem icon="bookmark-outline" label={t('adjust.menuRecipe')} onPress={askRecipe} />
            <MenuItem icon="color-wand-outline" label={t('adjust.menuEditor')} onPress={openEditor} />
            <MenuItem icon="share-outline" label={t('adjust.menuExport')} onPress={openExport} />
            <MenuItem icon="close" label={t('common.close')} onPress={() => setMenu(false)} />
          </View>
        </Pressable>
      </Modal>

      <Dialog
        visible={recipeName !== null}
        title={t('recipe.saveTitle')}
        message={t('recipe.saveMsgAdjust')}
        input={{ value: recipeName ?? '', onChange: setRecipeName, placeholder: t('recipe.namePlaceholder') }}
        onClose={() => setRecipeName(null)}
        actions={[
          { label: t('common.save'), primary: true, onPress: saveRecipe },
          { label: t('common.cancel'), onPress: () => setRecipeName(null) },
        ]}
      />

      {busy && image && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.overlayText}>{busy}</Text>
        </View>
      )}
      {toast && (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: 'bookmark-outline' | 'color-wand-outline' | 'share-outline' | 'close';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surface2 }]}>
      <Ionicons name={icon} size={20} color={colors.gold} />
      <Text style={styles.menuText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  column: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 14, paddingBottom: 8, gap: 10 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 },
  title: { flexShrink: 1, fontFamily: font.semi, fontSize: 17, color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dim: { opacity: 0.3 },
  proPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.gold, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  proText: { fontFamily: font.bold, fontSize: 11, color: colors.gold, letterSpacing: 1 },
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photo: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface2 },
  originalTag: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  originalText: { fontFamily: font.medium, fontSize: 12, color: '#FFFFFF' },
  compareBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  tabActive: { borderColor: colors.goldDeep, backgroundColor: colors.goldSoft },
  tabLabel: { fontFamily: font.medium, fontSize: 10.5, color: colors.text },
  panel: { height: 176, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12 },
  sliders: { gap: 6 },
  hslDots: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  hslDotRing: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  hslDot: { width: 20, height: 20, borderRadius: 10 },
  strip: { gap: 8 },
  look: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface2 },
  lookActive: { borderColor: colors.gold },
  lookImg: { width: '100%', height: '100%' },
  actions: { flexDirection: 'row', gap: 10 },
  resetBtn: {
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
  resetText: { fontFamily: font.medium, fontSize: 14, color: colors.text },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 14 },
  saveText: { fontFamily: font.semi, fontSize: 16, color: colors.onGold },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(42,32,24,0.25)', alignItems: 'flex-end', paddingTop: 60, paddingRight: 16 },
  menu: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, minWidth: 230 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  menuText: { fontFamily: font.medium, fontSize: 14, color: colors.text },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(250,246,240,0.82)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  overlayText: { fontFamily: font.medium, fontSize: 14, color: colors.text },
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
