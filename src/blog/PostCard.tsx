import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { apiUrl } from '../account';
import { useT } from '../i18n';
import { cardShadow, colors, font } from '../theme';
import { postDate } from './api';
import type { BlogSummary } from './types';

/** An article in a list: picture, title, short description, date and reading time. `wide` = picture on the left. */
export function PostCard({ post, wide }: { post: BlogSummary; wide?: boolean }) {
  const t = useT();
  return (
    <Link href={`/blog/${post.slug}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, wide && styles.wide, pressed && { opacity: 0.85 }]}>
        {post.cover ? (
          <Image source={{ uri: apiUrl(post.cover) }} style={wide ? styles.thumb : styles.cover} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={[wide ? styles.thumb : styles.cover, styles.placeholder]}>
            <Text style={styles.placeholderText}>CamIA</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {post.title}
          </Text>
          {!wide && post.description ? (
            <Text style={styles.desc} numberOfLines={2}>
              {post.description}
            </Text>
          ) : null}
          <Text style={styles.meta}>
            {postDate(post.publishedAt, post.lang)} · {t('blog.minutes', { n: post.minutes })}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...cardShadow },
  wide: { flexDirection: 'row', alignItems: 'center' },
  cover: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surface2 },
  thumb: { width: 108, height: 84, backgroundColor: colors.surface2 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontFamily: font.bold, fontSize: 16, color: colors.gold },
  body: { flex: 1, padding: 12, gap: 4 },
  title: { fontFamily: font.bold, fontSize: 15.5, lineHeight: 21, color: colors.text },
  desc: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.textSoft },
  meta: { fontFamily: font.regular, fontSize: 12, color: colors.textMute },
});
