import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HScroll } from '../HScroll';
import { getLanguage, useT } from '../i18n';
import { SectionHeader } from '../ui';
import { fetchPosts } from './api';
import { PostCard } from './PostCard';
import type { BlogSummary } from './types';

/** Home page section with the latest articles; hidden while there are none. */
export function HomeBlog({ bleedStyle, bleedContentStyle }: { bleedStyle: object; bleedContentStyle: object }) {
  const t = useT();
  const router = useRouter();
  const lang = getLanguage();
  const [posts, setPosts] = useState<BlogSummary[]>([]);
  useEffect(() => {
    fetchPosts(lang, 6).then(setPosts, () => setPosts([]));
  }, [lang]);
  if (!posts.length) return null;
  return (
    <>
      <SectionHeader title={t('home.blog')} onSeeAll={() => router.navigate('/blog')} />
      <HScroll style={bleedStyle} contentContainerStyle={bleedContentStyle}>
        {posts.map((p) => (
          <View key={p.id} style={styles.item}>
            <PostCard post={p} />
          </View>
        ))}
      </HScroll>
    </>
  );
}

const styles = StyleSheet.create({
  item: { width: 260 },
});
