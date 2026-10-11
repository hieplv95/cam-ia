import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useT } from '../i18n';
import { Icon } from '../icons';
import { font } from '../theme';
import { ec, Pill } from './ui';

/** Brush widths on screen (points): the mark covers the object, so a fat brush is often easiest. */
export const ERASE_SIZES = { small: 18, medium: 34, large: 60 } as const;
export type EraseSize = keyof typeof ERASE_SIZES;

/**
 * "Xóa vật thể": paint over what should go, then remove it either on the device ("Xóa nhanh": free, offline,
 * best on simple backgrounds) or with the AI (better on busy scenes, can also follow a description).
 * Nothing is sent before the user presses an AI button; "Tự xóa người lạ" keeps the one-tap automatic cleanup.
 */
export function ErasePanel({
  size,
  onSize,
  marks,
  onUndoMark,
  onClearMarks,
  text,
  onText,
  onRun,
  onQuick,
  onAuto,
}: {
  size: EraseSize;
  onSize: (s: EraseSize) => void;
  marks: number;
  onUndoMark: () => void;
  onClearMarks: () => void;
  text: string;
  onText: (v: string) => void;
  onRun: () => void;
  /** Free removal on the device (needs painted marks). */
  onQuick: () => void;
  onAuto: () => void;
}) {
  const t = useT();
  const ready = marks > 0 || !!text.trim();
  return (
    <View style={styles.col}>
      <View style={styles.row}>
        <Icon icon={{ set: 'ion', name: 'brush-outline' }} size={16} color={ec.gold} />
        <Text style={styles.hint} numberOfLines={2}>
          {t('editor.erase.hint')}
        </Text>
      </View>
      <View style={styles.row}>
        {(Object.keys(ERASE_SIZES) as EraseSize[]).map((s) => (
          <Pill key={s} label={t(`common.${s}`)} active={size === s} onPress={() => onSize(s)} />
        ))}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onUndoMark} disabled={!marks} hitSlop={6} style={[styles.iconBtn, !marks && styles.off]} accessibilityLabel={t('editor.erase.undo')}>
          <Icon icon={{ set: 'ion', name: 'arrow-undo-outline' }} size={17} color={ec.text} />
        </Pressable>
        <Pressable onPress={onClearMarks} disabled={!marks} hitSlop={6} style={[styles.iconBtn, !marks && styles.off]} accessibilityLabel={t('editor.erase.clear')}>
          <Icon icon={{ set: 'ion', name: 'trash-outline' }} size={17} color={ec.text} />
        </Pressable>
      </View>
      <TextInput
        value={text}
        onChangeText={onText}
        placeholder={t('editor.erase.describe')}
        placeholderTextColor={ec.textMute}
        maxLength={200}
        style={styles.input}
        returnKeyType="done"
      />
      <View style={styles.row}>
        <Pressable onPress={onAuto} hitSlop={6} style={({ pressed }) => [styles.auto, pressed && { opacity: 0.7 }]}>
          <Text style={styles.autoText} numberOfLines={2}>
            {t('editor.erase.auto')}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onQuick} disabled={!marks} style={({ pressed }) => [styles.quick, !marks && styles.off, pressed && { opacity: 0.7 }]}>
          <Icon icon={{ set: 'mci', name: 'eraser' }} size={15} color={ec.gold} />
          <Text style={styles.quickText}>{t('editor.erase.quick')}</Text>
        </Pressable>
        <Pressable onPress={onRun} disabled={!ready} style={[styles.run, !ready && styles.off]}>
          <Icon icon={{ set: 'ion', name: 'sparkles' }} size={14} color="#FFFFFF" />
          <Text style={styles.runText}>{t('editor.erase.run')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: 9, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hint: { flex: 1, fontFamily: font.medium, fontSize: 12.5, color: ec.text },
  iconBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: ec.border, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.4 },
  input: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ec.border,
    backgroundColor: ec.surface2,
    paddingHorizontal: 12,
    fontFamily: font.regular,
    fontSize: 13.5,
    color: ec.text,
  },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: ec.gold, paddingHorizontal: 11, paddingVertical: 8 },
  quickText: { fontFamily: font.semi, fontSize: 13, color: ec.gold },
  // A plain link: the two remove buttons matter more.
  auto: { flexShrink: 1, paddingVertical: 8 },
  autoText: { fontFamily: font.medium, fontSize: 12.5, color: ec.textSoft, textDecorationLine: 'underline' },
  run: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: ec.gold, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  runText: { fontFamily: font.semi, fontSize: 13, color: '#FFFFFF' },
});
