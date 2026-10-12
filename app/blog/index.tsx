import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchPosts } from '@/src/blog/api';
import { BlogFooter } from '@/src/blog/BlogFooter';
import { BlogHeader } from '@/src/blog/BlogHeader';
import { PostCard } from '@/src/blog/PostCard';
import type { BlogSummary } from '@/src/blog/types';
import { getLanguage, useT } from '@/src/i18n';
import { colors, font } from '@/src/theme';

/** The blog: latest articles in the reader's language (all languages while there are none in theirs). */
export default function Blog() {
  const t = useT();
  const lang = getLanguage();
  const [posts, setPosts] = useState<BlogSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    fetchPosts(lang)
      .then(setPosts)
      .catch(() => setFailed(true));
  }, [lang]);

  const [first, ...rest] = posts ?? [];
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BlogHeader />
      <ScrollView>
        <View style={styles.column}>
          <View style={{ gap: 2 }}>
            <Text role="heading" aria-level={1} style={styles.title}>
              {t('blog.title')}
            </Text>
            <Text style={styles.subtitle}>{t('blog.subtitle')}</Text>
          </View>
          {!posts && !failed && <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />}
          {failed && <Text style={styles.empty}>{t('common.noNetwork')}</Text>}
          {posts && !posts.length && <Text style={styles.empty}>{t('blog.empty')}</Text>}
          {first && <PostCard post={first} />}
          <View style={styles.grid}>
            {rest.map((p) => (
              <View key={p.id} style={styles.cell}>
                <PostCard post={p} />
              </View>
            ))}
          </View>
        </View>
        <BlogFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontFamily: font.serif, fontSize: 28, lineHeight: 36, color: colors.text },
  subtitle: { fontFamily: font.regular, fontSize: 14, color: colors.textSoft },
  column: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cell: { flexGrow: 1, flexBasis: 280, minWidth: 0 },
  empty: { fontFamily: font.regular, fontSize: 14, color: colors.textSoft, textAlign: 'center', marginTop: 40 },
});
