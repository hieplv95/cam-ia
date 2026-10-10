import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_SIDE } from './editor/imageOps';
import { notify } from './notify';
import { setPendingPhoto, type EditorIntent, type PendingPhoto } from './pendingPhoto';
import { photoUrl, type PhotoKey } from './photos';
import { bronzeGradient, cardShadow, colors, font } from './theme';
import { track } from './track';
import { t, useT, type MessageKey } from './i18n';

type PhotoSource = {
  /** Asks where the photo comes from, then opens the editor with the given intent. */
  choose: (intent?: EditorIntent) => void;
  /** Opens the editor directly with an already-known photo. */
  open: (photo: PendingPhoto) => void;
};

const Ctx = createContext<PhotoSource | null>(null);

export const usePhotoSource = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePhotoSource must be used inside PhotoSourceProvider');
  return ctx;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Canvas backgrounds; the first one is a soft rainbow gradient. */
const rainbow = ['#FF9AA2', '#FFD3A5', '#FDF5A6', '#B5EAD7', '#A7C7FF', '#D7B8FF'] as const;
const backgrounds: { id: string; color: string; gradient?: readonly string[] }[] = [
  { id: 'rainbow', color: '#FFFFFF', gradient: rainbow },
  { id: 'white', color: '#FFFFFF' },
  { id: 'pink', color: '#FDE2E4' },
  { id: 'blue', color: '#DCEBFB' },
  { id: 'cream', color: '#FFF4D6' },
  { id: 'mint', color: '#DDF3E4' },
  { id: 'lilac', color: '#E9E1FB' },
  { id: 'dark', color: '#2B2B2B' },
];

type SizeId = 'post' | 'facebook' | 'story' | 'cover' | 'free';
const sizes: { id: SizeId; label: MessageKey; sub: string; icon: IconName; w: number; h: number }[] = [
  { id: 'post', label: 'source.size.post', sub: '1:1', icon: 'logo-instagram', w: 1600, h: 1600 },
  // Facebook's standard feed post size (940×788), at twice the pixels for a sharp upload.
  { id: 'facebook', label: 'source.size.facebook', sub: '940×788', icon: 'logo-facebook', w: 1880, h: 1576 },
  { id: 'story', label: 'source.size.story', sub: '9:16', icon: 'phone-portrait-outline', w: 1152, h: 2048 },
  { id: 'cover', label: 'source.size.cover', sub: '16:9', icon: 'image-outline', w: 2048, h: 1152 },
  { id: 'free', label: 'source.size.free', sub: '', icon: 'scan-outline', w: 1200, h: 1500 },
];

const clampSide = (v: string) => Math.max(200, Math.min(MAX_SIDE, Math.round(Number(v) || 0)));

