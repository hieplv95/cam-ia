import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { aiPresets, type AiPresetId } from '@/src/ai/presets';
import { ILLU_H, ILLU_W, useIllustration, type IllustrationId } from '@/src/aiIllustrations';
import { aiPresetDescription, aiPresetIcons, aiPresetLabel, Icon } from '@/src/icons';
import { FeaturedTools } from '@/src/FeaturedTools';
import { ModelChip } from '@/src/ModelPicker';
import type { EditorIntent } from '@/src/pendingPhoto';
import { usePhotoSource } from '@/src/photoSource';
import { cardShadow, colors, font, MAX_CONTENT_WIDTH } from '@/src/theme';
import { Screen } from '@/src/ui';
import { useT, type MessageKey } from '@/src/i18n';

type Feature = {
  id: IllustrationId;
  title: MessageKey;
  sub: MessageKey;
  /** What tapping the card does. */
  action: { kind: 'ai'; preset: AiPresetId } | { kind: 'art' } | { kind: 'generate' };
};

const features: Feature[] = [
  { id: 'erase', title: 'ai.card.erase.title', sub: 'ai.card.erase.sub', action: { kind: 'ai', preset: 'erase' } },
  { id: 'enhance', title: 'ai.card.enhance.title', sub: 'ai.card.enhance.sub', action: { kind: 'ai', preset: 'enhance' } },
  { id: 'removebg', title: 'ai.card.removebg.title', sub: 'ai.card.removebg.sub', action: { kind: 'ai', preset: 'whitebg' } },
  { id: 'art', title: 'ai.card.art.title', sub: 'ai.card.art.sub', action: { kind: 'art' } },
  { id: 'expand', title: 'ai.card.expand.title', sub: 'ai.card.expand.sub', action: { kind: 'ai', preset: 'expand' } },
  { id: 'generate', title: 'ai.card.generate.title', sub: 'ai.card.generate.sub', action: { kind: 'generate' } },
];

const artStyles: AiPresetId[] = ['cartoon3d', 'anime', 'watercolor', 'coloring'];

/** Presets not already covered by a big card. */
const moreTools = aiPresets.filter((p) => !['erase', 'enhance', 'whitebg', 'expand', ...artStyles].includes(p.id));

function FeatureCard({ feature, width, onPress }: { feature: Feature; width: number; onPress: () => void }) {
  const t = useT();
  const art = useIllustration(feature.id);
  const imgW = width - 20;
  const imgH = (imgW * ILLU_H) / ILLU_W;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { width }, pressed && { transform: [{ scale: 0.98 }] }]}>
      <LinearGradient colors={['#F7EEE2', '#FFFFFF']} style={StyleSheet.absoluteFill} />
      <Text style={styles.cardTitle} numberOfLines={1}>
        {t(feature.title)}
      </Text>
      <Text style={styles.cardSub}>{t(feature.sub)}</Text>
      <View style={[styles.art, { width: imgW, height: imgH }]}>
        {art ? <Image source={{ uri: art }} style={StyleSheet.absoluteFill} /> : null}
        {feature.id === 'enhance' && (
          <View style={styles.hd}>
            <Text style={styles.hdText}>HD</Text>
          </View>
        )}
        {feature.id === 'expand' && (
          <>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" style={[styles.arrow, { left: 4 }]} />
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={[styles.arrow, { right: 4 }]} />
          </>
        )}
        {feature.id === 'generate' && (
          <Ionicons name="sparkles" size={22} color="#FFFFFF" style={{ position: 'absolute', top: 8, right: 10 }} />
        )}
      </View>
    </Pressable>
  );
}

export default function AiTools() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { choose } = usePhotoSource();
  const [gridWidth, setGridWidth] = useState(0);
  const [artOpen, setArtOpen] = useState(false);
  const cardWidth = gridWidth ? (gridWidth - 12) / 2 : 0;

  const startAi = (preset: AiPresetId) => {
    const intent: EditorIntent = preset === 'retouch' ? { type: 'retouch' } : { type: 'ai', preset };
    choose(intent);
  };

  const onFeature = (f: Feature) => {
    if (f.action.kind === 'ai') startAi(f.action.preset);
    else if (f.action.kind === 'art') setArtOpen(true);
    else router.push('/generate');
  };

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={styles.title}>{t('ai.title')}</Text>
        <Text style={styles.sub}>{t('ai.sub')}</Text>
        <ModelChip style={{ marginTop: 6 }} />
      </View>

      <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
        {cardWidth > 0 && features.map((f) => <FeatureCard key={f.id} feature={f} width={cardWidth} onPress={() => onFeature(f)} />)}
      </View>

      <FeaturedTools />

      <Text style={styles.sectionTitle}>{t('ai.more')}</Text>
      <View style={styles.list}>
        {/* "Ghép ảnh": 2–3 photos into one (picked on that screen). */}
        <Pressable onPress={() => router.push('/combine')} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
          <View style={styles.rowIcon}>
            <Ionicons name="albums-outline" size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t('combine.title')}</Text>
            <Text style={styles.rowSub}>{t('source.combineDesc', { n: 3 })}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMute} />
        </Pressable>
        {moreTools.map((p) => (
          <Pressable key={p.id} onPress={() => startAi(p.id)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
            <View style={styles.rowIcon}>
              <Icon icon={aiPresetIcons[p.id]} size={20} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{aiPresetLabel(p.id)}</Text>
              <Text style={styles.rowSub}>{aiPresetDescription(p.id)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMute} />
          </Pressable>
        ))}
      </View>

      <Modal visible={artOpen} transparent animationType="fade" onRequestClose={() => setArtOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setArtOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t('ai.artSheet')}</Text>
            {artStyles.map((id) => {
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    setArtOpen(false);
                    startAi(id);
                  }}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.rowIcon}>
                    <Icon icon={aiPresetIcons[id]} size={20} color={colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{aiPresetLabel(id)}</Text>
                    <Text style={styles.rowSub}>{aiPresetDescription(id)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMute} />
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: 12, gap: 4 },
  title: { fontFamily: font.serif, fontSize: 32, color: colors.text },
  sub: { fontFamily: font.regular, fontSize: 14, color: colors.textSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { borderRadius: 22, overflow: 'hidden', paddingTop: 14, paddingBottom: 10, alignItems: 'center', backgroundColor: colors.surface, ...cardShadow },
  cardTitle: { alignSelf: 'stretch', paddingHorizontal: 12, fontFamily: font.semi, fontSize: 15, color: colors.text },
  cardSub: { alignSelf: 'stretch', paddingHorizontal: 12, fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.textSoft, marginTop: 2, marginBottom: 10, minHeight: 32 },
  art: { borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface2 },
  hd: { position: 'absolute', top: 8, right: 8, backgroundColor: '#3B82F6', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  hdText: { fontFamily: font.bold, fontSize: 12, color: '#FFFFFF' },
  arrow: { position: 'absolute', top: '45%' },
  sectionTitle: { fontFamily: font.semi, fontSize: 18, color: colors.text, marginTop: 8 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, ...cardShadow },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: font.semi, fontSize: 14, color: colors.text },
  rowSub: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  backdrop: { flex: 1, backgroundColor: 'rgba(42,32,24,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 6 },
  sheetTitle: { fontFamily: font.serif, fontSize: 22, color: colors.text, marginBottom: 4 },
});
