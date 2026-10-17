import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlogFooter } from '../blog/BlogFooter';
import { BlogHeader } from '../blog/BlogHeader';
import { getLanguage, useT } from '../i18n';
import { colors, font } from '../theme';

/**
 * Privacy policy, terms of use and the account deletion page (linked from Google Play, the profile screen and the
 * web footer). Their text lives in src/legal/*.json, shared with server.cjs, which serves it to readers without
 * JavaScript. Written in Spanish, English, Portuguese and Vietnamese; other languages see English.
 */
export type LegalSection = { title: string; bullets?: string[]; paragraphs?: string[] };
export type LegalDoc = { title: string; updated: string; intro: string; sections: LegalSection[] };
export type LegalSet = { contact: string } & Record<LegalLang, LegalDoc>;

type LegalLang = 'es' | 'en' | 'pt' | 'vi';
const LEGAL_LANGS: { code: LegalLang; name: string }[] = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'vi', name: 'Tiếng Việt' },
];
const legalLang = (lang: string): LegalLang => (LEGAL_LANGS.some((l) => l.code === lang) ? (lang as LegalLang) : 'en');

/** Text with every {contact} as a mailto link and every https:// address as a link (camia.app pages open in the app). */
function WithContact({ text, contact, style }: { text: string; contact: string; style: object }) {
  const router = useRouter();
  const open = (url: string) => {
    const own = url.match(/^https:\/\/camia\.app(\/[\w/-]*)?$/);
    if (own) router.push((own[1] || '/') as Href);
    else Linking.openURL(url);
  };
  // {contact} and URLs (without a trailing period or bracket) become their own pieces.
  const pieces = text.split(/(\{contact\}|https:\/\/[^\s)]*[^\s).,])/g).filter(Boolean);
  return (
    <Text style={style}>
      {pieces.map((piece, i) =>
        piece === '{contact}' ? (
          <Text key={i} style={styles.link} onPress={() => Linking.openURL(`mailto:${contact}`)}>
            {contact}
          </Text>
        ) : piece.startsWith('https://') ? (
          <Text key={i} style={styles.link} onPress={() => open(piece)}>
            {piece}
          </Text>
        ) : (
          <Text key={i}>{piece}</Text>
        ),
      )}
    </Text>
  );
}

export function LegalPage({ docs }: { docs: LegalSet }) {
  useT();
  const [lang, setLang] = useState<LegalLang>(() => legalLang(getLanguage()));
  const doc = docs[lang];
  const contact = docs.contact;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BlogHeader />
      <ScrollView>
        <View style={styles.column}>
          <View style={styles.langs}>
            {LEGAL_LANGS.map((l) => (
              <Pressable key={l.code} onPress={() => setLang(l.code)} style={[styles.lang, lang === l.code && styles.langActive]}>
                <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>{l.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text role="heading" aria-level={1} style={styles.title}>
            {doc.title}
          </Text>
          <Text style={styles.updated}>{doc.updated}</Text>
          <WithContact text={doc.intro} contact={contact} style={styles.paragraph} />
          {doc.sections.map((s) => (
            <View key={s.title} style={styles.section}>
              <Text role="heading" aria-level={2} style={styles.heading}>
                {s.title}
              </Text>
              {s.bullets?.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <Text style={styles.dot}>•</Text>
                  <WithContact text={b} contact={contact} style={[styles.paragraph, { flex: 1 }]} />
                </View>
              ))}
              {s.paragraphs?.map((p) => <WithContact key={p} text={p} contact={contact} style={styles.paragraph} />)}
            </View>
          ))}
        </View>
        <BlogFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 36, gap: 12 },
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lang: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  langActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  langText: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  langTextActive: { color: colors.onGold },
  title: { fontFamily: font.serif, fontSize: 30, lineHeight: 38, color: colors.text, marginTop: 6 },
  updated: { fontFamily: font.regular, fontSize: 13, color: colors.textMute, marginTop: -6 },
  section: { gap: 8, marginTop: 8 },
  heading: { fontFamily: font.semi, fontSize: 18, lineHeight: 26, color: colors.text },
  paragraph: { fontFamily: font.regular, fontSize: 15, lineHeight: 24, color: colors.textSoft },
  bulletRow: { flexDirection: 'row', gap: 8 },
  dot: { fontFamily: font.semi, fontSize: 15, lineHeight: 24, color: colors.gold },
  link: { color: colors.goldDeep, textDecorationLine: 'underline' },
});
