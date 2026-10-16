import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ImageFormat, type SkImage } from '@shopify/react-native-skia';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiEdit, aiStudio } from '@/src/ai/client';
import {
  defaultChoices,
  MAX_BRAND,
  MAX_EXTRA,
  MAX_TAGLINE,
  productSplit,
  REFERENCE_GROUP,
  REFERENCE_PALETTE,
  studioProblem,
  studioText,
  studioTool,
  studioTools,
  takesReference,
  type StudioChoices,
  type StudioGroup,
} from '@/src/ai/studio';
import { CompareView } from '@/src/CompareView';
import { encodeBase64, imageFromBase64, loadPendingPair, resizeImage } from '@/src/editor/imageOps';
import { featuredImages } from '@/src/featuredImages';
import { HScroll } from '@/src/HScroll';
import { ModelChip } from '@/src/ModelPicker';
import { notify } from '@/src/notify';
import { usePhotoSource } from '@/src/photoSource';
import { saveImage } from '@/src/save';
import { setPendingExport, setPendingPhoto, takePendingPhoto } from '@/src/pendingPhoto';
import { colors, font, goldGradient } from '@/src/theme';
import { HomeButton, IconButton } from '@/src/ui';
import { useT, type MessageKey } from '@/src/i18n';

/**
 * Featured AI tools (Phục hồi ảnh cũ, Hairstyle & Makeup, Product Studio, Tạo logo).
 * Each run costs one AI call; nothing is sent until the user presses the main button.
 */
type Result = { b64: string; image: SkImage; key: string };

