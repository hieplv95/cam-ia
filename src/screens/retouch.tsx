import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import type { SkImage } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiEdit } from '@/src/ai/client';
import { retouchOptions, retouchStyles, type RetouchOptionId, type RetouchStyleId } from '@/src/ai/retouch';
import { Blend, CompareView } from '@/src/CompareView';
import { encodeBase64, imageFromBase64, loadPendingPair, renderImage, resizeImage } from '@/src/editor/imageOps';
import { photoImage } from '@/src/photos';
import { notify } from '@/src/notify';
import { ModelChip } from '@/src/ModelPicker';
import { setPendingPhoto, takePendingPhoto } from '@/src/pendingPhoto';
import { ReportAi } from '@/src/ReportAi';
import { RetouchToolCard } from '@/src/RetouchToolCard';
import { colors, font, goldGradient } from '@/src/theme';
import { HomeButton, IconButton } from '@/src/ui';
import { useT } from '@/src/i18n';


export default function Retouch() {
  const t = useT();
  const router = useRouter();
  const [original, setOriginal] = useState<SkImage | null>(null);
  const [result, setResult] = useState<SkImage | null>(null);
  const [resultKey, setResultKey] = useState('');
  const [style, setStyle] = useState<RetouchStyleId | null>('natural');
  const [selected, setSelected] = useState<RetouchOptionId[]>(['skin']);
  const [intensity, setIntensity] = useState(0.7);
  const [comparing, setComparing] = useState(false);
  const [busy, setBusy] = useState<string | null>(t('common.openingPhoto'));
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => {
    const pending = takePendingPhoto();
    if (!pending || pending.kind === 'blank') {
      router.replace('/');
      return;
    }
    loadPendingPair(pending)
      .then((p) => setOriginal(p.image))
      .catch((e) => {
        notify(e.message ?? t('common.cantOpenPhoto'));
        leave();
      })
      .finally(() => setBusy(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key = `${style ?? ''}|${[...selected].sort().join(',')}`;
  const nothing = !style && !selected.length;
  const stale = !result || resultKey !== key;

  const toggle = (id: RetouchOptionId) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const generate = async () => {
    if (!original || nothing) return;
    setBusy(t('retouch.working'));
    try {
      const small = await resizeImage(original, 1024);
      const out = await aiEdit(encodeBase64(small, 90), { preset: 'retouch', options: selected, ...(style && { style }) });
      setResult(await imageFromBase64(out.image));
      setResultKey(key);
      showToast(`Xong ✨ ${out.summary}`);
    } catch (e: any) {
      showToast(e.message ?? t('common.aiError'));
    } finally {
      setBusy(null);
    }
  };

  /** "Tùy chỉnh nâng cao": the full editor's beauty tools, starting from the retouched picture when there is one. */
  const advanced = async () => {
    if (!original) return;
    if (result && !stale) return apply();
    setPendingPhoto({ kind: 'image', image: original });
    router.replace('/editor');
  };

  const apply = async () => {
    if (!original || !result) return;
    setBusy(t('common.applying'));
    try {
      const w = original.width();
      const h = original.height();
      const blended = await renderImage(<Blend original={original} result={result} intensity={intensity} width={w} height={h} />, w, h);
      setPendingPhoto({ kind: 'image', image: blended });
      router.replace('/editor');
    } catch (e: any) {
      showToast(e.message ?? t('common.error'));
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.column}>
        <View style={styles.header}>
          <IconButton icon={{ set: 'ion', name: 'chevron-back' }} onPress={leave} />
          <Text style={styles.title}>{t('retouch.title')}</Text>
          <View style={styles.headerRight}>
            <View style={styles.proPill}>
              <MaterialCommunityIcons name="crown" size={13} color={colors.gold} />
              <Text style={styles.proText}>PRO</Text>
            </View>
            <HomeButton />
          </View>
        </View>

        {original ? (
          <CompareView original={original} result={result} intensity={intensity} comparing={comparing} busy={busy} hint={t('retouch.hint')} />
        ) : (
          <View style={[styles.compareArea, styles.center]}>
            <ActivityIndicator color={colors.gold} />
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.styles}>
          {retouchStyles.map((st) => {
            const active = style === st.id;
            return (
              <Pressable key={st.id} onPress={() => setStyle(active ? null : st.id)} style={[styles.styleCard, active && styles.styleCardActive]}>
                <Image source={photoImage(st.photo, 160)} style={styles.styleImg} />
                {active && (
                  <View style={styles.styleCheck}>
                    <Ionicons name="checkmark" size={12} color={colors.onGold} />
                  </View>
                )}
                <Text numberOfLines={1} style={[styles.styleName, active && { color: colors.goldDeep }]}>
                  {t(`retouch.style.${st.id}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>{t('retouch.quick')}</Text>
          <Pressable onPress={advanced} disabled={!!busy || !original} style={styles.advanced} hitSlop={6}>
            <Text style={styles.advancedText}>{t('retouch.advanced')}</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.goldDeep} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.tools}>
          {retouchOptions.map((o) => (
            <RetouchToolCard key={o.id} id={o.id} active={selected.includes(o.id)} onPress={() => toggle(o.id)} />
          ))}
        </ScrollView>

        {result && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardTitle}>{t('retouch.intensity')}</Text>
              <Text style={styles.cardValue}>{Math.round(intensity * 100)}%</Text>
            </View>
            <Slider
              style={{ height: 30 }}
              minimumValue={0}
              maximumValue={1}
              value={intensity}
              onValueChange={setIntensity}
              minimumTrackTintColor={colors.gold}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.gold}
            />
          </View>
        )}

        <ModelChip />

        <View style={styles.actions}>
          <Pressable
            disabled={!result}
            onPressIn={() => setComparing(true)}
            onPressOut={() => setComparing(false)}
            style={[styles.compareBtn, !result && { opacity: 0.4 }]}
          >
            <MaterialCommunityIcons name="compare" size={18} color={colors.text} />
            <Text style={styles.compareText}>{t('retouch.holdCompare')}</Text>
          </Pressable>
          <Pressable
            disabled={!!busy || !original || (stale && nothing)}
            onPress={stale ? generate : apply}
            style={({ pressed }) => [{ flex: 1.2 }, (pressed || busy || (stale && nothing)) && { opacity: 0.6 }]}
          >
            <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
              {stale && <Ionicons name="sparkles" size={16} color={colors.onGold} />}
              <Text style={styles.primaryText}>{stale ? (result ? t('retouch.again') : t('retouch.run')) : t('common.apply')}</Text>
              {!stale && <Ionicons name="arrow-forward" size={18} color={colors.onGold} />}
            </LinearGradient>
          </Pressable>
        </View>
        {result && !busy && <ReportAi tool="preset.retouch" image={result} style={{ marginTop: -6 }} />}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  title: { fontFamily: font.semi, fontSize: 17, color: colors.text },
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
  compareArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Rows that scroll sideways keep their own height; the photo takes the rest.
  strip: { flexGrow: 0, flexShrink: 0 },
  styles: { gap: 10, paddingRight: 4 },
  styleCard: { width: 70, alignItems: 'center', gap: 4, padding: 3, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent' },
  styleCardActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  styleImg: { width: 62, height: 62, borderRadius: 11, backgroundColor: colors.surface2 },
  styleCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleName: { fontFamily: font.medium, fontSize: 11, color: colors.text },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -4 },
  section: { fontFamily: font.serif, fontSize: 17, color: colors.text },
  advanced: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.gold },
  advancedText: { fontFamily: font.medium, fontSize: 12, color: colors.goldDeep },
  tools: { gap: 4, paddingRight: 4 },
  card: { backgroundColor: colors.surface2, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { fontFamily: font.medium, fontSize: 14, color: colors.text },
  cardValue: { fontFamily: font.semi, fontSize: 14, color: colors.gold },
  actions: { flexDirection: 'row', gap: 10 },
  compareBtn: {
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
  compareText: { fontFamily: font.medium, fontSize: 14, color: colors.text },
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
