import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { creditsLabel, useAccount } from '../account';
import { useT, type MessageKey } from '../i18n';
import { Icon } from '../icons';
import { ModelChip } from '../ModelPicker';
import { cardShadow, font } from '../theme';
import { ec } from './ui';

const MAX_PROMPT = 300;
const SUGGESTIONS: MessageKey[] = ['editor.aiPrompt.s1', 'editor.aiPrompt.s2', 'editor.aiPrompt.s3', 'editor.aiPrompt.s4'];

/**
 * "Describe the edit" box under the photo, on every editor tab: the AI edits the picture as written.
 * Collapsed it is a single line; while typing it opens with examples, the model and what is left to spend
 * (`onExpand` lets the editor hide its tool panel to make room above the keyboard).
 */
export function PromptBar({ onSubmit, onExpand }: { onSubmit: (text: string) => void; onExpand: (open: boolean) => void }) {
  const t = useT();
  const { credits } = useAccount();
  const [text, setText] = useState('');
  const [open, setOpenState] = useState(false);
  const input = useRef<TextInput>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setOpen = (v: boolean) => {
    if (closing.current) clearTimeout(closing.current);
    setOpenState(v);
    onExpand(v);
  };

  // Hidden while open (e.g. the layout turned compact): give the tool panels back instead of leaving them hidden.
  const expand = useRef(onExpand);
  expand.current = onExpand;
  useEffect(
    () => () => {
      if (closing.current) clearTimeout(closing.current);
      expand.current(false);
    },
    [],
  );

  const submit = () => {
    const prompt = text.trim();
    if (!prompt) return;
    input.current?.blur();
    setText('');
    setOpen(false);
    onSubmit(prompt);
  };

  // Leaving an empty box closes it; the delay lets a tap on an example land first (web blurs before the click).
  const onBlur = () => {
    closing.current = setTimeout(() => {
      if (!text.trim()) setOpen(false);
    }, 200);
  };

  const left = creditsLabel(credits);
  const ready = !!text.trim();

  return (
    <View style={[styles.wrap, open && styles.wrapOpen]}>
      <View style={styles.row}>
        <Icon icon={{ set: 'ion', name: 'sparkles' }} size={17} color={ec.gold} />
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          onFocus={() => setOpen(true)}
          onBlur={onBlur}
          placeholder={t('editor.promptPlaceholder')}
          placeholderTextColor={ec.textMute}
          style={[styles.input, open && styles.inputOpen]}
          maxLength={MAX_PROMPT}
          multiline={open}
          blurOnSubmit
          onSubmitEditing={submit}
          returnKeyType="send"
          accessibilityLabel={t('editor.aiPrompt.label')}
        />
        {!open && (
          <Pressable onPress={submit} disabled={!ready} style={[styles.send, !ready && styles.sendOff]} accessibilityLabel={t('editor.aiPrompt.run')}>
            <Icon icon={{ set: 'ion', name: 'arrow-up' }} size={17} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      {open && (
        <>
          <Text style={styles.hint}>{t('editor.aiPrompt.hint')}</Text>
          <View style={styles.chips}>
            {SUGGESTIONS.map((key) => (
              <Pressable
                key={key}
                onPress={() => {
                  if (closing.current) clearTimeout(closing.current);
                  setText(t(key));
                  input.current?.focus();
                }}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.chipText}>{t(key)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.footer}>
            <ModelChip />
            {left ? (
              <Text style={styles.left} numberOfLines={1}>
                {left}
              </Text>
            ) : null}
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => {
                input.current?.blur();
                setText('');
                setOpen(false);
              }}
              hitSlop={6}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={!ready} style={[styles.run, !ready && styles.sendOff]}>
              <Icon icon={{ set: 'ion', name: 'sparkles' }} size={14} color="#FFFFFF" />
              <Text style={styles.runText}>{t('editor.aiPrompt.run')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  wrapOpen: {
    backgroundColor: ec.surface,
    borderRadius: 22,
    marginHorizontal: 12,
    width: 'auto',
    paddingTop: 12,
    paddingBottom: 12,
    ...cardShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ec.surface,
    borderWidth: 1,
    borderColor: ec.border,
    borderRadius: 22,
    ...cardShadow,
    shadowOpacity: 0.06,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    fontFamily: font.regular,
    fontSize: 14,
    color: ec.text,
    paddingVertical: 8,
  },
  inputOpen: { minHeight: 64, maxHeight: 110, textAlignVertical: 'top' },
  send: { width: 34, height: 34, borderRadius: 17, backgroundColor: ec.gold, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
  hint: { fontFamily: font.regular, fontSize: 12, color: ec.textSoft, paddingHorizontal: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: ec.border, backgroundColor: ec.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontFamily: font.regular, fontSize: 12.5, color: ec.text },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  left: { fontFamily: font.regular, fontSize: 12, color: ec.textSoft, flexShrink: 1 },
  cancel: { paddingHorizontal: 10, paddingVertical: 8 },
  cancelText: { fontFamily: font.medium, fontSize: 13.5, color: ec.textSoft },
  run: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ec.gold, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  runText: { fontFamily: font.semi, fontSize: 14, color: '#FFFFFF' },
});
