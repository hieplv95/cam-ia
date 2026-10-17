import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { studioTools, type StudioToolId } from '../ai/studio';
import { getLanguage, languageName, languages, setLanguage, useT, type MessageKey } from '../i18n';
import { usePhotoSource } from '../photoSource';
import { colors, font } from '../theme';
import { BRAND_BROWN, CamiLogo } from '../ui';
import { fetchPosts } from './api';
import type { BlogSummary } from './types';

/** Tools listed in the footer: each opens the photo picker (or the Studio) like on the home page. */
const TOOLS: { label: MessageKey; studio?: StudioToolId; preset?: 'whitebg' }[] = [
  { label: 'studio.restore.title', studio: 'restore' },
  { label: 'ai.card.removebg.title', preset: 'whitebg' },
  { label: 'studio.logo.title', studio: 'logo' },
  { label: 'studio.product.title', studio: 'product' },
];

/** Bottom of the blog pages (design 1): about + language, tools, latest articles, copyright. */
export function BlogFooter() {
  const t = useT();
  const router = useRouter();
  const { choose } = usePhotoSource();
  const lang = getLanguage();
  const [recent, setRecent] = useState<BlogSummary[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    fetchPosts(lang, 4).then(setRecent, () => setRecent([]));
  }, [lang]);

  const openTool = (tool: (typeof TOOLS)[number]) => {
    if (tool.preset) return choose({ type: 'ai', preset: tool.preset });
    const info = studioTools.find((s) => s.id === tool.studio);
    if (info?.needsPhoto) choose({ type: 'studio', tool: info.id });
    else router.push({ pathname: '/studio', params: { tool: tool.studio! } });
  };

  return (
    <View style={styles.band}>
      <View style={styles.inner}>
        <View style={styles.cols}>
          <View style={[styles.col, styles.about]}>
            <View style={styles.logo}>
              <CamiLogo size={22} />
              <Text style={styles.brand}>CamIA</Text>
            </View>
            <Text style={styles.text}>{t('blog.footer.about')}</Text>
            <Pressable onPress={() => setPicking((p) => !p)} style={styles.langButton} accessibilityLabel={t('blog.footer.language')}>
              <Ionicons name="globe-outline" size={15} color={colors.textSoft} />
              <Text style={styles.text}>{languageName(lang)}</Text>
              <Ionicons name={picking ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSoft} />
            </Pressable>
            {picking && (
              <View style={styles.langs}>
                {languages.map((l) => (
                  <Pressable
                    key={l.code}
                    onPress={() => {
                      setLanguage(l.code);
                      setPicking(false);
                    }}
                    style={[styles.lang, l.code === lang && styles.langOn]}
                  >
                    <Text style={[styles.langText, l.code === lang && styles.langTextOn]}>{l.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.col}>
            <Text style={styles.heading}>{t('blog.footer.tools')}</Text>
            {TOOLS.map((tool) => (
              <Pressable key={tool.label} onPress={() => openTool(tool)} hitSlop={4}>
                <Text style={styles.link}>{t(tool.label)}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.col}>
            <Text style={styles.heading}>{t('blog.footer.recent')}</Text>
            {recent.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} style={styles.link} numberOfLines={1}>
                {p.title}
              </Link>
            ))}
            <Link href="/blog" style={[styles.link, styles.linkStrong]}>
              {t('blog.allPosts')} ›
            </Link>
          </View>
        </View>
        <View style={styles.rights}>
          <Text style={styles.rightsText}>{t('blog.footer.rights', { year: new Date().getFullYear() })}</Text>
          <View style={styles.legal}>
            <Link href="/privacy" style={styles.rightsText}>
              {t('legal.privacy')}
            </Link>
            <Link href="/terms" style={styles.rightsText}>
              {t('legal.terms')}
            </Link>
            <Link href="/delete-account" style={styles.rightsText}>
              {t('legal.deleteAccount')}
            </Link>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: '#F1E8DB', marginTop: 32 },
  inner: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 18, gap: 18 },
  cols: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  col: { flexGrow: 1, flexBasis: 200, minWidth: 0, gap: 7 },
  about: { flexBasis: 260 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontFamily: font.bold, fontSize: 16, color: BRAND_BROWN },
  heading: { fontFamily: font.semi, fontSize: 13.5, color: BRAND_BROWN, marginBottom: 2 },
  text: { fontFamily: font.regular, fontSize: 13, lineHeight: 20, color: '#6B5A49' },
  link: { fontFamily: font.regular, fontSize: 13, lineHeight: 20, color: '#6B5A49' },
  linkStrong: { fontFamily: font.semi, color: BRAND_BROWN },
  langButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lang: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#FFFFFF' },
  langOn: { backgroundColor: colors.gold },
  langText: { fontFamily: font.medium, fontSize: 12, color: BRAND_BROWN },
  langTextOn: { color: '#FFFFFF' },
  rights: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E0D2BE', paddingTop: 12 },
  rightsText: { fontFamily: font.regular, fontSize: 12, color: '#8A7A69' },
  legal: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
});
