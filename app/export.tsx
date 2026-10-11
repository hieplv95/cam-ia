import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Canvas, Group, Image as SkImageNode, ImageFormat, Shadow, useImage, type SkImage } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { encodeBase64, renderImage, resizeImage } from '@/src/editor/imageOps';
import { takePendingExport } from '@/src/pendingPhoto';
import { addRecent } from '@/src/recents';
import { saveImage, sendToApp, shareImage, socialAppsSupported, type ImageFormatId, type SocialApp } from '@/src/save';
import { colors, font, goldGradient } from '@/src/theme';
import { track } from '@/src/track';
import { IconButton } from '@/src/ui';
import { useT } from '@/src/i18n';

type Quality = 'standard' | 'high' | 'max';
type Resolution = 'web' | 'high' | 'original';
type Destination = 'save' | 'share' | SocialApp;

const qualityValue: Record<Quality, number> = { standard: 80, high: 92, max: 100 };
/** "original" keeps the photo's own full resolution (up to FULL_MAX_SIDE). */
const resolutionSide: Record<Resolution, number> = { web: 1080, high: 2048, original: Infinity };

/** White "Camia.app" script signature on a transparent background. */
const SIGNATURE_ASSET = require('@/assets/images/brand/camia-signature.png');
// Web bundles an image as { uri }, which Skia's loader does not read: hand it the address instead.
const SIGNATURE: number | string = Platform.OS === 'web' ? SIGNATURE_ASSET.uri : SIGNATURE_ASSET;

/** The picture with the optional Camia.app signature in the bottom-right corner, in image pixels. */
function Signed({ image, logo, watermark }: { image: SkImage; logo: SkImage | null; watermark: boolean }) {
  const w = image.width();
  const h = image.height();
  const side = Math.min(w, h);
  const lw = side * 0.34;
  const lh = logo ? (lw * logo.height()) / logo.width() : 0;
  const margin = side * 0.035;
  return (
    <Group>
      <SkImageNode image={image} x={0} y={0} width={w} height={h} fit="fill" />
      {watermark && logo && (
        <SkImageNode image={logo} x={w - lw - margin} y={h - lh - margin * 0.6} width={lw} height={lh} fit="contain" opacity={0.95}>
          {/* A soft shadow keeps the white script readable on light photos. */}
          <Shadow dx={0} dy={side * 0.002} blur={side * 0.006} color="rgba(0,0,0,0.45)" />
        </SkImageNode>
      )}
    </Group>
  );
}

type Options = { format: ImageFormatId; quality: Quality; resolution: Resolution; watermark: boolean };
type Output = { key: string; bytes: Uint8Array; width: number; height: number; image: SkImage };