export function PhotoSourceProvider({ children }: { children: ReactNode }) {
  useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [intent, setIntent] = useState<EditorIntent | undefined>();
  const [visible, setVisible] = useState(false);
  const [bg, setBg] = useState('white');
  const [size, setSize] = useState<SizeId>('post');
  const [custom, setCustom] = useState({ w: '1200', h: '1500' });

  const open = (photo: PendingPhoto) => {
    setPendingPhoto(photo);
    const intent = photo.intent;
    if (intent?.type === 'studio') router.push({ pathname: '/studio', params: { tool: intent.tool } });
    else router.push(intent?.type === 'retouch' ? '/retouch' : intent?.type === 'adjust' ? '/adjust' : '/editor');
  };

  const fromPicker = async (source: 'camera' | 'library') => {
    setVisible(false);
    if (source === 'camera' && Platform.OS !== 'web') {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) return notify(t('source.cameraPermission'));
    }
    try {
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
      const res =
        source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!res.canceled && res.assets?.[0]) {
        track(source === 'camera' ? 'photo_camera' : 'photo_library');
        open({ kind: 'uri', uri: res.assets[0].uri, intent });
      }
    } catch (e: any) {
      notify(e?.message ?? t('common.cantOpenPhoto'));
    }
  };

  const createCanvas = () => {
    const b = backgrounds.find((x) => x.id === bg) ?? backgrounds[1];
    const s = sizes.find((x) => x.id === size)!;
    const [width, height] = size === 'free' ? [clampSide(custom.w), clampSide(custom.h)] : [s.w, s.h];
    setVisible(false);
    track('canvas_create');
    open({ kind: 'blank', color: b.color, gradient: b.gradient, width, height, intent });
  };

  const choose = (next?: EditorIntent) => {
    setIntent(next);
    setVisible(true);
  };

  return (
    <Ctx.Provider value={{ choose, open }}>
      {children}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Pressable hitSlop={8} onPress={() => setVisible(false)} style={styles.close} accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>

            <ScrollView
              contentContainerStyle={[styles.content, { paddingBottom: 18 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.titleRow}>
                <Text style={styles.title}>{t('source.title')}</Text>
                <Sparkle />
              </View>
              <Text style={styles.subtitle}>{t('source.subtitle')}</Text>

              <SourceCard
                icon="images-outline"
                tint={['#FFF4EA', '#FDE9DA']}
                iconBg="#FCE3D0"
                iconColor="#C46A3A"
                title={t('source.library')}
                desc={t('source.libraryDesc')}
                photos={['portraitSoft', 'dog', 'coast']}
                onPress={() => fromPicker('library')}
              />
              <SourceCard
                icon="camera-outline"
                tint={['#FFF1F3', '#FDE3E8']}
                iconBg="#FBD9E0"
                iconColor="#D04A68"
                title={t('source.camera')}
                desc={t('source.cameraDesc')}
                photos={['portraitFlowers', 'heroCurls', 'portraitRose']}
                onPress={() => fromPicker('camera')}
              />

              {!intent && (
                <>
                  <View style={styles.sectionRow}>
                    <Ionicons name="sparkles" size={16} color={colors.gold} />
                    <Text style={styles.section}>{t('source.create')}</Text>
                  </View>

                  <View style={styles.canvasCard}>
                    <View style={styles.canvasTop}>
                      <View style={[styles.iconBox, { backgroundColor: '#ECE5FB' }]}>
                        <Ionicons name="brush-outline" size={22} color="#7B5BC6" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.canvasTitleRow}>
                          <Text numberOfLines={1} style={styles.cardTitle}>
                            {t('source.canvas')}
                          </Text>
                          <LinearGradient colors={bronzeGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pro}>
                            <Ionicons name="star" size={9} color="#FFFFFF" />
                            <Text style={styles.proText}>PRO</Text>
                          </LinearGradient>
                        </View>
                        <Text style={styles.cardDesc}>{t('source.canvasDesc')}</Text>
                      </View>
                      <CanvasArt />
                    </View>

                    <Text style={styles.label}>{t('source.bgColor')}</Text>
                    <View style={styles.swatches}>
                      {backgrounds.map((b) => {
                        const active = bg === b.id;
                        return (
                          <Pressable key={b.id} accessibilityLabel={t('source.background', { name: b.id })} onPress={() => setBg(b.id)} style={[styles.swatchRing, active && styles.swatchRingActive]}>
                            {b.gradient ? (
                              <LinearGradient colors={rainbow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatch} />
                            ) : (
                              <View style={[styles.swatch, { backgroundColor: b.color }]} />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.label}>{t('source.size')}</Text>
                    <View style={styles.sizes}>
                      {sizes.map((s) => {
                        const active = size === s.id;
                        return (
                          <Pressable key={s.id} onPress={() => setSize(s.id)} style={[styles.size, active && styles.sizeActive]}>
                            <Ionicons name={s.icon} size={18} color={active ? '#C46A3A' : colors.text} />
                            <View style={{ alignItems: 'center' }}>
                              <Text numberOfLines={1} style={[styles.sizeLabel, active && { color: '#C46A3A' }]}>
                                {t(s.label)}
                              </Text>
                              <Text numberOfLines={1} style={styles.sizeSub}>
                                {s.id === 'free' ? t('source.size.custom') : s.sub}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>

                    {size === 'free' && (
                      <View style={styles.customRow}>
                        <TextInput
                          value={custom.w}
                          onChangeText={(w) => setCustom((c) => ({ ...c, w: w.replace(/\D/g, '') }))}
                          keyboardType="number-pad"
                          maxLength={4}
                          style={styles.customInput}
                          accessibilityLabel={t('source.width')}
                        />
                        <Text style={styles.customX}>×</Text>
                        <TextInput
                          value={custom.h}
                          onChangeText={(h) => setCustom((c) => ({ ...c, h: h.replace(/\D/g, '') }))}
                          keyboardType="number-pad"
                          maxLength={4}
                          style={styles.customInput}
                          accessibilityLabel={t('source.height')}
                        />
                        <Text style={styles.customUnit}>px (200–{MAX_SIDE})</Text>
                      </View>
                    )}

                    <Pressable onPress={createCanvas} style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}>
                      <Ionicons name="add" size={18} color="#FFFFFF" />
                      <Text style={styles.createText}>{t('source.createCanvas')}</Text>
                    </Pressable>
                  </View>
                </>
              )}

              <View style={styles.tip}>
                <Ionicons name="bulb-outline" size={14} color={colors.gold} />
                <Text style={styles.tipText}>{t('source.tip')}</Text>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Ctx.Provider>
  );
}

/** Library / camera option: icon, text, a fanned stack of sample photos and an arrow. */
function SourceCard({
  icon,
  tint,
  iconBg,
  iconColor,
  title,
  desc,
  photos,
  onPress,
}: {
  icon: IconName;
  tint: readonly [string, string];
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  photos: [PhotoKey, PhotoKey, PhotoKey];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.cardShadow, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{desc}</Text>
        </View>
        <View style={styles.stack}>
          <Image source={{ uri: photoUrl(photos[2], 200) }} style={[styles.stackPhoto, styles.stackBack]} />
          <Image source={{ uri: photoUrl(photos[1], 200) }} style={[styles.stackPhoto, styles.stackMid]} />
          <Image source={{ uri: photoUrl(photos[0], 240) }} style={[styles.stackPhoto, styles.stackFront]} />
        </View>
        <View style={styles.arrow}>
          <Ionicons name="chevron-forward" size={16} color={colors.text} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** Three loose sheets (transparent, gradient, paper) hinting at a blank canvas. */
function CanvasArt() {
  const checker = Array.from({ length: 42 }, (_, i) => (Math.floor(i / 6) + i) % 2 === 0);
  return (
    <View style={styles.art}>
      <View style={[styles.sheetArt, styles.sheetBack]}>
        <View style={styles.checker}>
          {checker.map((dark, i) => (
            <View key={i} style={[styles.checkCell, dark && { backgroundColor: '#E6E1EC' }]} />
          ))}
        </View>
      </View>
      <LinearGradient colors={['#FFD6E8', '#D8E4FF', '#E6FFF1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.sheetArt, styles.sheetMid]} />
      <View style={[styles.sheetArt, styles.sheetFront]} />
      <View style={[styles.spark, { top: 2, right: 0, transform: [{ rotate: '35deg' }] }]} />
      <View style={[styles.spark, { top: 12, right: -4, transform: [{ rotate: '75deg' }] }]} />
    </View>
  );
}

/** Small accent strokes next to the title. */
function Sparkle() {
  return (
    <View style={styles.sparkle}>
      <View style={[styles.sparkLine, { transform: [{ rotate: '-30deg' }], left: 2, top: 0 }]} />
      <View style={[styles.sparkLine, { transform: [{ rotate: '10deg' }], left: 10, top: 4 }]} />
      <View style={[styles.sparkLine, { transform: [{ rotate: '50deg' }], left: 14, top: 14, height: 7 }]} />
    </View>
  );
}

const peach = '#E9895A';

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(42,32,24,0.4)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '94%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },
  close: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 20, paddingTop: 18, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: 30 },
  title: { flexShrink: 1, fontFamily: font.serif, fontSize: 24, lineHeight: 31, color: colors.text },
  subtitle: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.textSoft, marginTop: -4, marginBottom: 4 },
  sparkle: { width: 22, height: 24, marginLeft: 4, marginTop: 2 },
  sparkLine: { position: 'absolute', width: 2.5, height: 9, borderRadius: 2, backgroundColor: peach },
  cardShadow: { borderRadius: 20, ...cardShadow },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    minHeight: 88,
  },
  iconBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: font.serif, fontSize: 17, color: colors.text },
  cardDesc: { fontFamily: font.regular, fontSize: 11.5, lineHeight: 16, color: colors.textSoft, marginTop: 2 },
  stack: { width: 84, height: 64 },
  stackPhoto: { position: 'absolute', width: 46, height: 56, borderRadius: 7, borderWidth: 2.5, borderColor: '#FFFFFF', backgroundColor: colors.surface2 },
  stackBack: { right: 0, top: 2, transform: [{ rotate: '12deg' }] },
  stackMid: { right: 16, top: 0, transform: [{ rotate: '3deg' }] },
  stackFront: { right: 32, top: 6, width: 50, height: 58, transform: [{ rotate: '-8deg' }] },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  section: { fontFamily: font.serif, fontSize: 18, color: colors.text },
  canvasCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border, ...cardShadow },
  canvasTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  canvasTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pro: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  proText: { fontFamily: font.bold, fontSize: 9.5, color: '#FFFFFF', letterSpacing: 0.6 },
  art: { width: 70, height: 70, marginRight: -4 },
  sheetArt: { position: 'absolute', width: 46, height: 58, borderRadius: 6, borderWidth: 1.5, borderColor: '#FFFFFF', overflow: 'hidden' },
  sheetBack: { left: 0, top: 8, transform: [{ rotate: '-10deg' }], backgroundColor: '#FFFFFF' },
  sheetMid: { left: 13, top: 2, transform: [{ rotate: '4deg' }] },
  sheetFront: { left: 26, top: 10, transform: [{ rotate: '12deg' }], backgroundColor: '#FBF6EC', borderColor: '#EFE6D6' },
  checker: { flexDirection: 'row', flexWrap: 'wrap', width: 48 },
  checkCell: { width: 8, height: 8, backgroundColor: '#FFFFFF' },
  spark: { position: 'absolute', width: 2.5, height: 8, borderRadius: 2, backgroundColor: '#9B7BE0' },
  label: { fontFamily: font.medium, fontSize: 12, color: colors.textSoft, marginTop: 2 },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchRing: { padding: 2, borderRadius: 11, borderWidth: 2, borderColor: 'transparent' },
  swatchRingActive: { borderColor: peach },
  swatch: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  sizes: { flexDirection: 'row', gap: 5 },
  size: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 0,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sizeActive: { borderColor: peach, backgroundColor: '#FFF3EB' },
  sizeLabel: { fontFamily: font.semi, fontSize: 11, color: colors.text },
  sizeSub: { fontFamily: font.regular, fontSize: 10, color: colors.textSoft },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customInput: {
    width: 72,
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 7,
    backgroundColor: colors.surface2,
  },
  customX: { fontFamily: font.medium, fontSize: 14, color: colors.textSoft },
  customUnit: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 12, backgroundColor: peach, marginTop: 2 },
  createText: { fontFamily: font.semi, fontSize: 15, color: '#FFFFFF' },
  tip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 },
  tipText: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
});
