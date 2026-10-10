import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font } from '../theme';

/** Admin pages are wider than the app's screens: dashboards need room on a desktop. */
const ADMIN_MAX_WIDTH = 1180;

export function Shell({ title, subtitle, onRefresh, children }: { title: string; subtitle?: string; onRefresh?: () => void; children: ReactNode }) {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.header}>
            <Pressable onPress={back} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Quay lại">
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {onRefresh ? (
              <Pressable onPress={onRefresh} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Tải lại">
                <Ionicons name="refresh" size={19} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.gold} />
    </View>
  );
}

export function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
      <Text style={styles.failText}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retry}>
        <Text style={styles.retryText}>Thử lại</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  column: { width: '100%', maxWidth: ADMIN_MAX_WIDTH, alignSelf: 'center', gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: font.serif, fontSize: 24, color: colors.text },
  subtitle: { fontFamily: font.regular, fontSize: 12.5, color: colors.textSoft },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  failText: { fontFamily: font.medium, fontSize: 14, color: colors.text, textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.goldSoft },
  retryText: { fontFamily: font.semi, fontSize: 13.5, color: colors.goldDeep },
});
