import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchPost, fetchPosts, postDate } from '@/src/blog/api';
import { BlogImage, Markdown } from '@/src/blog/Markdown';
import { PostCard } from '@/src/blog/PostCard';
import type { BlogPost, BlogSummary } from '@/src/blog/types';
import { useT } from '@/src/i18n';
import { colors, font, goldGradient } from '@/src/theme';
import { IconButton } from '@/src/ui';

/** One blog article, with a call to try CamIA and a few more articles in its language. */
export default function BlogArticle() {
  const t = useT();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null | undefined>(undefined);
  const [more, setMore] = useState<BlogSummary[]>([]);

  useEffect(() => {
    setPost(undefined);
    fetchPost(String(slug))
      .then((p) => {
        setPost(p);
        if (p) fetchPosts(p.lang, 4).then((list) => setMore(list.filter((x) => x.id !== p.id).slice(0, 3)), () => {});
      })
      .catch(() => setPost(null));
  }, [slug]);

  // The server writes the title into the first page loaded; moving between articles inside the app updates it here.
  useEffect(() => {
    if (Platform.OS === 'web' && post) document.title = `${post.title} | CamIA`;
  }, [post]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/blog'));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon={{ set: 'ion', name: 'chevron-back' }} onPress={back} />
        <Pressable onPress={() => router.navigate('/blog')} hitSlop={8}>
          <Text style={styles.headerLink}>{t('blog.allPosts')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.column}>
        {post === undefined && <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />}
        {post === null && <Text style={styles.empty}>{t('blog.notFound')}</Text>}
        {post && (
          <>
            <View style={{ gap: 10 }}>
              <Text role="heading" aria-level={1} style={styles.title}>
                {post.title}
              </Text>
              <Text style={styles.meta}>
                {postDate(post.publishedAt, post.lang)} · {t('blog.minutes', { n: post.minutes })}
              </Text>
            </View>
            {post.cover ? <BlogImage url={post.cover} alt={post.title} /> : null}
            <Markdown content={post.content} />

            <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
              <Text style={styles.ctaTitle}>{t('blog.cta')}</Text>
              <Text style={styles.ctaSub}>{t('blog.ctaSub')}</Text>
              <Pressable onPress={() => router.navigate('/')} style={({ pressed }) => [styles.ctaButton, pressed && { opacity: 0.8 }]}>
                <Text style={styles.ctaButtonText}>{t('blog.ctaButton')}</Text>
              </Pressable>
            </LinearGradient>

            {more.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text role="heading" aria-level={2} style={styles.moreTitle}>
                  {t('blog.more')}
                </Text>
                {more.map((p) => (
                  <PostCard key={p.id} post={p} wide />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 6, width: '100%', maxWidth: 760, alignSelf: 'center' },
  headerLink: { fontFamily: font.semi, fontSize: 14, color: colors.goldDeep, paddingHorizontal: 8 },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 48, gap: 20 },
  title: { fontFamily: font.serif, fontSize: 30, lineHeight: 38, color: colors.text },
  meta: { fontFamily: font.regular, fontSize: 13, color: colors.textSoft },
  empty: { fontFamily: font.regular, fontSize: 15, color: colors.textSoft, textAlign: 'center', marginTop: 40 },
  cta: { borderRadius: 20, padding: 20, gap: 8, marginTop: 8 },
  ctaTitle: { fontFamily: font.bold, fontSize: 19, color: colors.onGold },
  ctaSub: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colors.onGold },
  ctaButton: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: colors.text, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14 },
  ctaButtonText: { fontFamily: font.bold, fontSize: 14, color: '#FFFFFF' },
  moreTitle: { fontFamily: font.bold, fontSize: 19, color: colors.text, marginTop: 8 },
});
