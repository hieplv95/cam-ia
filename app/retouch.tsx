import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import type { SkImage } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiEdit } from '@/src/ai/client';
import { retouchOptions, type RetouchOptionId } from '@/src/ai/retouch';
import { Blend, CompareView } from '@/src/CompareView';
import { encodeBase64, imageFromBase64, loadPendingPair, renderImage, resizeImage } from '@/src/editor/imageOps';
import { Icon, type IconSpec } from '@/src/icons';
import { notify } from '@/src/notify';
import { ModelChip } from '@/src/ModelPicker';
import { setPendingPhoto, takePendingPhoto } from '@/src/pendingPhoto';
import { colors, font, goldGradient } from '@/src/theme';
import { HomeButton, IconButton } from '@/src/ui';
import { useT } from '@/src/i18n';

const optionIcons: Record<RetouchOptionId, IconSpec> = {
  face: { set: 'mci', name: 'face-woman-shimmer-outline' },
  skin: { set: 'ion', name: 'water-outline' },
  teeth: { set: 'mci', name: 'tooth-outline' },
  eyes: { set: 'ion', name: 'eye-outline' },
  light: { set: 'ion', name: 'sunny-outline' },
};

export default function Retouch() {
  const t = useT();
  const router = useRouter();
  const [original, setOriginal] = useState<SkImage | null>(null);
  const [result, setResult] = useState<SkImage | null>(null);
  const [resultKey, setResultKey] = useState('');
  const [selected, setSelected] = useState<RetouchOptionId[]>(['face']);
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

  const key = [...selected].sort().join(',');
  const stale = !result || resultKey !== key;

  const toggle = (id: RetouchOptionId) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const generate = async () => {
    if (!original || !selected.length) return;
    setBusy(t('retouch.working'));
    try {
      const small = await resizeImage(original, 1024);
      const out = await aiEdit(encodeBase64(small, 90), { preset: 'retouch', options: selected });
      setResult(await imageFromBase64(out.image));
      setResultKey(key);
      showToast(`Xong ✨ ${out.summary}`);
    } catch (e: any) {
      showToast(e.message ?? t('common.aiError'));
    } finally {
      setBusy(null);
    }
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

        <ModelChip />

        <View style={styles.tools}>
          {retouchOptions.map((o) => {
            const active = selected.includes(o.id);
            return (
              <Pressable key={o.id} onPress={() => toggle(o.id)} style={[styles.tool, active && styles.toolActive]}>
                <Icon icon={optionIcons[o.id]} size={24} color={active ? colors.gold : colors.text} />
                <Text style={[styles.toolLabel, active && { color: colors.gold }]}>{t(`retouch.${o.id}`)}</Text>
              </Pressable>
            );
          })}
        </View>

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
            disabled={!!busy || !original || (stale && !selected.length)}
            onPress={stale ? generate : apply}
            style={({ pressed }) => [{ flex: 1.2 }, (pressed || busy || (stale && !selected.length)) && { opacity: 0.6 }]}
          >
            <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
              {stale && <Ionicons name="sparkles" size={16} color={colors.onGold} />}
              <Text style={styles.primaryText}>{stale ? (result ? t('retouch.again') : t('retouch.run')) : t('common.apply')}</Text>
              {!stale && <Ionicons name="arrow-forward" size={18} color={colors.onGold} />}
            </LinearGradient>
          </Pressable>
        </View>
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
  tools: { flexDirection: 'row', gap: 8 },
  tool: {
    flex: 1,
    aspectRatio: 0.9,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  toolActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  toolLabel: { fontFamily: font.medium, fontSize: 10, lineHeight: 13, color: colors.text, textAlign: 'center' },
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
