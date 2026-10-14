import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiGenerate } from '@/src/ai/client';
import { generateIdeas, generateRatios, generateStyles, type GenerateRatio, type GenerateStyleId } from '@/src/ai/generate';
import { useIllustration } from '@/src/aiIllustrations';
import { imageFromBase64 } from '@/src/editor/imageOps';
import { ModelChip } from '@/src/ModelPicker';
import { setPendingExport, setPendingPhoto } from '@/src/pendingPhoto';
import { cardShadow, colors, font, goldGradient } from '@/src/theme';
import { HomeButton, IconButton } from '@/src/ui';
import { HScroll } from '@/src/HScroll';
import { useT } from '@/src/i18n';

const ratioValue = (r: GenerateRatio) => {
  const [w, h] = r.split(':').map(Number);
  return w / h;
};

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function Generate() {
  const t = useT();
  const router = useRouter();
  const placeholder = useIllustration('generate');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<GenerateStyleId>('photo');
  const [ratio, setRatio] = useState<GenerateRatio>('3:4');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const out = await aiGenerate(prompt.trim(), style, ratio);
      setResult(out.image);
      setMessage(`Xong ✨ ${out.summary}`);
    } catch (e: any) {
      setMessage(e.message ?? t('common.aiError'));
    } finally {
      setBusy(false);
    }
  };

  const edit = () => {
    if (!result) return;
    setPendingPhoto({ kind: 'base64', data: result });
    router.push('/editor');
  };

  const exportIt = async () => {
    if (!result) return;
    setPendingExport(await imageFromBase64(result));
    router.push('/export');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon={{ set: 'ion', name: 'chevron-back' }} onPress={() => (router.canGoBack() ? router.back() : router.replace('/ai'))} />
        <Text style={styles.title}>{t('generate.title')}</Text>
        <HomeButton />
      </View>

      <ScrollView contentContainerStyle={styles.column} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.preview, { aspectRatio: ratioValue(ratio) }]}>
          {result ? (
            <Image source={{ uri: `data:image/png;base64,${result}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <>
              {placeholder ? <Image source={{ uri: placeholder }} style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} resizeMode="cover" /> : null}
              <View style={styles.placeholderText}>
                <Ionicons name="sparkles" size={28} color={colors.gold} />
                <Text style={styles.placeholderTitle}>{t('generate.placeholderTitle')}</Text>
              </View>
            </>
          )}
          {busy && (
            <View style={styles.busy}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.busyText}>{t('generate.working')}</Text>
            </View>
          )}
        </View>

        {message && <Text style={styles.message}>{message}</Text>}

        {result && !busy && (
          <View style={styles.resultActions}>
            <Pressable onPress={edit} style={styles.secondaryBtn}>
              <Ionicons name="color-wand-outline" size={18} color={colors.text} />
              <Text style={styles.secondaryText}>{t('common.edit')}</Text>
            </Pressable>
            <Pressable onPress={exportIt} style={styles.secondaryBtn}>
              <Ionicons name="download-outline" size={18} color={colors.text} />
              <Text style={styles.secondaryText}>{t('common.saveImage')}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>{t('generate.describe')}</Text>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder={t('generate.inputPlaceholder')}
          placeholderTextColor={colors.textMute}
          style={styles.input}
          multiline
          maxLength={300}
        />
        <HScroll contentContainerStyle={styles.chips}>
          {generateIdeas.map((idea) => (
            <Chip key={idea} label={t(idea)} onPress={() => setPrompt(t(idea))} />
          ))}
        </HScroll>

        <Text style={styles.label}>{t('common.style')}</Text>
        <View style={styles.wrap}>
          {generateStyles.map((s) => (
            <Chip key={s.id} label={t(`generate.style.${s.id}`)} active={style === s.id} onPress={() => setStyle(s.id)} />
          ))}
        </View>

        <Text style={styles.label}>{t('generate.ratio')}</Text>
        <View style={styles.wrap}>
          {generateRatios.map((r) => (
            <Chip key={r} label={r} active={ratio === r} onPress={() => setRatio(r)} />
          ))}
        </View>

        <ModelChip style={{ marginTop: 4 }} />

        <Pressable disabled={!prompt.trim() || busy} onPress={generate} style={({ pressed }) => [(pressed || busy || !prompt.trim()) && { opacity: 0.6 }]}>
          <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.generateBtn}>
            <Ionicons name="sparkles" size={18} color={colors.onGold} />
            <Text style={styles.generateText}>{result ? t('generate.again') : t('generate.run')}</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 },
  title: { fontFamily: font.serif, fontSize: 22, color: colors.text },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  preview: {
    width: '100%',
    maxHeight: 420,
    alignSelf: 'center',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  placeholderText: { alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  placeholderTitle: { fontFamily: font.semi, fontSize: 15, color: colors.text, textAlign: 'center' },
  busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(42,32,24,0.45)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  busyText: { fontFamily: font.medium, fontSize: 14, color: '#FFFFFF' },
  message: { fontFamily: font.medium, fontSize: 13, color: colors.goldDeep, textAlign: 'center' },
  resultActions: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  secondaryText: { fontFamily: font.semi, fontSize: 14, color: colors.text },
  label: { fontFamily: font.semi, fontSize: 15, color: colors.text, marginTop: 6 },
  input: {
    minHeight: 84,
    textAlignVertical: 'top',
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  chips: { gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  chipTextActive: { color: '#FFFFFF' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, marginTop: 6 },
  generateText: { fontFamily: font.semi, fontSize: 16, color: colors.onGold },
});