async function produce(source: SkImage, o: Options, logo: SkImage | null): Promise<Omit<Output, 'key'>> {
  let img = await resizeImage(source, resolutionSide[o.resolution]);
  if (o.watermark && logo) img = await renderImage(<Signed image={img} logo={logo} watermark />, img.width(), img.height());
  const bytes = img.encodeToBytes(o.format === 'png' ? ImageFormat.PNG : ImageFormat.JPEG, o.format === 'png' ? 100 : qualityValue[o.quality]);
  return { bytes, width: img.width(), height: img.height(), image: img };
}

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1024)} KB`;

function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.segment, disabled && { opacity: 0.4 }]}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable key={o.id} disabled={disabled} onPress={() => onChange(o.id)} style={[styles.segItem, active && styles.segActive]}>
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OptionRow({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {children}
    </View>
  );
}

type IonName = ComponentProps<typeof Ionicons>['name'];

export default function Export() {
  const t = useT();
  const router = useRouter();
  const signature = useImage(SIGNATURE);
  const [source] = useState<SkImage | null>(() => takePendingExport());
  const [opts, setOpts] = useState<Options>({ format: 'jpg', quality: 'high', resolution: 'original', watermark: true });
  const [output, setOutput] = useState<Output | null>(null);
  const [destination, setDestination] = useState<Destination>('save');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const latest = useRef('');

  // The signature loads asynchronously: until it is there, a "with logo" file is not ready (nor its size).
  const logoPending = opts.watermark && !signature;
  const key = JSON.stringify({ ...opts, logo: opts.watermark && !!signature });
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!source) router.replace('/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-encode (debounced) whenever an option changes, to show the real file size.
  useEffect(() => {
    if (!source) return;
    latest.current = key;
    const timer = setTimeout(async () => {
      const out = await produce(source, opts, signature);
      if (latest.current === key) setOutput({ key, ...out });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, source, signature]);

  const destinations: { id: Destination; label: string; icon: IonName; color: string }[] = [
    { id: 'save', label: Platform.OS === 'web' ? t('export.download') : t('common.save'), icon: 'download-outline', color: colors.text },
    ...(socialAppsSupported
      ? ([
          { id: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
          { id: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', color: '#111111' },
          { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
        ] as const)
      : []),
    ...(Platform.OS !== 'web' || typeof navigator.share === 'function'
      ? [{ id: 'share' as const, label: t('export.share'), icon: 'share-outline' as const, color: colors.text }]
      : []),
  ];

  const exportNow = async () => {
    if (!source) return;
    setBusy(true);
    try {
      const out = output?.key === key ? output : { key, ...(await produce(source, opts, signature)) };
      let msg: string | null = null;
      if (destination === 'save') msg = await saveImage(out.bytes, opts.format);
      else if (destination === 'share') await shareImage(out.bytes, opts.format);
      else msg = await sendToApp(destination, out.bytes, opts.format);
      if (msg) showToast(msg);
      if (destination === 'save') track('export_save');
      else if (destination === 'share') track('export_share');
      else track('export_app', destination);
      addRecent(encodeBase64(await resizeImage(out.image, 720), 80));
    } catch (e: any) {
      if (e?.name !== 'AbortError') showToast(e.message ?? t('export.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!source) return null;

  const iw = source.width();
  const ih = source.height();
  const scale = box.w && box.h ? Math.min(box.w / iw, box.h / ih) : 0;
  const ready = output?.key === key;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon={{ set: 'ion', name: 'chevron-back' }} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.title}>{t('export.title')}</Text>
          <Text style={styles.subtitle}>{t('export.subtitle')}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.column} showsVerticalScrollIndicator={false}>
        <View style={styles.previewArea} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {scale > 0 && (
            <View style={[styles.photo, { width: iw * scale, height: ih * scale }]}>
              <Canvas style={{ width: iw * scale, height: ih * scale }}>
                <Group transform={[{ scale }]}>
                  <Signed image={source} logo={signature} watermark={opts.watermark} />
                </Group>
              </Canvas>
              <View style={styles.readyPill}>
                <Ionicons name="checkmark-circle" size={16} color={colors.gold} />
                <Text style={styles.readyText}>{t('export.ready')}</Text>
              </View>
            </View>
          )}
        </View>

        <OptionRow icon={<Ionicons name="document-outline" size={20} color={colors.text} />} title={t('export.format')} sub={t('export.formatSub')}>
          <Segmented
            options={[
              { id: 'jpg', label: 'JPG' },
              { id: 'png', label: 'PNG' },
            ]}
            value={opts.format}
            onChange={(format) => setOpts((o) => ({ ...o, format }))}
          />
        </OptionRow>
        <OptionRow
          icon={<Ionicons name="ribbon-outline" size={20} color={colors.text} />}
          title={t('export.quality')}
          sub={opts.format === 'png' ? t('export.qualityPng') : t('export.qualitySub')}
        >
          <Segmented
            disabled={opts.format === 'png'}
            options={[
              { id: 'standard', label: t('export.quality.standard') },
              { id: 'high', label: t('export.quality.high') },
              { id: 'max', label: t('export.quality.max') },
            ]}
            value={opts.quality}
            onChange={(quality) => setOpts((o) => ({ ...o, quality }))}
          />
        </OptionRow>
        <OptionRow
          icon={<MaterialCommunityIcons name="crop-free" size={20} color={colors.text} />}
          title={t('export.resolution')}
          sub={ready ? `${output.width} × ${output.height}${opts.resolution === 'original' ? ' · 100%' : ''}` : t('export.resolutionSub')}
        >
          <Segmented
            options={[
              { id: 'web', label: 'Web' },
              { id: 'high', label: '2K' },
              { id: 'original', label: t('export.resolution.original') },
            ]}
            value={opts.resolution}
            onChange={(resolution) => setOpts((o) => ({ ...o, resolution }))}
          />
        </OptionRow>
        <OptionRow icon={<Ionicons name="sparkles-outline" size={20} color={colors.text} />} title={t('export.watermark')} sub={t('export.watermarkSub')}>
          <Segmented
            options={[
              { id: 'none', label: t('export.logo.none') },
              { id: 'logo', label: t('export.logo.with') },
            ]}
            value={opts.watermark ? 'logo' : 'none'}
            onChange={(v) => setOpts((o) => ({ ...o, watermark: v === 'logo' }))}
          />
        </OptionRow>

        <Text style={styles.sectionTitle}>{t('export.saveShare')}</Text>
        <Text style={styles.sectionSub}>{t('export.saveShareSub')}</Text>
        <View style={styles.destinations}>
          {destinations.map((d) => {
            const active = destination === d.id;
            return (
              <Pressable key={d.id} onPress={() => setDestination(d.id)} style={[styles.dest, active && styles.destActive]}>
                <Ionicons name={d.icon} size={24} color={active && d.color === colors.text ? colors.gold : d.color} />
                <Text style={[styles.destText, active && { color: colors.gold }]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable disabled={busy || logoPending} onPress={exportNow} style={({ pressed }) => [(pressed || busy || logoPending) && { opacity: 0.8 }]}>
          <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.exportBtn}>
            {busy ? <ActivityIndicator color={colors.onGold} /> : <Text style={styles.exportText}>{t('export.now')}</Text>}
            {!busy && <Ionicons name="arrow-forward" size={18} color={colors.onGold} />}
          </LinearGradient>
        </Pressable>
        <View style={styles.footNote}>
          <Ionicons name="sparkles" size={12} color={colors.gold} />
          <Text style={styles.footText}>{ready ? t('export.size', { size: formatSize(output.bytes.length) }) : t('export.sizing')}</Text>
        </View>
      </ScrollView>

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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 },
  title: { fontFamily: font.serif, fontSize: 24, color: colors.text, lineHeight: 30 },
  subtitle: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 14, paddingBottom: 24, gap: 10 },
  previewArea: { height: 300, alignItems: 'center', justifyContent: 'center' },
  photo: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface2 },
  readyPill: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  readyText: { fontFamily: font.medium, fontSize: 12, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowIcon: { width: 28, alignItems: 'center' },
  rowTitle: { fontFamily: font.semi, fontSize: 14, color: colors.text },
  rowSub: { fontFamily: font.regular, fontSize: 11, lineHeight: 14, color: colors.textSoft },
  segment: { flexDirection: 'row', gap: 6 },
  segItem: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  segActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  segText: { fontFamily: font.medium, fontSize: 12, color: colors.textSoft },
  segTextActive: { color: colors.onGold },
  sectionTitle: { fontFamily: font.semi, fontSize: 17, color: colors.text, marginTop: 8 },
  sectionSub: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft, marginTop: -6 },
  destinations: { flexDirection: 'row', gap: 8 },
  dest: {
    flex: 1,
    maxWidth: 76,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  destActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  destText: { fontFamily: font.medium, fontSize: 11, color: colors.text },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, marginTop: 6 },
  exportText: { fontFamily: font.semi, fontSize: 16, color: colors.onGold },
  footNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  footText: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
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
