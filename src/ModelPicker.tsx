import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAiModel } from './ai/client';
import { formatVnd, imageModels, modelInfo, type ImageModelId } from './ai/models';
import { getLanguage, useT, type MessageKey } from './i18n';
import { colors, font, MAX_CONTENT_WIDTH } from './theme';

const modelHints: Record<ImageModelId, MessageKey> = { 'gemini-3.1-flash-image': 'model.flashHint', 'gemini-3-pro-image': 'model.proHint' };

/** Estimated cost of one picture: in đồng for Vietnamese, otherwise in US dollars. */
export const formatCost = (usd: number) => (getLanguage() === 'vi' ? formatVnd(usd) : `${usd.toFixed(3)}`);

/** Bottom sheet listing the image models with their price per picture. */
export function ModelSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [model, setModel] = useAiModel();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('model.title')}</Text>
          <Text style={styles.sub}>{t('model.sub')}</Text>
          {imageModels.map((m) => {
            const active = m.id === model;
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  setModel(m.id);
                  onClose();
                }}
                style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && { opacity: 0.8 }]}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{m.name}</Text>
                    <Text style={styles.hint}>{t(modelHints[m.id])}</Text>
                  </View>
                  <Text style={styles.id}>{m.id}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.price}>~{formatCost(m.usd)}</Text>
                  <Text style={styles.usd}>{t('common.points', { n: m.points })}{getLanguage() === 'vi' ? ` · ${m.usd.toFixed(3)}` : ''}</Text>
                </View>
                <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={active ? colors.gold : colors.textMute} />
              </Pressable>
            );
          })}
          <Text style={styles.note}>{t('model.note')}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Small pill showing the current model; tapping it opens the picker. */
export function ModelChip({ style, dark }: { style?: StyleProp<ViewStyle>; /** For the dark editor. */ dark?: boolean }) {
  const t = useT();
  const [model] = useAiModel();
  const [open, setOpen] = useState(false);
  const info = modelInfo(model);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.chip, style, pressed && { opacity: 0.7 }]}>
        <Ionicons name="hardware-chip-outline" size={14} color={colors.gold} />
        <Text style={[styles.chipText, dark && { color: '#A8A097' }]}>
          {t('model.chip')} <Text style={[styles.chipStrong, dark && { color: '#F4EFE7' }]}>{info?.name ?? model}</Text>
          {info ? ` · ${t('common.points', { n: info.points })}` : ''}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textSoft} />
      </Pressable>
      <ModelSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(42,32,24,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 6 },
  title: { fontFamily: font.serif, fontSize: 22, color: colors.text },
  sub: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: colors.textSoft, marginTop: -4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  name: { fontFamily: font.semi, fontSize: 16, color: colors.text },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  id: { fontFamily: font.regular, fontSize: 11, color: colors.textMute, marginTop: 2 },
  price: { fontFamily: font.semi, fontSize: 14, color: colors.gold },
  usd: { fontFamily: font.regular, fontSize: 11, color: colors.textMute },
  note: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: colors.textSoft, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  chipStrong: { fontFamily: font.semi, color: colors.text },
});
