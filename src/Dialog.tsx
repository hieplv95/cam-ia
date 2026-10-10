import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ec } from './editor/ui';
import { colors, font } from './theme';

export type DialogAction = { label: string; onPress: () => void; primary?: boolean; destructive?: boolean };

/**
 * Small centered dialog with an optional text field. Works the same on web, where Alert has no buttons or input.
 */
export function Dialog({
  visible,
  title,
  message,
  input,
  actions,
  onClose,
  tone = 'light',
}: {
  visible: boolean;
  title: string;
  message?: string;
  input?: { value: string; onChange: (v: string) => void; placeholder?: string; secure?: boolean };
  actions: DialogAction[];
  onClose: () => void;
  tone?: 'light' | 'dark';
}) {
  const c = tone === 'dark' ? { card: ec.surface, border: ec.border, text: ec.text, soft: ec.textSoft, gold: ec.gold, onGold: ec.onGold, field: ec.surface2 } : { card: colors.surface, border: colors.border, text: colors.text, soft: colors.textSoft, gold: colors.gold, onGold: colors.onGold, field: colors.surface2 };
  const primary = actions.find((a) => a.primary);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => {}}>
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: c.soft }]}>{message}</Text> : null}
          {input && (
            <TextInput
              autoFocus
              value={input.value}
              onChangeText={input.onChange}
              placeholder={input.placeholder}
              placeholderTextColor={c.soft}
              maxLength={input.secure ? 128 : 40}
              selectTextOnFocus
              secureTextEntry={input.secure}
              onSubmitEditing={primary?.onPress}
              style={[styles.input, { color: c.text, backgroundColor: c.field, borderColor: c.border }]}
            />
          )}
          <View style={styles.actions}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                style={({ pressed }) => [
                  styles.action,
                  a.primary ? { backgroundColor: c.gold } : { borderColor: c.border, borderWidth: 1 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.actionText, { color: a.primary ? c.onGold : a.destructive ? '#E5484D' : c.text }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 20, borderWidth: 1, padding: 20, gap: 12 },
  title: { fontFamily: font.semi, fontSize: 17 },
  message: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  input: { fontFamily: font.regular, fontSize: 15, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  actions: { gap: 8, marginTop: 4 },
  action: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  actionText: { fontFamily: font.semi, fontSize: 15 },
});
