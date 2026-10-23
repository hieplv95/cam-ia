import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { apiFetch } from './account';
import { useT } from './i18n';
import { SOCIAL_KEYS, type GeoSettings } from './seo';
import { cardShadow, colors, font } from './theme';
import { SectionHeader } from './ui';

type SocialKey = (typeof SOCIAL_KEYS)[number];

const brands: Record<SocialKey, { name: string; icon: ComponentProps<typeof Ionicons>['name']; color: string }> = {
  facebook: { name: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
  instagram: { name: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
  x: { name: 'X', icon: 'logo-x', color: '#111111' },
  youtube: { name: 'YouTube', icon: 'logo-youtube', color: '#FF0000' },
  tiktok: { name: 'TikTok', icon: 'logo-tiktok', color: '#111111' },
};

/**
 * Web home page: buttons to CamIA's official social pages, as entered on the admin page (SEO/GEO).
 * Only the pages that have a link are shown; nothing at all when none has one, and nothing in the phone app.
 */
export function SocialLinks() {
  const t = useT();
  const [links, setLinks] = useState<{ key: SocialKey; url: string }[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    apiFetch('/api/seo')
      .then(({ data }) => {
        const social = (data?.geo?.social ?? {}) as Partial<GeoSettings['social']>;
        setLinks(SOCIAL_KEYS.filter((k) => social[k]).map((k) => ({ key: k, url: social[k]! })));
      })
      .catch(() => {});
  }, []);

  if (!links.length) return null;
  return (
    <>
      <SectionHeader title={t('home.social')} />
      <View style={styles.card}>
        <Text style={styles.sub}>{t('home.socialSub')}</Text>
        <View style={styles.row}>
          {links.map(({ key, url }) => {
            const b = brands[key];
            return (
              <Pressable
                key={key}
                onPress={() => Linking.openURL(url)}
                accessibilityRole="link"
                accessibilityLabel={b.name}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.item, (pressed || hovered) && { transform: [{ translateY: -2 }] }]}
              >
                <View style={[styles.icon, { backgroundColor: b.color }]}>
                  <Ionicons name={b.icon} size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {b.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 12, gap: 12, ...cardShadow },
  sub: { fontFamily: font.regular, fontSize: 13, color: colors.textSoft, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 },
  item: { width: 72, alignItems: 'center', gap: 6, paddingVertical: 2 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: font.medium, fontSize: 12, color: colors.text },
});
