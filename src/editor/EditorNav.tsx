import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT, type MessageKey } from '../i18n';
import { cardShadow, colors, font } from '../theme';

type IonName = ComponentProps<typeof Ionicons>['name'];

/** The app's main sections, same as the tab bar; "Chỉnh sửa" is where the editor lives. */
const items: { href: Href | null; label: MessageKey; icon: IonName; activeIcon: IonName }[] = [
  { href: '/', label: 'tabs.home', icon: 'home-outline', activeIcon: 'home' },
  { href: '/ai', label: 'tabs.ai', icon: 'sparkles-outline', activeIcon: 'sparkles' },
  { href: null, label: 'tabs.edit', icon: 'options-outline', activeIcon: 'options' },
  { href: '/presets', label: 'tabs.presets', icon: 'color-filter-outline', activeIcon: 'color-filter' },
  { href: '/profile', label: 'tabs.profile', icon: 'person-outline', activeIcon: 'person' },
];

/**
 * Bottom navigation inside the editor, so it feels like part of the app. Leaving goes through the editor's
 * leave check (save a draft or not), like the back button.
 */
export function EditorNav() {
  const t = useT();
  const router = useRouter();
  return (
    <View style={styles.bar}>
      {items.map((item) => {
        const active = item.href === null;
        return (
          <Pressable
            key={item.label}
            disabled={active}
            onPress={() => item.href && router.navigate(item.href)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.iconWrap, active && styles.iconActive]}>
              <Ionicons name={active ? item.activeIcon : item.icon} size={21} color={active ? colors.gold : colors.textSoft} />
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {t(item.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingTop: 7,
    paddingBottom: 6,
    ...cardShadow,
  },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  iconWrap: { width: 46, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconActive: { backgroundColor: colors.goldSoft },
  label: { fontFamily: font.regular, fontSize: 11, color: colors.textSoft },
  labelActive: { fontFamily: font.semi, color: colors.gold },
});
