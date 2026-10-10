import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { font } from '../theme';
import { describeChange } from './history';
import type { Doc } from './types';
import { ec } from './ui';
import { useT } from '../i18n';

/**
 * Every edit as a list (newest on top). Tapping a step goes back to it; later steps stay available
 * (shown dimmed) until a new edit replaces them, exactly like undo/redo.
 */
export function HistorySheet({
  visible,
  timeline,
  position,
  firstLabel,
  draftStatus,
  onJump,
  onSaveDraft,
  onClose,
}: {
  visible: boolean;
  timeline: Doc[];
  position: number;
  firstLabel: string;
  draftStatus: string;
  onJump: (index: number) => void;
  onSaveDraft: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const steps = timeline
    .map((d, i) => ({ index: i, label: i === 0 ? firstLabel : describeChange(timeline[i - 1], d) }))
    .filter((s): s is { index: number; label: string } => !!s.label)
    .reverse();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('editor.history')}</Text>
              <Text style={styles.status}>{draftStatus}</Text>
            </View>
            <Pressable hitSlop={10} onPress={onClose} accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={22} color={ec.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 4 }}>
            {steps.map((s) => {
              const current = s.index === position;
              const undone = s.index > position;
              return (
                <Pressable
                  key={s.index}
                  onPress={() => onJump(s.index)}
                  style={({ pressed }) => [styles.step, current && styles.stepCurrent, pressed && { opacity: 0.7 }]}
                >
                  <View style={[styles.dot, current && { backgroundColor: ec.gold, borderColor: ec.gold }, undone && { opacity: 0.4 }]} />
                  <Text numberOfLines={1} style={[styles.stepText, current && { color: ec.gold }, undone && styles.undone]}>
                    {s.label}
                  </Text>
                  {current ? <Text style={styles.badge}>{t('editor.historyCurrent')}</Text> : undone ? <Text style={styles.badgeMute}>{t('editor.historyUndone')}</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable onPress={onSaveDraft} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="bookmark-outline" size={18} color={ec.onGold} />
            <Text style={styles.saveText}>{t('editor.saveDraft')}</Text>
          </Pressable>
          <Text style={styles.hint}>{t('editor.draftHint')}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    maxHeight: '75%',
    backgroundColor: ec.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: ec.border,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: ec.border, marginVertical: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  title: { fontFamily: font.semi, fontSize: 17, color: ec.text },
  status: { fontFamily: font.regular, fontSize: 12, color: ec.textSoft, marginTop: 2 },
  list: { flexGrow: 0 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12 },
  stepCurrent: { backgroundColor: ec.goldSoft },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: ec.textSoft },
  stepText: { flex: 1, fontFamily: font.medium, fontSize: 14, color: ec.text },
  undone: { color: ec.textMute, textDecorationLine: 'line-through' },
  badge: { fontFamily: font.semi, fontSize: 11, color: ec.gold },
  badgeMute: { fontFamily: font.regular, fontSize: 11, color: ec.textMute },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ec.gold, borderRadius: 14, paddingVertical: 13, marginTop: 12 },
  saveText: { fontFamily: font.semi, fontSize: 15, color: ec.onGold },
  hint: { fontFamily: font.regular, fontSize: 12, color: ec.textSoft, textAlign: 'center', marginTop: 8 },
});
