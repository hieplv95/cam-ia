import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { AiPresetId } from '@/src/ai/presets';
import { HomeBlog } from '@/src/blog/HomeBlog';
import { developPresets } from '@/src/develop/presets';
import { PresetCard } from '@/src/develop/PresetCard';
import { Dialog } from '@/src/Dialog';
import { FeaturedTools } from '@/src/FeaturedTools';
import { deleteDraft, timeAgo, useDrafts, type DraftMeta } from '@/src/drafts/drafts';
import { aiPresetIcons, Icon } from '@/src/icons';
import { setPendingPhoto, type EditorIntent } from '@/src/pendingPhoto';
import { usePhotoSource } from '@/src/photoSource';
import { photoUrl, samplePhotos, type PhotoKey } from '@/src/photos';
import { useRecents } from '@/src/recents';
import { cardShadow, colors, font, MAX_CONTENT_WIDTH } from '@/src/theme';
import { AppHeader, GoldButton, Screen, SectionHeader } from '@/src/ui';
import { HScroll } from '@/src/HScroll';
import { useT, type MessageKey } from '@/src/i18n';

const slides: {
  photo: PhotoKey;
  /** Where the face is in the (3:2) photo, 0..1; the banner shifts it to the right of the text. */
  focus: { x: number; y: number };
  kicker: MessageKey;
  title: MessageKey;
  sub: MessageKey;
  cta: MessageKey;
  intent?: EditorIntent;
}[] = [
  {
    photo: 'hero',
    focus: { x: 0.38, y: 0.3 },
    kicker: 'home.hero1.kicker',
    title: 'home.hero1.title',
    sub: 'home.hero1.sub',
    cta: 'home.hero1.cta',
  },
  {
    photo: 'heroGolden',
    focus: { x: 0.53, y: 0.28 },
    kicker: 'home.hero2.kicker',
    title: 'home.hero2.title',
    sub: 'home.hero2.sub',
    cta: 'common.tryNow',
    intent: { type: 'ai', preset: 'enhance' },
  },
  {
    photo: 'heroCurls',
    focus: { x: 0.55, y: 0.35 },
    kicker: 'home.hero3.kicker',
    title: 'home.hero3.title',
    sub: 'home.hero3.sub',
    cta: 'common.tryNow',
    intent: { type: 'adjust', preset: 'cinematic', intensity: 80 },
  },
];

const quickTools: { preset: AiPresetId; label: MessageKey }[] = [
  { preset: 'enhance', label: 'home.tool.enhance' },
  { preset: 'erase', label: 'home.tool.erase' },
  { preset: 'whitebg', label: 'home.tool.whitebg' },
  { preset: 'retouch', label: 'home.tool.retouch' },
  { preset: 'expand', label: 'home.tool.expand' },
];

const featuredPresets = ['cinematic', 'softglow', 'retrosun', 'goldenhour'].map((id) => developPresets.find((p) => p.id === id)!);

const HERO_HEIGHT = 250;
const PHOTO_ASPECT = 1.5;

/** Size and offset that put the photo's focus point at the right-hand side of the banner. */
function heroPhotoFrame(width: number, focus: { x: number; y: number }) {
  const H = HERO_HEIGHT;
  const tx = width - Math.min(width * 0.32, 230);
  const ty = H * 0.42;
  const needed = Math.max(width, H * PHOTO_ASPECT, tx / focus.x, (width - tx) / (1 - focus.x));
  const w = Math.min(needed, Math.max(width * 1.8, H * PHOTO_ASPECT));
  const h = w / PHOTO_ASPECT;
  const left = Math.min(0, Math.max(width - w, tx - focus.x * w));
  const top = Math.min(0, Math.max(H - h, ty - focus.y * h));
  return { width: w, height: h, left, top };
}

function HeroSlide({ slide, width, onPress }: { slide: (typeof slides)[number]; width: number; onPress: () => void }) {
  const t = useT();
  return (
    <View style={[styles.hero, { width }]}>
      <Image
        source={{ uri: `${photoUrl(slide.photo, 1500)}&h=1000` }}
        style={[styles.heroImage, heroPhotoFrame(width, slide.focus)]}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(250,246,240,0.97)', 'rgba(250,246,240,0.72)', 'rgba(250,246,240,0)']}
        locations={[0, 0.42, 0.78]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroContent}>
        <Text style={styles.heroKicker}>{t(slide.kicker)}</Text>
        <Text style={styles.heroTitle}>{t(slide.title)}</Text>
        <Text style={styles.heroSub}>{t(slide.sub)}</Text>
        <View style={{ marginTop: 14 }}>
          <GoldButton label={t(slide.cta)} icon onPress={onPress} />
        </View>
      </View>
    </View>
  );
}

