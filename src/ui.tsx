import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconSpec } from './icons';
import { bronzeGradient, colors, font, goldGradient, MAX_CONTENT_WIDTH } from './theme';
import { useT } from './i18n';

/** Scrollable tab screen with a centered content column on wide screens. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const t = useT();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8} style={styles.seeAll}>
          <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.gold} />
        </Pressable>
      )}
    </View>
  );
}

export function GoldButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.goldBtn}>
        <Text style={styles.goldBtnText}>{label}</Text>
        {icon && <Ionicons name="arrow-forward" size={16} color={colors.onGold} />}
      </LinearGradient>
    </Pressable>
  );
}

export function Chip({
  label,
  icon,
  active,
  onPress,
  disabled,
}: {
  label: string;
  icon?: IconSpec;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, (pressed || disabled) && { opacity: 0.6 }]}
    >
      {icon ? <Icon icon={icon} size={17} color={active ? colors.gold : colors.textSoft} /> : null}
      <Text style={[styles.chipLabel, active && { color: colors.gold }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled,
  style,
}: {
  icon: IconSpec;
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, style, (pressed || disabled) && { opacity: 0.35 }]}
    >
      <Icon icon={icon} size={22} color={colors.text} />
      {label ? <Text style={styles.iconBtnLabel}>{label}</Text> : null}
    </Pressable>
  );
}

export function Swatches({ colorsList, value, onChange }: { colorsList: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <View style={styles.swatches}>
      {colorsList.map((c) => (
        <Pressable key={c} onPress={() => onChange(c)} style={[styles.swatch, { backgroundColor: c }, c === value && styles.swatchActive]} />
      ))}
    </View>
  );
}

/** Gold circle with a crescent cut-out: the Cami "C" mark. */
export function CamiLogo({ size = 42 }: { size?: number }) {
  return (
    <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: size * 0.31,
          backgroundColor: colors.text,
          right: size * 0.08,
          top: size * 0.12,
        }}
      />
    </LinearGradient>
  );
}

/** Bump when there is something new to announce; the bell shows a dot until the user opens it. */
const WHATS_NEW_VERSION = '2026-10-whats-new-3';

/** Brand row used at the top of the tab screens: logo, name, notifications and PRO badge. */
export function AppHeader() {
  const t = useT();
  const router = useRouter();
  const [unread, setUnread] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('whats-new-seen')
      .then((v) => setUnread(v !== WHATS_NEW_VERSION))
      .catch(() => {});
  }, []);
  const openWhatsNew = () => {
    setUnread(false);
    AsyncStorage.setItem('whats-new-seen', WHATS_NEW_VERSION).catch(() => {});
    if (Platform.OS === 'web') window.alert(t('whatsNew.body'));
    else Alert.alert('Cami', t('whatsNew.body'));
  };
  return (
    <View style={styles.header}>
      <CamiLogo />
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>CAMI</Text>
        <Text style={styles.brandSub}>{t('common.tagline')}</Text>
      </View>
      <Pressable hitSlop={8} onPress={openWhatsNew} accessibilityLabel={t('common.notifications')}>
        <Ionicons name="notifications-outline" size={22} color={colors.text} />
        {unread && <View style={styles.bellDot} />}
      </Pressable>
      <Pressable onPress={() => router.navigate('/profile')}>
        <LinearGradient colors={bronzeGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.proPill}>
          <MaterialCommunityIcons name="crown" size={13} color="#FFFFFF" />
          <Text style={styles.proText}>PRO</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  brand: { fontFamily: font.semi, fontSize: 24, letterSpacing: 6, color: colors.text, lineHeight: 28 },
  brandSub: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  proPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  proText: { fontFamily: font.bold, fontSize: 12, color: '#FFFFFF', letterSpacing: 1 },
  bellDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 32 },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: 16, gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  sectionTitle: { fontFamily: font.semi, fontSize: 18, color: colors.text },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontFamily: font.medium, fontSize: 13, color: colors.gold },
  goldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  goldBtnText: { fontFamily: font.semi, fontSize: 14, color: colors.onGold },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  chipLabel: { fontFamily: font.medium, fontSize: 14, color: colors.text },
  iconBtn: { alignItems: 'center', justifyContent: 'center', minWidth: 44, paddingHorizontal: 6, gap: 2 },
  iconBtnLabel: { fontFamily: font.regular, fontSize: 10, color: colors.textSoft },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border },
  swatchActive: { borderWidth: 3, borderColor: colors.gold, transform: [{ scale: 1.12 }] },
});
