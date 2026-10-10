import { Ionicons } from '@expo/vector-icons';
import { Skia, type SkImage } from '@shopify/react-native-skia';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { renderThumbnail } from '../editor/imageOps';
import { photoUrl, type PhotoKey } from '../photos';
import { colors, font } from '../theme';
import { presetDevelop, type DevelopPreset } from './presets';
import { DevelopedImage } from './shader';
import { useT } from '../i18n';

const THUMB_W = 360;
const THUMB_H = 280;

const photoCache = new Map<PhotoKey, Promise<SkImage>>();
const thumbCache = new Map<string, Promise<string>>();

/** Decoded showcase photo (720px), cached. */
export function loadPhoto(key: PhotoKey) {
  let p = photoCache.get(key);
  if (!p) {
    p = Skia.Data.fromURI(photoUrl(key, 720)).then((data) => {
      const img = Skia.Image.MakeImageFromEncoded(data);
      if (!img) throw new Error('decode failed');
      return img;
    });
    photoCache.set(key, p);
  }
  return p;
}

/** The preset's sample photo rendered with the preset at full strength (cached data URI). */
export function presetThumbnail(preset: DevelopPreset) {
  if (preset.thumb) return Promise.resolve(preset.thumb);
  let p = thumbCache.get(preset.id);
  if (!p) {
    p = loadPhoto(preset.photo ?? 'portraitSoft').then((img) =>
      renderThumbnail(<DevelopedImage image={img} develop={presetDevelop(preset)} width={THUMB_W} height={THUMB_H} fit="cover" />, THUMB_W, THUMB_H),
    );
    thumbCache.set(preset.id, p);
  }
  return p;
}

export function usePresetThumbnail(preset: DevelopPreset) {
  // Plain photo first, then the developed render.
  const [uri, setUri] = useState(preset.thumb ?? photoUrl(preset.photo ?? 'portraitSoft', THUMB_W * 2));
  useEffect(() => {
    let alive = true;
    presetThumbnail(preset)
      .then((u) => alive && setUri(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [preset]);
  return uri;
}

/* ---------- Saved presets ---------- */

const SAVED_KEY = 'saved-presets';

export function useSavedPresets() {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(SAVED_KEY)
      .then((v) => setSaved(v ? JSON.parse(v) : []))
      .catch(() => {});
  }, []);
  const toggle = useCallback((id: string) => {
    setSaved((s) => {
      const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
      AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  return { saved, toggle };
}

/* ---------- Card ---------- */

export function PresetCard({
  preset,
  width,
  selected,
  saved,
  onPress,
  onToggleSave,
  onRemove,
}: {
  preset: DevelopPreset;
  width: number;
  selected?: boolean;
  saved?: boolean;
  onPress: () => void;
  onToggleSave?: () => void;
  /** The user's own recipes can be deleted from the card. */
  onRemove?: () => void;
}) {
  const t = useT();
  const uri = usePresetThumbnail(preset);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width, height: width * 0.8 }, selected && styles.cardSelected, pressed && { opacity: 0.85 }]}
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']} style={styles.shade} />
      <View style={styles.footer}>
        <Text style={styles.name} numberOfLines={1}>
          {preset.name}
        </Text>
        {onToggleSave && (
          <Pressable hitSlop={10} onPress={onToggleSave} accessibilityLabel={saved ? t('presets.unbookmark') : t('presets.bookmark')}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color={saved ? colors.gold : '#FFFFFF'} />
          </Pressable>
        )}
        {onRemove && (
          <Pressable hitSlop={10} onPress={onRemove} accessibilityLabel={t('presets.removeNamed', { name: preset.name })}>
            <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
      {preset.custom && (
        <View style={styles.mine}>
          <Text style={styles.mineText}>{t('common.mine')}</Text>
        </View>
      )}
      {selected && (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={14} color={colors.onGold} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface2, borderWidth: 2, borderColor: 'transparent' },
  cardSelected: { borderColor: colors.gold },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  footer: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  name: { flex: 1, fontFamily: font.serif, fontSize: 16, color: '#FFFFFF' },
  mine: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mineText: { fontFamily: font.medium, fontSize: 10, color: '#FFFFFF' },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
