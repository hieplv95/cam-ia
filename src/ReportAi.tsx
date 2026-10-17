import { Ionicons } from '@expo/vector-icons';
import type { SkImage } from '@shopify/react-native-skia';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from './account';
import { MAX_REPORT_NOTE, MAX_REPORT_PROMPT, REPORT_REASONS, type ReportReason } from './ai/report';
import { encodeBase64, imageFromBase64, resizeImage } from './editor/imageOps';
import { notify } from './notify';
import { colors, font } from './theme';
import { useT } from './i18n';

/**
 * "Báo cáo": lets people flag an AI result as inappropriate without leaving the app (Google Play's AI-generated
 * content policy). Sends the reason, an optional note, the request text and a small copy of the picture to
 * /api/report; the team reviews it on the admin page.
 */
export function ReportAi({
  tool,
  image,
  b64,
  prompt,
  style,
}: {
  /** What made the result, e.g. 'studio.restore', 'combine', 'generate', 'video'. */
  tool: string;
  /** The result, as a Skia image or as base64 (PNG/JPEG); none for a video. */
  image?: SkImage | null;
  b64?: string | null;
  /** The text the person asked with, if any. */
  prompt?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const close = () => {
    if (sending) return;
    setOpen(false);
    setReason(null);
    setNote('');
  };

  const send = async () => {
    if (!reason || sending) return;
    setSending(true);
    try {
      const source = image ?? (b64 ? await imageFromBase64(b64) : null);
      const small = source ? encodeBase64(await resizeImage(source, 768), 80) : undefined;
      const { ok, data } = await apiFetch('/api/report', {
        body: { tool, reason, note: note.trim(), prompt: prompt?.slice(0, MAX_REPORT_PROMPT), image: small },
      });
      if (!ok) throw new Error(data?.error ?? t('common.error'));
      setSending(false);
      close();
      notify(t('report.thanks'));
    } catch (e: any) {
      setSending(false);
      notify(e?.message ?? t('common.error'));
    }
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={6} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }, style]} accessibilityRole="button">
        <Ionicons name="flag-outline" size={13} color={colors.textMute} />
        <Text style={styles.linkText}>{t('report.button')}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={[styles.sheet, { paddingBottom: 18 + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{t('report.title')}</Text>
            <Text style={styles.subtitle}>{t('report.subtitle')}</Text>
            <View style={styles.reasons}>
              {REPORT_REASONS.map((r) => (
                <Pressable key={r} onPress={() => setReason(r)} style={[styles.reason, reason === r && styles.reasonActive]}>
                  <Ionicons name={reason === r ? 'radio-button-on' : 'radio-button-off'} size={18} color={reason === r ? colors.gold : colors.textMute} />
                  <Text style={styles.reasonText}>{t(`report.reason.${r}`)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('report.note')}
              placeholderTextColor={colors.textMute}
              maxLength={MAX_REPORT_NOTE}
              multiline
              style={styles.note}
            />
            <View style={styles.buttons}>
              <Pressable onPress={close} style={[styles.button, styles.cancel]}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable onPress={send} disabled={!reason || sending} style={[styles.button, styles.send, (!reason || sending) && { opacity: 0.5 }]}>
                {sending ? <ActivityIndicator color={colors.onGold} /> : <Text style={styles.sendText}>{t('report.send')}</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  linkText: { fontFamily: font.regular, fontSize: 12, color: colors.textMute },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 10 },
  title: { fontFamily: font.semi, fontSize: 18, color: colors.text },
  subtitle: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.textSoft },
  reasons: { gap: 2 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12 },
  reasonActive: { backgroundColor: colors.surface2 },
  reasonText: { fontFamily: font.medium, fontSize: 14, color: colors.text, flex: 1 },
  note: {
    minHeight: 64,
    textAlignVertical: 'top',
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  button: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 13 },
  cancel: { backgroundColor: colors.surface2 },
  cancelText: { fontFamily: font.medium, fontSize: 15, color: colors.text },
  send: { backgroundColor: colors.gold },
  sendText: { fontFamily: font.semi, fontSize: 15, color: colors.onGold },
});
