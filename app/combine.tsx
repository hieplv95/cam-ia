import { Ionicons } from '@expo/vector-icons';
import { type SkImage } from '@shopify/react-native-skia';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiCombine } from '@/src/ai/client';
import { combineIdeas, combineRatios, MAX_COMBINE, MAX_COMBINE_PROMPT, MIN_COMBINE, type CombineRatio } from '@/src/ai/combine';
import { encodeBase64, imageFromBase64, loadPendingPair, resizeImage } from '@/src/editor/imageOps';
import { HScroll } from '@/src/HScroll';
import { ModelChip } from '@/src/ModelPicker';
import { notify } from '@/src/notify';
import { setPendingExport, setPendingPhoto } from '@/src/pendingPhoto';
import { cardShadow, colors, font, goldGradient } from '@/src/theme';
import { HomeButton, IconButton } from '@/src/ui';
import { useT } from '@/src/i18n';

/**
 * "Ghép ảnh AI": 2–4 photos plus a description ("put the people from photo 1 and 2 on the beach from photo 3"),
 * sent together in one AI call that returns a single picture.
 */
type Photo = { id: number; uri: string; image: SkImage };
type Result = { b64: string; image: SkImage; key: string };

let nextId = 1;

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function Combine() {
  const t = useT();
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState<CombineRatio>('auto');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const key = JSON.stringify([photos.map((p) => p.id), prompt.trim(), ratio]);
  const stale = !result || result.key !== key;
  const problem = photos.length < MIN_COMBINE ? t('combine.needPhotos') : !prompt.trim() ? t('combine.needPrompt') : null;
  const room = MAX_COMBINE - photos.length;

  const addFrom = async (source: 'library' | 'camera') => {
    if (room <= 0 || adding) return;
    try {
      if (source === 'camera') {
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) return notify(t('source.cameraPermission'));
      }
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.9,
              allowsMultipleSelection: true,
              selectionLimit: room,
              orderedSelection: true,
            });
      const assets = res.canceled ? [] : (res.assets ?? []);
      if (!assets.length) return;
      // Some pickers (the web one) ignore the limit.
      if (assets.length > room) notify(t('combine.max', { max: MAX_COMBINE }));
      setAdding(true);
      const added: Photo[] = [];
      for (const a of assets.slice(0, room)) {
        const p = await loadPendingPair({ kind: 'uri', uri: a.uri });
        added.push({ id: nextId++, uri: a.uri, image: p.image });
      }
      setPhotos((list) => [...list, ...added].slice(0, MAX_COMBINE));
    } catch (e: any) {
      notify(e?.message ?? t('common.cantOpenPhoto'));
    } finally {
      setAdding(false);
    }
  };

  const remove = (id: number) => setPhotos((list) => list.filter((p) => p.id !== id));

  const run = async () => {
    if (problem || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const images = await Promise.all(photos.map(async (p) => encodeBase64(await resizeImage(p.image, 1024), 88)));
      const out = await aiCombine(images, prompt.trim(), ratio);
      setResult({ b64: out.image, image: await imageFromBase64(out.image), key });
      setMessage(`Xong ✨ ${out.summary}`);
    } catch (e: any) {
      setMessage(e?.message ?? t('common.aiError'));
    } finally {
      setBusy(false);
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

  const startOver = () => {
    if (busy) return;
    setPhotos([]);
    setPrompt('');
    setRatio('auto');
    setResult(null);
    setMessage(null);
  };

  const home = () => (router.canDismiss() ? router.dismissTo('/') : router.replace('/'));
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const resultAspect = result ? result.image.width() / result.image.height() : 3 / 4;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon={{ set: 'ion', name: 'chevron-back' }} onPress={leave} />
        <Text style={styles.title}>{t('combine.title')}</Text>
        <HomeButton />
      </View>

      <ScrollView contentContainerStyle={styles.column} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {(result || busy) && (
          <View style={[styles.preview, { aspectRatio: resultAspect }]}>
            {result ? <Image source={{ uri: `data:image/png;base64,${result.b64}` }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : null}
            {busy && (
              <View style={styles.busy}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.busyText}>{t('combine.working')}</Text>
              </View>
            )}
          </View>
        )}

        {message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.labelRow}>
          <Text style={styles.label}>{t('combine.photos', { n: photos.length, max: MAX_COMBINE })}</Text>
          {Platform.OS !== 'web' && room > 0 && (
            <Pressable onPress={() => addFrom('camera')} hitSlop={8} style={styles.cameraBtn}>
              <Ionicons name="camera-outline" size={16} color={colors.goldDeep} />
              <Text style={styles.cameraText}>{t('combine.camera')}</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.slots}>
          {photos.map((p, i) => (
            <View key={p.id} style={styles.slot}>
              <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={styles.number}>
                <Text style={styles.numberText}>{i + 1}</Text>
              </View>
              <Pressable onPress={() => remove(p.id)} disabled={busy} hitSlop={6} style={styles.remove} accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
          {room > 0 && (
            <Pressable onPress={() => addFrom('library')} disabled={adding || busy} style={({ pressed }) => [styles.slot, styles.addSlot, pressed && { opacity: 0.7 }]}>
              {adding ? <ActivityIndicator color={colors.gold} /> : <Ionicons name="add" size={26} color={colors.gold} />}
              <Text style={styles.addText}>{t('combine.add')}</Text>
            </Pressable>
          )}
          {/* Keeps the slots the same size when the row is not full. */}
          {Array.from({ length: Math.max(0, room - 1) }, (_, i) => (
            <View key={`empty${i}`} style={[styles.slot, styles.emptySlot]} />
          ))}
        </View>
        <Text style={styles.hint}>{t('combine.hint')}</Text>

        <Text style={styles.label}>{t('combine.describe')}</Text>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder={t('combine.placeholder')}
          placeholderTextColor={colors.textMute}
          style={styles.input}
          multiline
          maxLength={MAX_COMBINE_PROMPT}
          editable={!busy}
        />
        <HScroll contentContainerStyle={styles.chips}>
          {combineIdeas.map((idea) => (
            <Chip key={idea} label={t(idea)} onPress={() => setPrompt(t(idea))} />
          ))}
        </HScroll>

        <Text style={styles.label}>{t('combine.ratio')}</Text>
        <View style={styles.wrap}>
          {combineRatios.map((r) => (
            <Chip key={r} label={r === 'auto' ? t('combine.auto') : r} active={ratio === r} onPress={() => setRatio(r)} />
          ))}
        </View>

        <ModelChip style={{ marginTop: 4 }} />

        {problem && stale ? <Text style={styles.problem}>{problem}</Text> : null}

        {result && !stale && !busy ? (
          <View style={styles.actions}>
            <Pressable onPress={edit} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
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
          <Pressable disabled={!!problem || busy} onPress={run} style={({ pressed }) => [(pressed || busy || !!problem) && { opacity: 0.55 }]}>
            <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
              <Ionicons name="sparkles" size={17} color={colors.onGold} />
              <Text style={styles.primaryText}>{result ? t('combine.again') : t('combine.run')}</Text>
            </LinearGradient>
          </Pressable>
        )}

        {result && (
          <View style={styles.nextRow}>
            <Pressable onPress={startOver} disabled={busy} style={({ pressed }) => [styles.nextBtn, (pressed || busy) && { opacity: 0.6 }]}>
              <Ionicons name="images-outline" size={16} color={colors.textSoft} />
              <Text style={styles.nextText} numberOfLines={1}>
                {t('studio.another')}
              </Text>
            </Pressable>
            <Pressable onPress={home} disabled={busy} style={({ pressed }) => [styles.nextBtn, (pressed || busy) && { opacity: 0.6 }]}>
              <Ionicons name="home-outline" size={16} color={colors.textSoft} />
              <Text style={styles.nextText} numberOfLines={1}>
                {t('studio.home')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 },
  title: { fontFamily: font.serif, fontSize: 22, color: colors.text },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  preview: {
    width: '100%',
    maxHeight: 460,
    alignSelf: 'center',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(42,32,24,0.45)', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  busyText: { fontFamily: font.medium, fontSize: 14, color: '#FFFFFF', textAlign: 'center' },
  message: { fontFamily: font.medium, fontSize: 13, color: colors.goldDeep, textAlign: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  label: { fontFamily: font.semi, fontSize: 15, color: colors.text, marginTop: 6 },
  cameraBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  cameraText: { fontFamily: font.medium, fontSize: 13, color: colors.goldDeep },
  slots: { flexDirection: 'row', gap: 8 },
  slot: { flex: 1, aspectRatio: 3 / 4, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface2 },
  addSlot: { alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.gold, backgroundColor: colors.surface },
  emptySlot: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'transparent' },
  addText: { fontFamily: font.medium, fontSize: 11, color: colors.goldDeep, textAlign: 'center' },
  number: {
    position: 'absolute',
    left: 6,
    top: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontFamily: font.semi, fontSize: 12, color: colors.onGold },
  remove: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  input: {
    minHeight: 84,
    textAlignVertical: 'top',
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  chips: { gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  chipTextActive: { color: '#FFFFFF' },
  problem: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft, textAlign: 'center', marginBottom: -4 },
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
  nextRow: { flexDirection: 'row', gap: 10, marginTop: -4 },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 999 },
  nextText: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
});
