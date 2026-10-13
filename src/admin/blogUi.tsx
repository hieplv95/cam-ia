import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font } from '../theme';

/** Small form pieces of the admin Blog tab and editor. */

/** Asks before something that can't be undone (window.confirm on the web). */
export function confirmAction(message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert('Xác nhận', message, [
      { text: 'Huỷ', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Đồng ý', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export function Field({ label, children, style }: { label: string; children: ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.check} role="checkbox" aria-checked={value}>
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={20} color={value ? colors.goldDeep : colors.textSoft} />
      <Text style={styles.checkText}>{label}</Text>
    </Pressable>
  );
}

export const blogStyles = StyleSheet.create({
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text,
  },
});

const styles = StyleSheet.create({
  field: { gap: 6, flexGrow: 1, minWidth: 0 },
  label: { fontFamily: font.semi, fontSize: 13, color: colors.text },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.text },
  chipTextOn: { color: '#FFFFFF', fontFamily: font.semi },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { fontFamily: font.medium, fontSize: 13.5, color: colors.text },
});
