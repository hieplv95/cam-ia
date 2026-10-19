import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import type { RetouchOptionId } from './ai/retouch';
import { Icon, retouchIcons, type IconSpec } from './icons';
import { colors, font } from './theme';
import { useT } from './i18n';

/** Sample pictures of the retouch tools (AI-made, same model; 360 px squares bundled with the app). */
export const retouchPhotos: Record<RetouchOptionId, ImageSourcePropType> = {
  skin: require('../assets/images/beauty/skin.jpg'),
  slimface: require('../assets/images/beauty/slimface.jpg'),
  bigeyes: require('../assets/images/beauty/bigeyes.jpg'),
  teeth: require('../assets/images/beauty/teeth.jpg'),
  lips: require('../assets/images/beauty/lips.jpg'),
  waist: require('../assets/images/beauty/waist.jpg'),
  legs: require('../assets/images/beauty/legs.jpg'),
  acne: require('../assets/images/beauty/acne.jpg'),
  nose: require('../assets/images/beauty/nose.jpg'),
  eyes: require('../assets/images/beauty/eyes.jpg'),
  light: require('../assets/images/beauty/light.jpg'),
};

/** Sample pictures of the free face, makeup and body tools in the editor (cut from the same pictures). */
export const beautyPhotos = {
  vline: require('../assets/images/beauty/vline.jpg'),
  jaw: require('../assets/images/beauty/jaw.jpg'),
  nose: require('../assets/images/beauty/nose.jpg'),
  noselift: require('../assets/images/beauty/noselift.jpg'),
  fulllips: require('../assets/images/beauty/fulllips.jpg'),
  blush: require('../assets/images/beauty/blush.jpg'),
  brows: require('../assets/images/beauty/brows.jpg'),
  shoulders: require('../assets/images/beauty/shoulders.jpg'),
  longlegs: require('../assets/images/beauty/longlegs.jpg'),
  height: require('../assets/images/beauty/height.jpg'),
  rosy: require('../assets/images/beauty/rosy.jpg'),
  even: require('../assets/images/beauty/even.jpg'),
  glow: require('../assets/images/beauty/glow.jpg'),
  detail: require('../assets/images/beauty/detail.jpg'),
} satisfies Record<string, ImageSourcePropType>;

/** "Làm đẹp nhanh" tile: the sample picture, a small round icon on its lower edge and the name; picked ones get a gold frame. */
export function RetouchToolCard({
  id,
  active,
  onPress,
  size = 62,
  label,
  photo,
  icon,
  oneLine = false,
}: {
  /** Which sample picture and icon to show. */
  id: RetouchOptionId;
  active: boolean;
  onPress: () => void;
  size?: number;
  /** Name under the picture; the retouch tool's own name by default. */
  label?: string;
  /** Another picture and icon than the retouch tool's own. */
  photo?: ImageSourcePropType;
  icon?: IconSpec;
  /** Keep the name on one line (the card grows a little wider instead), so every row of cards has the same height. */
  oneLine?: boolean;
}) {
  const t = useT();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, oneLine ? { minWidth: size + 8, maxWidth: size + 40 } : { width: size + 8 }, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <View style={[styles.frame, { width: size + 4, height: size + 4, borderRadius: size * 0.24 }, active && styles.frameActive]}>
        <Image source={photo ?? retouchPhotos[id]} style={{ width: size, height: size, borderRadius: size * 0.22 }} />
        {active && (
          <View style={styles.check}>
            <Ionicons name="checkmark" size={11} color={colors.onGold} />
          </View>
        )}
      </View>
      <View style={[styles.badge, active && styles.badgeActive]}>
        <Icon icon={icon ?? retouchIcons[id]} size={13} color={active ? colors.onGold : colors.goldDeep} />
      </View>
      <Text numberOfLines={oneLine ? 1 : 2} style={[styles.label, active && { color: colors.goldDeep }]}>
        {(label ?? t(`retouch.${id}`)).replace('\n', ' ')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center' },
  frame: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  frameActive: { borderColor: colors.gold },
  check: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginTop: -12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  label: { fontFamily: font.medium, fontSize: 10.5, lineHeight: 13, color: colors.text, textAlign: 'center', marginTop: 3 },
});
