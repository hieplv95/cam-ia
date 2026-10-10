import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { studioText, studioTools, type StudioTool } from './ai/studio';
import { FEATURED_ASPECT, featuredImages } from './featuredImages';
import { usePhotoSource } from './photoSource';
import { cardShadow, colors, font } from './theme';
import { useT } from './i18n';

/** "Công cụ nổi bật": restore, hairstyle & makeup, product studio, logo — each opens the Studio screen. */
export function FeaturedTools() {
  const t = useT();
  const router = useRouter();
  const { choose } = usePhotoSource();

  const open = (t: StudioTool) => {
    if (t.needsPhoto) choose({ type: 'studio', tool: t.id });
    else router.push({ pathname: '/studio', params: { tool: t.id } });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={18} color={colors.gold} />
        <Text style={styles.title}>{t('featured.title')}</Text>
      </View>
      {studioTools.map((t) => (
        <ToolCard key={t.id} tool={t} onPress={() => open(t)} />
      ))}
    </View>
  );
}

function ToolCard({ tool, onPress }: { tool: StudioTool; onPress: () => void }) {
  const t = useT();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.art}>
        <Image source={featuredImages[tool.id]} style={styles.artImage} resizeMode="cover" />
      </View>
      <View style={styles.text}>
        <Text style={styles.cardTitle}>{t(studioText.tool(tool, 'title'))}</Text>
        <Text style={styles.cardDesc}>{t(studioText.tool(tool, 'desc'))}</Text>
      </View>
      <View style={styles.arrow}>
        <Ionicons name="chevron-forward" size={15} color={colors.goldDeep} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  title: { fontFamily: font.semi, fontSize: 18, color: colors.text },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    paddingRight: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  art: { width: '46%', maxWidth: 240, aspectRatio: FEATURED_ASPECT, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface2 },
  // Explicit size: on web a bundled image otherwise keeps its natural pixel size instead of filling the box.
  artImage: { width: '100%', height: '100%' },
  text: { flex: 1, gap: 4 },
  cardTitle: { fontFamily: font.semi, fontSize: 15.5, color: colors.text },
  cardDesc: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: colors.textSoft },
  arrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
});
