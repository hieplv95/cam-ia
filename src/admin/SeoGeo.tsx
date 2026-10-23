import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { languages, type Lang } from '../i18n/languages';
import { AI_SEARCH_BOTS, AI_TRAINING_BOTS, DEFAULT_GEO, GEO_LIMITS, SEO_GOOD, SOCIAL_KEYS, type GeoSettings, type SeoSettings } from '../seo';
import { colors, font } from '../theme';
import { blogStyles, Check } from './blogUi';
import { Button, Card } from './ui';

const langName = (l: Lang) => languages.find((x) => x.code === l)?.name ?? l;
const siteOrigin = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://camia.app');
const SOCIAL_LABEL: Record<(typeof SOCIAL_KEYS)[number], string> = { facebook: 'Facebook', instagram: 'Instagram', x: 'X (Twitter)', youtube: 'YouTube', tiktok: 'TikTok' };

/**
 * GEO on the SEO tab: what AI assistants (ChatGPT, Gemini, Perplexity, Claude) learn about CamIA — the "about" text
 * and FAQ per language, official profiles, and whether AI companies may train on the site.
 */
export function GeoCard({ lang, geo, onChange }: { lang: Lang; geo: GeoSettings; onChange: (geo: GeoSettings) => void }) {
  const about = geo.about[lang] ?? '';
  const faq = geo.faq[lang] ?? [];
  const setFaq = (list: typeof faq) => onChange({ ...geo, faq: { ...geo.faq, [lang]: list } });
  const sample = DEFAULT_GEO.faq[lang];

  return (
    <Card
      title={`GEO · được AI trích dẫn · ${langName(lang)}`}
      subtitle="ChatGPT, Gemini, Perplexity, Claude đọc phần này để trả lời người hỏi về chỉnh ảnh. Viết đúng sự thật, ngắn gọn, đúng cách người bản xứ hỏi."
    >
      <View style={styles.field}>
        <Text style={styles.label}>Giới thiệu CamIA cho AI</Text>
        <TextInput
          value={about}
          onChangeText={(text) => onChange({ ...geo, about: { ...geo.about, [lang]: text } })}
          maxLength={GEO_LIMITS.about}
          multiline
          placeholder="CamIA es un editor de fotos con IA… (là gì, làm được gì, giá, nền tảng)"
          placeholderTextColor={colors.textMute}
          style={[blogStyles.input, styles.area]}
        />
        <Text style={styles.hint}>
          <Text style={{ color: about.length >= 200 ? '#2E9E6A' : '#C77C1E', fontFamily: font.semi }}>{about.length}/{GEO_LIMITS.about} ký tự</Text> · nên 300–800. AI hay trích nguyên câu: mỗi câu nói một sự thật (chức năng, miễn phí, nền tảng, ngôn ngữ).
        </Text>
      </View>

      <View style={styles.field}>
        <View style={styles.row}>
          <Text style={[styles.label, { flex: 1 }]}>Câu hỏi thường gặp ({faq.length}/{GEO_LIMITS.faqItems})</Text>
          {!faq.length && sample?.length ? <Button label="Dùng câu hỏi mẫu" icon="copy-outline" tone="plain" onPress={() => setFaq(sample)} /> : null}
          <Button
            label="Thêm câu hỏi"
            icon="add"
            tone="plain"
            disabled={faq.length >= GEO_LIMITS.faqItems}
            onPress={() => setFaq([...faq, { q: '', a: '' }])}
          />
        </View>
        <Text style={styles.hint}>Đặt câu hỏi đúng như khách gõ hỏi AI (“¿CamIA es gratis?”, “¿Cómo quito el fondo de una foto?”). Hiện ở trang chủ cho Google và trong llms.txt.</Text>
        {faq.map((item, i) => (
          <View key={i} style={styles.faq}>
            <View style={styles.row}>
              <TextInput
                value={item.q}
                onChangeText={(q) => setFaq(faq.map((x, j) => (j === i ? { ...x, q } : x)))}
                maxLength={GEO_LIMITS.question}
                placeholder="Câu hỏi"
                placeholderTextColor={colors.textMute}
                style={[blogStyles.input, { flex: 1, fontFamily: font.semi }]}
              />
              <Pressable onPress={() => setFaq(faq.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Xoá câu hỏi">
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
            <TextInput
              value={item.a}
              onChangeText={(a) => setFaq(faq.map((x, j) => (j === i ? { ...x, a } : x)))}
              maxLength={GEO_LIMITS.answer}
              multiline
              placeholder="Câu trả lời ngắn, đúng sự thật"
              placeholderTextColor={colors.textMute}
              style={[blogStyles.input, styles.answer]}
            />
          </View>
        ))}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Trang chính thức trên mạng xã hội (dùng chung mọi ngôn ngữ)</Text>
        <Text style={styles.hint}>Google và AI dùng để biết đây đúng là CamIA; các link này cũng hiện thành nút ở trang chủ bản web. Để trống nếu chưa có.</Text>
        {SOCIAL_KEYS.map((k) => (
          <View key={k} style={styles.row}>
            <Text style={styles.socialLabel}>{SOCIAL_LABEL[k]}</Text>
            <TextInput
              value={geo.social[k]}
              onChangeText={(url) => onChange({ ...geo, social: { ...geo.social, [k]: url.trim() } })}
              autoCapitalize="none"
              placeholder={`https://www.${k}.com/camia.app`}
              placeholderTextColor={colors.textMute}
              style={[blogStyles.input, { flex: 1 }]}
            />
          </View>
        ))}
      </View>

      <View style={styles.field}>
        <Check label="Cho phép AI dùng nội dung website để huấn luyện" value={geo.allowTraining} onChange={(allowTraining) => onChange({ ...geo, allowTraining })} />
        <Text style={styles.hint}>
          Bot AI trả lời câu hỏi và trích nguồn ({AI_SEARCH_BOTS.slice(0, 4).join(', ')}…) luôn được phép đọc. Ô này chỉ áp dụng cho bot huấn luyện ({AI_TRAINING_BOTS.slice(0, 4).join(', ')}…). Bật thì CamIA dễ được AI “biết tới” hơn.
        </Text>
      </View>

      <Text style={styles.note}>
        Website gửi kèm bản chữ của trang chủ, blog và từng bài viết cho các bot không chạy JavaScript (phần lớn bot AI), cùng dữ liệu cấu trúc (Organization, WebApplication, FAQ) và llms.txt.
      </Text>
      <View style={styles.row}>
        <Button label="llms.txt" icon="open-outline" tone="plain" onPress={() => Linking.openURL(`${siteOrigin()}/llms.txt`)} />
        <Button label="robots.txt" icon="open-outline" tone="plain" onPress={() => Linking.openURL(`${siteOrigin()}/robots.txt`)} />
      </View>
    </Card>
  );
}

type ScoreItem = { label: string; ok: boolean; tip: string; group: 'SEO' | 'GEO' };

/** A quick SEO + GEO checklist with a score, from the settings being edited and the number of published articles. */
export function SeoScore({ seo, publishedPosts }: { seo: SeoSettings; publishedPosts: number | null }) {
  const p = seo.primary;
  const t = seo.texts[p];
  const about = seo.geo.about[p] ?? '';
  const faq = seo.geo.faq[p] ?? [];
  const checks: ScoreItem[] = [
    { group: 'SEO', label: `Tiêu đề ${langName(p)} dài ${SEO_GOOD.title[0]}–${SEO_GOOD.title[1]} ký tự`, ok: t.title.length >= SEO_GOOD.title[0] && t.title.length <= SEO_GOOD.title[1], tip: 'Sửa ô Tiêu đề trang ở trên.' },
    { group: 'SEO', label: `Mô tả dài ${SEO_GOOD.description[0]}–${SEO_GOOD.description[1]} ký tự`, ok: t.description.length >= SEO_GOOD.description[0] && t.description.length <= SEO_GOOD.description[1], tip: 'Sửa ô Mô tả ở trên.' },
    { group: 'SEO', label: 'Tiêu đề có tên CamIA', ok: /camia/i.test(t.title), tip: 'Thêm “CamIA” vào tiêu đề để người tìm thương hiệu thấy đúng trang.' },
    { group: 'SEO', label: 'Đã xác minh Google Search Console', ok: !!seo.verification, tip: 'Dán mã xác minh ở ô bên trên, rồi gửi sitemap.xml trong Search Console.' },
    { group: 'SEO', label: 'Có ít nhất 5 bài blog đã đăng', ok: (publishedPosts ?? 0) >= 5, tip: 'Viết thêm bài ở tab Blog (mỗi bài một từ khoá).' },
    { group: 'SEO', label: 'Có ít nhất 20 bài blog đã đăng', ok: (publishedPosts ?? 0) >= 20, tip: 'Đều đặn 2–3 bài mỗi tuần, phủ hết các nhóm chủ đề.' },
    { group: 'GEO', label: `Có giới thiệu CamIA cho AI (${langName(p)}, từ 200 ký tự)`, ok: about.length >= 200, tip: 'Viết vài câu sự thật về CamIA ở khu GEO.' },
    { group: 'GEO', label: 'Có ít nhất 4 câu hỏi thường gặp', ok: faq.filter((f) => f.q && f.a).length >= 4, tip: 'Thêm câu hỏi đúng như khách hỏi AI.' },
    { group: 'GEO', label: 'Có câu hỏi thường gặp cho Português và English', ok: (seo.geo.faq.pt?.length ?? 0) > 0 && (seo.geo.faq.en?.length ?? 0) > 0, tip: 'Chọn tab Português / English ở trên rồi thêm câu hỏi.' },
    { group: 'GEO', label: 'Có link trang mạng xã hội chính thức', ok: Object.values(seo.geo.social).some(Boolean), tip: 'Thêm link Facebook, Instagram, X, YouTube hoặc TikTok (cũng hiện ở trang chủ bản web).' },
    { group: 'GEO', label: 'Cho phép AI huấn luyện trên website', ok: seo.geo.allowTraining, tip: 'Bật để CamIA dễ được nhắc tới trong câu trả lời của AI.' },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const color = score >= 80 ? '#2E9E6A' : score >= 50 ? '#C77C1E' : colors.danger;
  return (
    <Card title="Điểm SEO & GEO" subtitle={`Theo ngôn ngữ chính (${langName(p)}). Chưa lưu thì điểm tính theo bản đang sửa.`}>
      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color }]}>{score}</Text>
        <Text style={styles.scoreOf}>/100 · đạt {passed}/{checks.length} mục</Text>
      </View>
      {(['SEO', 'GEO'] as const).map((g) => (
        <View key={g} style={{ gap: 6 }}>
          <Text style={styles.group}>{g}</Text>
          {checks
            .filter((c) => c.group === g)
            .map((c) => (
              <View key={c.label} style={styles.check}>
                <Ionicons name={c.ok ? 'checkmark-circle' : 'ellipse-outline'} size={17} color={c.ok ? '#2E9E6A' : colors.textMute} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.checkLabel, !c.ok && { color: colors.text }]}>{c.label}</Text>
                  {!c.ok && <Text style={styles.hint}>{c.tip}</Text>}
                </View>
              </View>
            ))}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: font.semi, fontSize: 13, color: colors.text },
  hint: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: colors.textSoft },
  note: { fontFamily: font.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSoft },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  area: { minHeight: 130, textAlignVertical: 'top' },
  answer: { minHeight: 64, textAlignVertical: 'top' },
  faq: { gap: 6, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  socialLabel: { width: 80, fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  score: { fontFamily: font.bold, fontSize: 40 },
  scoreOf: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  group: { fontFamily: font.bold, fontSize: 12, letterSpacing: 1, color: colors.goldDeep, marginTop: 6 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  checkLabel: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
});