export default function Studio() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ tool?: string }>();
  const tool = studioTool(params.tool) ?? studioTools[0];

  const [photo, setPhoto] = useState<SkImage | null>(null);
  const [choices, setChoices] = useState<StudioChoices>(() => defaultChoices(tool));
  const [brand, setBrand] = useState('');
  const [tagline, setTagline] = useState('');
  // Logo maker: an optional image to take ideas from (style, shapes, colors).
  const [reference, setReference] = useState<{ image: SkImage; uri: string } | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);
  const isLogo = tool.id === 'logo';
  // Every tool: an extra request typed before running, and edits of the result described in words afterwards.
  const [extra, setExtra] = useState('');
  const [refine, setRefine] = useState('');
  const [previous, setPrevious] = useState<{ index: number; item: Result }[]>([]);
  // Usually one result; the product studio can make one per product (shown as a strip to switch between).
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const result = results[active] ?? null;
  const setResult = (item: Result) => setResults((list) => list.map((r, i) => (i === active ? item : r)));
  const [busy, setBusy] = useState<string | null>(tool.needsPhoto ? t('common.openingPhoto') : null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const { choose } = usePhotoSource();

  /** After a result: the same tool again, with a new photo (the logo tool, which has no photo, just clears its result). */
  const another = () => {
    if (busy) return;
    if (tool.needsPhoto) return choose({ type: 'studio', tool: tool.id }, { replace: true });
    setResults([]);
    setActive(0);
    setPrevious([]);
    setRefine('');
  };
  const home = () => (router.canDismiss() ? router.dismissTo('/') : router.replace('/'));

  useEffect(() => {
    if (!tool.needsPhoto) return;
    const pending = takePendingPhoto();
    if (!pending || pending.kind === 'blank' || pending.kind === 'draft') {
      router.replace('/');
      return;
    }
    loadPendingPair(pending)
      .then((p) => setPhoto(p.image))
      .catch((e) => {
        notify(e.message ?? t('common.cantOpenPhoto'));
        leave();
      })
      .finally(() => setBusy(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key = JSON.stringify([choices, brand.trim(), tagline.trim(), reference?.uri ?? null, extra.trim()]);
  const stale = !result || result.key !== key;
  const problem = studioProblem(tool, choices, brand, !!reference, !!extra.trim());
  // The AI may return a different shape (e.g. a wider product shot); a before/after split would stretch it.
  const sameShape = !!photo && !!result && Math.abs(photo.width() / photo.height() - result.image.width() / result.image.height()) < 0.02;

  const pick = (g: StudioGroup, id: string) =>
    setChoices((c) => {
      const cur = c[g.id] ?? [];
      // A logo idea also picks the style, layout and colors that suit it (each can still be changed).
      const sets = g.options.find((o) => o.id === id)?.sets ?? {};
      if (!g.multi) return { ...c, ...Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, [v]])), [g.id]: [id] };
      return { ...c, [g.id]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });

  const pickReference = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      const uri = res.canceled ? null : res.assets?.[0]?.uri;
      if (!uri) return;
      setLoadingRef(true);
      const p = await loadPendingPair({ kind: 'uri', uri });
      setReference({ image: p.image, uri });
    } catch (e: any) {
      notify(e?.message ?? t('common.cantOpenPhoto'));
    } finally {
      setLoadingRef(false);
    }
  };

  const removeReference = () => {
    setReference(null);
    // "Like the reference" means nothing without one.
    const palette = tool.groups.find((g) => g.id === 'palette');
    if (palette && choices.palette?.includes(REFERENCE_PALETTE)) setChoices((c) => ({ ...c, palette: [...palette.defaults] }));
  };

  const run = async () => {
    if (problem || busy || (tool.needsPhoto && !photo)) return;
    setBusy(t(studioText.tool(tool, 'busy')));
    try {
      const source = photo ?? reference?.image ?? null;
      const input = source ? encodeBase64(await resizeImage(source, 1024), 90) : null;
      const count = tool.id === 'product' ? productSplit(choices) : 1;
      if (count > 1) {
        // One request per product, left to right; each one appears as soon as it is ready.
        const made: Result[] = [];
        let summary = '';
        for (let index = 0; index < count; index++) {
          setBusy(t('studio.product.splitBusy', { i: index + 1, n: count }));
          try {
            const out = await aiStudio(tool.id, choices, input, { extra: extra.trim(), part: { index, count } });
            made.push({ b64: out.image, image: await imageFromBase64(out.image), key });
            setResults([...made]);
            setActive(made.length - 1);
            summary = out.summary;
          } catch (e: any) {
            if (!made.length) throw e;
            showToast(e.message ?? t('common.aiError'));
            break;
          }
        }
        setPrevious([]);
        if (made.length === count) showToast(`Xong ✨ ${summary}`);
        return;
      }
      const out = await aiStudio(tool.id, choices, input, tool.id === 'logo' ? { brand: brand.trim(), tagline: tagline.trim(), extra: extra.trim() } : { extra: extra.trim() });
      setResults([{ b64: out.image, image: await imageFromBase64(out.image), key }]);
      setActive(0);
      setPrevious([]);
      showToast(`Xong ✨ ${out.summary}`);
    } catch (e: any) {
      showToast(e.message ?? t('common.aiError'));
    } finally {
      setBusy(null);
    }
  };

  // Edit the result by describing the change (logos are edited as logos: same design, only the asked change).
  const refineResult = async () => {
    const prompt = refine.trim();
    if (!result || !prompt || busy) return;
    setBusy(t(isLogo ? 'studio.refineBusy' : 'studio.refinePhotoBusy'));
    try {
      const out = await aiEdit(encodeBase64(await resizeImage(result.image, 1024), 92), isLogo ? { prompt, target: 'logo' } : { prompt });
      setPrevious((p) => [...p, { index: active, item: result }]);
      setResult({ b64: out.image, image: await imageFromBase64(out.image), key: result.key });
      setRefine('');
      showToast(`Xong ✨ ${out.summary}`);
    } catch (e: any) {
      showToast(e.message ?? t('common.aiError'));
    } finally {
      setBusy(null);
    }
  };

  const restorePrevious = () => {
    const last = previous[previous.length - 1];
    if (!last) return;
    setPrevious((p) => p.slice(0, -1));
    setResults((list) => list.map((r, i) => (i === last.index ? last.item : r)));
    setActive(last.index);
  };

  /** Saves every result at once (one picture per product). */
  const saveAll = async () => {
    let msg = '';
    try {
      for (const r of results) msg = await saveImage(r.image.encodeToBytes(ImageFormat.JPEG, 92), 'jpg');
      showToast(msg);
    } catch (e: any) {
      showToast(e.message ?? t('export.failed'));
    }
  };

  const edit = () => {
    if (!result) return;
    setPendingPhoto({ kind: 'base64', data: result.b64 });
    router.push('/editor');
  };

  const save = () => {
    if (!result) return;
    setPendingExport(result.image);
    router.push('/export');
  };

  // A written request, on top of the options (any language).
  const extraInput = (
    <TextInput
      value={extra}
      onChangeText={setExtra}
      placeholder={t(isLogo ? 'studio.extraPlaceholder' : (`studio.${tool.id}.extra` as MessageKey))}
      placeholderTextColor={colors.textMute}
      maxLength={MAX_EXTRA}
      multiline
      style={[styles.input, styles.extra, isLogo && styles.logoExtra]}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.column}>
        <View style={styles.header}>
          <IconButton icon={{ set: 'ion', name: 'chevron-back' }} onPress={leave} />
          <Text style={styles.title} numberOfLines={1}>
            {t(studioText.tool(tool, 'title'))}
          </Text>
          <View style={styles.headerRight}>
            <View style={styles.proPill}>
              <MaterialCommunityIcons name="crown" size={13} color={colors.gold} />
              <Text style={styles.proText}>PRO</Text>
            </View>
            <HomeButton />
          </View>
        </View>

        {/* Preview: the photo with a before/after divider, or the logo. */}
        {tool.needsPhoto ? (
          photo ? (
            result && (!sameShape || results.length > 1) ? (
              <CompareView original={result.image} result={null} busy={busy} />
            ) : (
              <CompareView
                original={photo}
                result={result?.image ?? null}
                busy={busy}
                hint={t('studio.hint', { action: t(studioText.tool(tool, 'action')) })}
              />
            )
          ) : (
            <View style={[styles.preview, styles.center]}>
              <ActivityIndicator color={colors.gold} />
            </View>
          )
        ) : (
          <View style={[styles.preview, styles.center]}>
            <View style={styles.logoBox}>
              {result ? (
                <Image source={{ uri: `data:image/png;base64,${result.b64}` }} style={StyleSheet.absoluteFill} resizeMode="contain" />
              ) : reference ? (
                <>
                  <Image source={{ uri: reference.uri }} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} resizeMode="contain" />
                  <View style={styles.refBadge}>
                    <Ionicons name="bulb-outline" size={13} color={colors.goldDeep} />
                    <Text style={styles.refBadgeText}>{t('studio.logo.reference')}</Text>
                  </View>
                </>
              ) : (
                <Image
                  source={featuredImages[tool.id]}
                  style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: 0.45 }]}
                  resizeMode="contain"
                />
              )}
              {!result && !busy && (
                <View style={styles.logoHint}>
                  <Text style={styles.logoHintText}>
                    {reference ? t('studio.logoHintRef', { action: t(studioText.tool(tool, 'action')) }) : t('studio.logoHint')}
                  </Text>
                </View>
              )}
              {busy && (
                <View style={styles.busy}>
                  <ActivityIndicator color={colors.gold} />
                  <Text style={styles.busyText}>{busy}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {results.length > 1 && (
          <View style={styles.resultsRow}>
            <HScroll contentContainerStyle={styles.results}>
              {results.map((r, i) => (
                <Pressable key={i} onPress={() => setActive(i)} style={[styles.resultThumb, i === active && styles.resultThumbActive]} accessibilityLabel={`${i + 1}/${results.length}`}>
                  <Image source={{ uri: `data:image/png;base64,${r.b64}` }} style={styles.resultImg} resizeMode="cover" />
                  <Text style={styles.resultNo}>{i + 1}</Text>
                </Pressable>
              ))}
            </HScroll>
            {!stale && (
              <Pressable onPress={saveAll} disabled={!!busy} style={({ pressed }) => [styles.saveAll, pressed && { opacity: 0.8 }]}>
                <Ionicons name="download-outline" size={16} color={colors.goldDeep} />
                <Text style={styles.saveAllText}>{t('studio.saveAll', { n: results.length })}</Text>
              </Pressable>
            )}
          </View>
        )}

        <ScrollView
          style={styles.controls}
          contentContainerStyle={{ gap: 10 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {tool.id === 'logo' && (
            <View style={styles.inputs}>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder={reference ? t('studio.brandOptional') : t('studio.brandPlaceholder')}
                placeholderTextColor={colors.textMute}
                maxLength={MAX_BRAND}
                style={styles.input}
              />
              <TextInput
                value={tagline}
                onChangeText={setTagline}
                placeholder={t('studio.taglinePlaceholder')}
                placeholderTextColor={colors.textMute}
                maxLength={MAX_TAGLINE}
                style={styles.input}
              />
              {/* The description of the wanted logo, right under the brand name and business. */}
              {extraInput}
            </View>
          )}

          {takesReference(tool) && (
            <View style={{ gap: 6 }}>
              <Text style={styles.groupLabel}>{t('studio.logo.reference')}</Text>
              {reference ? (
                <View style={styles.refRow}>
                  <Image source={{ uri: reference.uri }} style={styles.refThumb} resizeMode="cover" />
                  <Text style={styles.refHint}>{t('studio.logo.referenceHint')}</Text>
                  <View style={{ gap: 6 }}>
                    <Pressable onPress={pickReference} disabled={!!busy || loadingRef} style={styles.refBtn}>
                      <Text style={styles.refBtnText}>{t('studio.logo.referenceChange')}</Text>
                    </Pressable>
                    <Pressable onPress={removeReference} disabled={!!busy} style={styles.refBtn} accessibilityLabel={t('studio.logo.referenceRemove')}>
                      <Ionicons name="close" size={16} color={colors.textSoft} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={pickReference} disabled={!!busy || loadingRef} style={({ pressed }) => [styles.refAdd, pressed && { opacity: 0.75 }]}>
                  {loadingRef ? <ActivityIndicator color={colors.gold} /> : <Ionicons name="image-outline" size={20} color={colors.gold} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.refAddText}>{t('studio.logo.referenceAdd')}</Text>
                    <Text style={styles.refHint}>{t('studio.logo.referenceHint')}</Text>
                  </View>
                </Pressable>
              )}
            </View>
          )}

          {tool.groups.filter((g) => g.id !== REFERENCE_GROUP || reference).map((g) => (
            <View key={g.id} style={{ gap: 6 }}>
              <Text style={styles.groupLabel}>
                {t(studioText.group(tool, g))}
                {g.multi ? <Text style={styles.groupHint}>{t('studio.multi')}</Text> : null}
              </Text>
              <HScroll contentContainerStyle={styles.chips}>
                {g.options.filter((o) => o.id !== REFERENCE_PALETTE || reference).map((o) => {
                  const active = choices[g.id]?.includes(o.id);
                  return (
                    <Pressable key={o.id} onPress={() => pick(g, o.id)} style={[styles.chip, active && styles.chipActive]}>
                      {g.multi && (
                        <Ionicons
                          name={active ? 'checkmark-circle' : 'ellipse-outline'}
                          size={15}
                          color={active ? colors.onGold : colors.textMute}
                        />
                      )}
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(studioText.option(tool, g, o))}</Text>
                    </Pressable>
                  );
                })}
              </HScroll>
            </View>
          ))}

          {!isLogo && extraInput}

          <ModelChip />
        </ScrollView>

        {problem && stale ? <Text style={styles.problem}>{t(problem)}</Text> : null}
        {!problem && stale && tool.id === 'product' && productSplit(choices) > 1 ? (
          <Text style={styles.problem}>{t('studio.product.splitCost', { n: productSplit(choices) })}</Text>
        ) : null}

        {result && !stale && (
          <View style={styles.refineRow}>
            {previous.length > 0 && (
              <Pressable onPress={restorePrevious} disabled={!!busy} style={styles.prevBtn} accessibilityLabel={t('studio.previous')}>
                <Ionicons name="arrow-undo-outline" size={16} color={colors.text} />
                <Text style={styles.prevText}>{t('studio.previous')}</Text>
              </Pressable>
            )}
            <View style={styles.refineBox}>
              <Ionicons name="sparkles" size={15} color={colors.gold} />
              <TextInput
                value={refine}
                onChangeText={setRefine}
                placeholder={t(isLogo ? 'studio.refinePlaceholder' : 'studio.refinePhoto')}
                placeholderTextColor={colors.textMute}
                maxLength={300}
                onSubmitEditing={refineResult}
                returnKeyType="send"
                editable={!busy}
                style={styles.refineInput}
              />
              <Pressable
                onPress={refineResult}
                disabled={!refine.trim() || !!busy}
                style={[styles.refineSend, (!refine.trim() || !!busy) && { opacity: 0.4 }]}
                accessibilityLabel={t('editor.aiPrompt.run')}
              >
                <Ionicons name="arrow-up" size={17} color={colors.onGold} />
              </Pressable>
            </View>
          </View>
        )}

        {result && !stale ? (
          <View style={styles.actions}>
            <Pressable onPress={edit} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
              {/* Opens the result in the full editor (crop, colors, beauty, text, erase…). */}
              <Ionicons name="options-outline" size={18} color={colors.text} />
              <Text style={styles.secondaryText} numberOfLines={1}>
                {t('studio.openEditor')}
              </Text>
            </Pressable>
            <Pressable onPress={save} style={({ pressed }) => [{ flex: 1.2 }, pressed && { opacity: 0.85 }]}>
              <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
                <Ionicons name="download-outline" size={18} color={colors.onGold} />
                <Text style={styles.primaryText}>{t('common.saveImage')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <Pressable
            disabled={!!busy || !!problem || (tool.needsPhoto && !photo)}
            onPress={run}
            style={({ pressed }) => [(pressed || busy || problem) && { opacity: 0.55 }]}
          >
            <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
              <Ionicons name="sparkles" size={17} color={colors.onGold} />
              <Text style={styles.primaryText}>{result ? t('studio.again') : t(studioText.tool(tool, 'action'))}</Text>
            </LinearGradient>
          </Pressable>
        )}

        {results.length > 0 && (
          <View style={styles.nextRow}>
            <Pressable onPress={another} disabled={!!busy} style={({ pressed }) => [styles.nextBtn, (pressed || !!busy) && { opacity: 0.6 }]}>
              <Ionicons name={tool.needsPhoto ? 'images-outline' : 'add-circle-outline'} size={16} color={colors.textSoft} />
              <Text style={styles.nextText} numberOfLines={1}>
                {t('studio.another')}
              </Text>
            </Pressable>
            <Pressable onPress={home} disabled={!!busy} style={({ pressed }) => [styles.nextBtn, (pressed || !!busy) && { opacity: 0.6 }]}>
              <Ionicons name="home-outline" size={16} color={colors.textSoft} />
              <Text style={styles.nextText} numberOfLines={1}>
                {t('studio.home')}
              </Text>
            </Pressable>
          </View>
        )}
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
  column: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 14, paddingBottom: 8, gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, gap: 8 },
  title: { flex: 1, textAlign: 'center', fontFamily: font.semi, fontSize: 17, color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  proText: { fontFamily: font.bold, fontSize: 11, color: colors.gold, letterSpacing: 1 },
  preview: { flex: 1, minHeight: 200 },
  logoBox: {
    height: '100%',
    maxHeight: 420,
    aspectRatio: 1,
    maxWidth: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoHint: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, padding: 10 },
  logoHintText: { fontFamily: font.medium, fontSize: 13, color: '#FFFFFF', textAlign: 'center' },
  refBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  refBadgeText: { fontFamily: font.semi, fontSize: 11.5, color: colors.goldDeep },
  refAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refAddText: { fontFamily: font.semi, fontSize: 13.5, color: colors.text },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 8,
  },
  refThumb: { width: 58, height: 58, borderRadius: 10, backgroundColor: colors.surface2 },
  refHint: { flex: 1, fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: colors.textSoft },
  refBtn: {
    minWidth: 36,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refBtnText: { fontFamily: font.medium, fontSize: 12.5, color: colors.text },
  busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  busyText: { fontFamily: font.medium, fontSize: 14, color: '#FFFFFF', textAlign: 'center', paddingHorizontal: 20 },
  controls: { flexGrow: 0, maxHeight: '48%' },
  inputs: { gap: 8 },
  input: {
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
  groupLabel: { fontFamily: font.semi, fontSize: 14, color: colors.text },
  resultsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  results: { gap: 8 },
  resultThumb: { width: 54, height: 54, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface2 },
  resultThumbActive: { borderColor: colors.gold },
  resultImg: { width: '100%', height: '100%' },
  resultNo: {
    position: 'absolute',
    left: 4,
    top: 4,
    minWidth: 18,
    textAlign: 'center',
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#FFFFFF',
    fontFamily: font.semi,
    fontSize: 11,
  },
  saveAll: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.gold, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  saveAllText: { fontFamily: font.semi, fontSize: 13, color: colors.goldDeep },
  extra: { minHeight: 46, maxHeight: 90, textAlignVertical: 'top' },
  // Room for the three-line hint of the logo description.
  logoExtra: { minHeight: 82, maxHeight: 110 },
  refineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refineBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 4,
  },
  refineInput: { flex: 1, minWidth: 0, fontFamily: font.regular, fontSize: 14, color: colors.text, paddingVertical: 8 },
  refineSend: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  prevText: { fontFamily: font.medium, fontSize: 13, color: colors.text },
  groupHint: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  chips: { gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  chipTextActive: { color: colors.onGold },
  problem: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft, textAlign: 'center', marginBottom: -4 },
  actions: { flexDirection: 'row', gap: 10 },
  nextRow: { flexDirection: 'row', gap: 10, marginTop: -4 },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 999 },
  nextText: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
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
