import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLanguage, languages, setLanguage, useT } from './i18n';
import { colors, font, MAX_CONTENT_WIDTH } from './theme';

/** Bottom sheet listing the languages, each in its own script. */
export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const current = getLanguage();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('profile.chooseLanguage')}</Text>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {languages.map((l) => {
              const active = l.code === current;
              return (
                <Pressable
                  key={l.code}
                  onPress={() => {
                    setLanguage(l.code);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.name, active && { color: colors.goldDeep }]}>{l.name}</Text>
                  {active && <Ionicons name="checkmark-circle" size={20} color={colors.gold} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(42,32,24,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 10 },
  title: { fontFamily: font.serif, fontSize: 22, color: colors.text, marginBottom: 8 },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  item: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  itemActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  name: { fontSize: 15, color: colors.text, fontFamily: font.medium },
});