export default function Home() {
  const t = useT();
  const router = useRouter();
  const { choose, open } = usePhotoSource();
  const { recents } = useRecents();
  const { drafts, reload: reloadDrafts } = useDrafts();
  const [removing, setRemoving] = useState<DraftMeta | null>(null);

  const openDraft = (d: DraftMeta) => {
    setPendingPhoto({ kind: 'draft', id: d.id });
    router.push('/editor');
  };
  const screen = useWindowDimensions();
  // onLayout refines this; the estimate (column width minus its padding) means the banner never waits on it.
  const [measured, setHeroWidth] = useState(0);
  const heroWidth = measured || Math.min(screen.width, MAX_CONTENT_WIDTH) - 32;
  const [slide, setSlide] = useState(0);

  return (
    <Screen>
      <AppHeader />

      <View onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}>
        {heroWidth > 0 && (
          <View style={styles.heroShadow}>
            <HScroll
              pagingEnabled
              onScroll={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / heroWidth))}
              style={{ borderRadius: 20, overflow: 'hidden' }}
            >
              {slides.map((s) => (
                <HeroSlide key={s.photo} slide={s} width={heroWidth} onPress={() => choose(s.intent)} />
              ))}
            </HScroll>
          </View>
        )}
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View key={s.photo} style={[styles.dot, i === slide && styles.dotActive]} />
          ))}
        </View>
      </View>

      {drafts.length > 0 && (
        <>
          <SectionHeader title={t('home.continue')} />
          <HScroll style={styles.bleed} contentContainerStyle={styles.bleedContent}>
            {drafts.map((d) => (
              <Pressable key={d.id} onPress={() => openDraft(d)} onLongPress={() => setRemoving(d)} style={styles.draft}>
                <Image source={{ uri: d.thumb }} style={styles.draftImg} />
                <View style={styles.draftBadge}>
                  <Ionicons name="create-outline" size={11} color="#FFFFFF" />
                  <Text style={styles.sampleText}>{t('common.draft')}</Text>
                </View>
                <Pressable hitSlop={8} onPress={() => setRemoving(d)} style={styles.draftRemove} accessibilityLabel={t('home.removeDraft')}>
                  <Ionicons name="close" size={13} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.draftTime}>{timeAgo(d.updatedAt)}</Text>
              </Pressable>
            ))}
          </HScroll>
        </>
      )}

      <SectionHeader title={t('home.aiTools')} onSeeAll={() => router.navigate('/ai')} />
      <View style={styles.tools}>
        {quickTools.map((tool) => (
          <Pressable
            key={tool.preset}
            onPress={() => choose(tool.preset === 'retouch' ? { type: 'retouch' } : { type: 'ai', preset: tool.preset })}
            style={({ pressed }) => [styles.tool, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.toolIcon}>
              <Icon icon={aiPresetIcons[tool.preset]} size={22} color={colors.gold} />
            </View>
            <Text style={styles.toolLabel}>{t(tool.label)}</Text>
          </Pressable>
        ))}
      </View>

      <FeaturedTools />

      <SectionHeader title={t('home.presets')} onSeeAll={() => router.navigate('/presets')} />
      <HScroll style={styles.bleed} contentContainerStyle={styles.bleedContent}>
        {featuredPresets.map((p) => (
          <PresetCard key={p.id} preset={p} width={136} onPress={() => choose({ type: 'adjust', preset: p.id, intensity: 70 })} />
        ))}
      </HScroll>

      <HomeBlog bleedStyle={styles.bleed} bleedContentStyle={styles.bleedContent} />

      <SectionHeader title={t('home.recent')} />
      <HScroll style={styles.bleed} contentContainerStyle={styles.bleedContent}>
        {recents.map((r) => (
          <Pressable key={r.id} onPress={() => open({ kind: 'base64', data: r.data })}>
            <Image source={{ uri: `data:image/jpeg;base64,${r.data}` }} style={styles.recent} />
          </Pressable>
        ))}
        {/* Sample photos fill the row until the user has saved their own work. */}
        {samplePhotos.slice(0, Math.max(0, 5 - recents.length)).map((key) => (
          <Pressable key={key} onPress={() => open({ kind: 'uri', uri: photoUrl(key, 1600) })}>
            <Image source={{ uri: photoUrl(key, 240) }} style={styles.recent} />
            <View style={styles.sampleBadge}>
              <Text style={styles.sampleText}>{t('common.sample')}</Text>
            </View>
          </Pressable>
        ))}
      </HScroll>

      <Dialog
        visible={!!removing}
        title={t('home.removeDraftTitle')}
        message={t('home.removeDraftMsg')}
        onClose={() => setRemoving(null)}
        actions={[
          {
            label: t('home.removeDraft'),
            destructive: true,
            onPress: async () => {
              const d = removing;
              setRemoving(null);
              if (d) await deleteDraft(d.id);
              reloadDrafts();
            },
          },
          { label: t('common.keep'), onPress: () => setRemoving(null) },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroShadow: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  hero: {
    height: HERO_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
  },
  heroImage: { position: 'absolute' },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    maxWidth: 260,
  },
  heroKicker: {
    fontFamily: font.medium,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.6,
    color: colors.gold,
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: font.serif,
    fontSize: 28,
    lineHeight: 33,
    color: colors.text,
  },
  heroSub: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSoft,
    marginTop: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.gold },
  tools: { flexDirection: 'row', gap: 8 },
  tool: {
    flex: 1,
    height: 92,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 2,
    ...cardShadow,
  },
  toolIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Horizontal rows run to the screen edges and leave room for card shadows.
  bleed: { marginHorizontal: -16, marginVertical: -8 },
  bleedContent: { gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  toolLabel: {
    fontFamily: font.medium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.text,
    textAlign: 'center',
  },
  recent: {
    width: 100,
    height: 78,
    borderRadius: 12,
    backgroundColor: colors.surface2,
  },
  sampleBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  sampleText: { fontFamily: font.medium, fontSize: 9, color: '#FFFFFF' },
  draft: { width: 112, gap: 5 },
  draftImg: { width: 112, height: 112, borderRadius: 14, backgroundColor: colors.surface2 },
  draftBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  draftRemove: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftTime: { fontFamily: font.regular, fontSize: 11, color: colors.textSoft },
});
