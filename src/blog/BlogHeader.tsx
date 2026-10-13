import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useT } from '../i18n';
import { usePhotoSource } from '../photoSource';
import { colors, font } from '../theme';
import { BRAND_BROWN, CamiLogo } from '../ui';

/** Below this width the menu links move under the logo row. */
const NARROW = 640;

/**
 * Top bar of the blog pages (design 1, "Gọn nhẹ"): logo, Inicio · Herramientas IA · Blog, and a button that opens a
 * photo straight in the editor. Links are real <a> on the web so search engines follow them.
 */
export function BlogHeader() {
  const t = useT();
  const router = useRouter();
  const { choose } = usePhotoSource();
  const { width } = useWindowDimensions();
  const narrow = width < NARROW;

  const nav = (
    <View style={[styles.nav, narrow && styles.navNarrow]}>
      <Link href="/" style={styles.navLink}>
        {t('tabs.home')}
      </Link>
      <Link href="/ai" style={styles.navLink}>
        {t('ai.title')}
      </Link>
      <Link href="/blog" style={[styles.navLink, styles.navActive]}>
        {t('home.blog')}
      </Link>
    </View>
  );

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        {/* In the app (no browser back button) a chevron goes back; on the web the logo does. */}
        {Platform.OS !== 'web' && (
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={styles.back} accessibilityLabel={t('common.back')}>
            <Ionicons name="chevron-back" size={22} color={BRAND_BROWN} />
          </Pressable>
        )}
        <Link href="/" asChild>
          <Pressable style={styles.logo} accessibilityLabel="CamIA">
            <CamiLogo size={24} />
            <Text style={styles.brand}>CamIA</Text>
          </Pressable>
        </Link>
        {!narrow && nav}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => choose()} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
          <Text style={styles.ctaText}>{t('blog.nav.cta')}</Text>
        </Pressable>
      </View>
      {narrow && nav}
    </View>
  );
}

/** "Inicio › Blog › title" above an article; on narrow screens the last (unlinked) part is left out, the title is right below. */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  const { width } = useWindowDimensions();
  const shown = width < NARROW ? items.filter((it, i) => it.href || i < items.length - 1) : items;
  return (
    <View style={styles.crumbs} role="navigation" aria-label="breadcrumb">
      {shown.map((it, i) => (
        <View key={i} style={styles.crumb}>
          {i > 0 && <Text style={styles.crumbSep}>›</Text>}
          {it.href ? (
            <Link href={it.href as never} style={styles.crumbLink}>
              {it.label}
            </Link>
          ) : (
            <Text style={styles.crumbText} numberOfLines={1}>
              {it.label}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8DFD2' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  back: { marginRight: -6 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontFamily: font.bold, fontSize: 18, color: BRAND_BROWN },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 18, marginLeft: 8 },
  navNarrow: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 8, marginLeft: 0 },
  navLink: { fontFamily: font.medium, fontSize: 14, color: colors.textSoft, paddingVertical: 4 },
  navActive: { color: BRAND_BROWN, fontFamily: font.semi, borderBottomWidth: 2, borderBottomColor: colors.gold },
  cta: { backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  ctaText: { fontFamily: font.semi, fontSize: 13, color: '#FFFFFF' },
  crumbs: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  crumbSep: { fontFamily: font.regular, fontSize: 12.5, color: colors.textMute },
  crumbLink: { fontFamily: font.medium, fontSize: 12.5, color: colors.textSoft },
  crumbText: { fontFamily: font.regular, fontSize: 12.5, color: colors.textMute, flexShrink: 1 },
});
