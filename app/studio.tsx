import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { SkImage } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiStudio } from '@/src/ai/client';
import {
  defaultChoices,
  MAX_BRAND,
  MAX_TAGLINE,
  studioProblem,
  studioText,
  studioTool,
  studioTools,
  type StudioChoices,
  type StudioGroup,
} from '@/src/ai/studio';
import { CompareView } from '@/src/CompareView';
import { encodeBase64, imageFromBase64, loadPendingPair, resizeImage } from '@/src/editor/imageOps';
import { featuredImages } from '@/src/featuredImages';
import { HScroll } from '@/src/HScroll';
import { ModelChip } from '@/src/ModelPicker';
import { notify } from '@/src/notify';
import { setPendingExport, setPendingPhoto, takePendingPhoto } from '@/src/pendingPhoto';
import { colors, font, goldGradient } from '@/src/theme';
import { IconButton } from '@/src/ui';
import { useT } from '@/src/i18n';

/**
 * Featured AI tools (Phục hồi ảnh cũ, Hairstyle & Makeup, Product Studio, Tạo logo).
 * Each run costs one AI call; nothing is sent until the user presses the main button.
 */
export default function Studio() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ tool?: string }>();
  const tool = studioTool(params.tool) ?? studioTools[0];

  const [photo, setPhoto] = useState<SkImage | null>(null);
  const [choices, setChoices] = useState<StudioChoices>(() => defaultChoices(tool));
  const [brand, setBrand] = useState('');
  const [tagline, setTagline] = useState('');
  const [result, setResult] = useState<{ b64: string; image: SkImage; key: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(tool.needsPhoto ? t('common.openingPhoto') : null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

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

  const key = JSON.stringify([choices, brand.trim(), tagline.trim()]);
  const stale = !result || result.key !== key;
  const problem = studioProblem(tool, choices, brand);
  // The AI may return a different shape (e.g. a wider product shot); a before/after split would stretch it.
  const sameShape = !!photo && !!result && Math.abs(photo.width() / photo.height() - result.image.width() / result.image.height()) < 0.02;

  const pick = (g: StudioGroup, id: string) =>
    setChoices((c) => {
      const cur = c[g.id] ?? [];
      if (!g.multi) return { ...c, [g.id]: [id] };
      return { ...c, [g.id]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });

  const run = async () => {
    if (problem || busy || (tool.needsPhoto && !photo)) return;
    setBusy(t(studioText.tool(tool, 'busy')));
    try {
      const input = photo ? encodeBase64(await resizeImage(photo, 1024), 90) : null;
      const out = await aiStudio(tool.id, choices, input, tool.id === 'logo' ? { brand: brand.trim(), tagline: tagline.trim() } : {});
      setResult({ b64: out.image, image: await imageFromBase64(out.image), key });
      showToast(`Xong ✨ ${out.summary}`);
    } catch (e: any) {
      showToast(e.message ?? t('common.aiError'));
    } finally {
      setBusy(null);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.column}>
        <View style={styles.header}>
          <IconButton icon={{ set: 'ion', name: 'chevron-back' }} onPress={leave} />
          <Text style={styles.title} numberOfLines={1}>
            {t(studioText.tool(tool, 'title'))}
          </Text>
          <View style={styles.proPill}>
            <MaterialCommunityIcons name="crown" size={13} color={colors.gold} />
            <Text style={styles.proText}>PRO</Text>
          </View>
        </View>

        {/* Preview: the photo with a before/after divider, or the logo. */}
        {tool.needsPhoto ? (
          photo ? (
            result && !sameShape ? (
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
              ) : (
                <Image
                  source={featuredImages[tool.id]}
                  style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: 0.45 }]}
                  resizeMode="contain"
                />
              )}
              {!result && !busy && (
                <View style={styles.logoHint}>
                  <Text style={styles.logoHintText}>{t('studio.logoHint')}</Text>
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
                placeholder={t('studio.brandPlaceholder')}
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
            </View>
          )}

          {tool.groups.map((g) => (
            <View key={g.id} style={{ gap: 6 }}>
              <Text style={styles.groupLabel}>
                {t(studioText.group(tool, g))}
                {g.multi ? <Text style={styles.groupHint}>{t('studio.multi')}</Text> : null}
              </Text>
              <HScroll contentContainerStyle={styles.chips}>
                {g.options.map((o) => {
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

          <ModelChip />
        </ScrollView>

        {problem && stale ? <Text style={styles.problem}>{t(problem)}</Text> : null}

        {result && !stale ? (
          <View style={styles.actions}>
            <Pressable onPress={edit} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
              <Ionicons name="color-wand-outline" size={18} color={colors.text} />
              <Text style={styles.secondaryText}>{t('common.edit')}</Text>
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
