import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePhotoSource } from '@/src/photoSource';
import { cardShadow, colors, font, MAX_CONTENT_WIDTH } from '@/src/theme';
import { useT, type MessageKey } from '@/src/i18n';

type IonName = ComponentProps<typeof Ionicons>['name'];

const items: Record<string, { label: MessageKey; icon: IonName; activeIcon: IonName }> = {
  index: { label: 'tabs.home', icon: 'home-outline', activeIcon: 'home' },
  ai: { label: 'tabs.ai', icon: 'sparkles-outline', activeIcon: 'sparkles' },
  create: { label: 'tabs.edit', icon: 'add-circle-outline', activeIcon: 'add-circle-outline' },
  presets: { label: 'tabs.presets', icon: 'color-filter-outline', activeIcon: 'color-filter' },
  profile: { label: 'tabs.profile', icon: 'person-outline', activeIcon: 'person' },
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { choose } = usePhotoSource();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const item = items[route.name];
          if (!item) return null;
          const focused = state.index === index;
          // The middle tab is an action, not a screen: it starts a new edit.
          const onPress = () => {
            if (route.name === 'create') return choose({ type: 'adjust' });
            if (!focused) navigation.navigate(route.name);
          };
          const isCreate = route.name === 'create';
          const color = isCreate ? colors.text : focused ? colors.gold : colors.textSoft;
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item} accessibilityRole="button">
              <Ionicons name={focused ? item.activeIcon : item.icon} size={isCreate ? 27 : 23} color={color} />
              <Text style={[styles.label, { color }, focused && { fontFamily: font.semi }]}>{t(item.label)}</Text>
              <View style={[styles.dot, focused && !isCreate && { backgroundColor: colors.gold }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="presets" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Floating white bar over the cream background.
  wrap: { backgroundColor: colors.bg, paddingHorizontal: 12, paddingTop: 6 },
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingTop: 10,
    paddingBottom: 6,
    ...cardShadow,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginTop: 1 },
  label: { fontFamily: font.medium, fontSize: 11 },
});
