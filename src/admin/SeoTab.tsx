import { useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { languages, type Lang } from '../i18n/languages';
import { DEFAULT_SEO, SEO_GOOD, SEO_LANGS, SEO_LIMITS, type SeoSettings, type SeoText } from '../seo';
import { colors, font } from '../theme';
import { fetchSeo, saveSeo } from './api';
import { Failed, Loading } from './Shell';
import { Button, Card, Grid } from './ui';
import { useLoad } from './useLoad';

const langName = (l: Lang) => languages.find((x) => x.code === l)?.name ?? l;

/** The address shown in the Google preview and the robots/sitemap links. */
const siteHost = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.host : 'camia.app');
const siteOrigin = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://camia.app');

/** Chinese, Japanese and Korean characters are about twice as wide: Google fits half as many. */
const WIDE: Lang[] = ['zh', 'ja', 'ko'];
const goodFor = (l: Lang, r: readonly [number, number]) => (WIDE.includes(l) ? ([Math.round(r[0] / 2), Math.round(r[1] / 2)] as const) : r);

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Website search texts per language (title, description, keywords), Google Search Console code, main language. */
export function SeoTab({ refresh }: { refresh: number }) {
  const { data, error, reload, setData } = useLoad(fetchSeo, []);
  const [draft, setDraft] = useState<SeoSettings | null>(null);
  const [lang, setLang] = useState<Lang>('es');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (refresh) reload();
  }, [refresh, reload]);
  useEffect(() => {
    if (data) setDraft(data.seo);
  }, [data]);

  if (error && !data) return <Failed message={error} onRetry={reload} />;
  if (!data || !draft) return <Loading />;

  const saved = data.seo;
  const text = draft.texts[lang];
  const changedLangs = SEO_LANGS.filter((l) => JSON.stringify(draft.texts[l]) !== JSON.stringify(saved.texts[l]));
  const changed = changedLangs.length > 0 || draft.primary !== saved.primary || draft.verification !== saved.verification;

  const edit = (patch: Partial<SeoText>) => {
    setMessage(null);
    setDraft({ ...draft, texts: { ...draft.texts, [lang]: { ...text, ...patch } } });
  };
  const save = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const texts = Object.fromEntries(changedLangs.map((l) => [l, draft.texts[l]])) as SeoSettings['texts'];
      setData(await saveSeo({ primary: draft.primary, verification: draft.verification, texts }));
      setMessage({ text: 'Đã lưu. Website cập nhật trong khoảng 30 giây; Google cần vài ngày đến vài tuần để hiện kết quả mới.', ok: true });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Không lưu được.', ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.langs}>
        {SEO_LANGS.map((l) => {
          const on = l === lang;
          const dirty = changedLangs.includes(l);
          return (
            <Pressable key={l} onPress={() => setLang(l)} style={[styles.lang, on && styles.langOn]}>
              <Text style={[styles.langText, on && styles.langTextOn]}>
                {l === draft.primary ? '★ ' : ''}
                {langName(l)}
                {dirty ? ' •' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Grid min={360}>
        <Card title={`Cài đặt SEO · ${langName(lang)}`} subtitle={lang === draft.primary ? 'Ngôn ngữ chính: Google, Facebook, WhatsApp đọc bản này.' : 'Người mở web bằng trình duyệt ngôn ngữ này sẽ thấy bản này.'}>
          <Field label="Tiêu đề trang (title)" count={text.title.length} good={goodFor(lang, SEO_GOOD.title)} max={SEO_LIMITS.title} hint={`nên từ ${goodFor(lang, SEO_GOOD.title).join('–')} để Google không cắt`}>
            <TextInput value={text.title} onChangeText={(title) => edit({ title })} maxLength={SEO_LIMITS.title} style={styles.input} />
          </Field>
          <Field label="Mô tả (meta description)" count={text.description.length} good={goodFor(lang, SEO_GOOD.description)} max={SEO_LIMITS.description} hint={`nên từ ${goodFor(lang, SEO_GOOD.description).join('–')}`}>
            <TextInput value={text.description} onChangeText={(description) => edit({ description })} maxLength={SEO_LIMITS.description} multiline style={[styles.input, styles.area]} />
          </Field>
          <Field label="Từ khoá (meta keywords)" hint="Cách nhau bằng dấu phẩy. Google gần như không dùng thẻ này, nhưng một số công cụ khác có đọc.">
            <TextInput value={text.keywords} onChangeText={(keywords) => edit({ keywords })} maxLength={SEO_LIMITS.keywords} multiline style={[styles.input, styles.areaSmall]} />
          </Field>
          <Field label="Mã xác minh Google Search Console" hint="Lấy trong Search Console → Thêm tài sản → Thẻ HTML. Dán mã hoặc cả thẻ. Dùng chung cho mọi ngôn ngữ.">
            <TextInput
              value={draft.verification}
              onChangeText={(verification) => {
                setMessage(null);
                setDraft({ ...draft, verification });
              }}
              placeholder={'Dán mã hoặc cả thẻ <meta name="google-site-verification" …>'}
              placeholderTextColor={colors.textMute}
              autoCapitalize="none"
              style={styles.input}
            />
          </Field>
          <View style={styles.actions}>
            <Button label={busy ? 'Đang lưu…' : 'Lưu thay đổi'} icon="save-outline" onPress={save} disabled={busy || !changed} />
            <Button label="Khôi phục mặc định" icon="refresh-outline" tone="plain" onPress={() => edit(DEFAULT_SEO.texts[lang])} />
            {lang !== draft.primary && (
              <Button
                label="Đặt làm ngôn ngữ chính"
                icon="star-outline"
                tone="plain"
                onPress={() => {
                  setMessage(null);
                  setDraft({ ...draft, primary: lang });
                }}
              />
            )}
          </View>
          {message ? <Text style={[styles.message, { color: message.ok ? '#2E9E6A' : colors.danger }]}>{message.text}</Text> : null}
        </Card>

        <View style={{ gap: 16 }}>
          <Card title="Xem trước trên Google">
            <View style={styles.google}>
              <Text style={styles.gSite}>{siteHost()} ›</Text>
              <Text style={styles.gTitle}>{cut(text.title || '—', 62)}</Text>
              <Text style={styles.gDesc}>{cut(text.description || '—', 160)}</Text>
            </View>
            <Text style={styles.note}>Google có thể tự viết lại tiêu đề/mô tả. Sau khi đổi, thường mất vài ngày tới vài tuần để kết quả tìm kiếm cập nhật.</Text>
          </Card>
          <Card title="Xem trước khi chia sẻ link" subtitle="Facebook, WhatsApp, Messenger (ngôn ngữ chính)">
            <View style={styles.share}>
              <Image source={{ uri: `${siteOrigin()}/og-image.png` }} style={styles.shareImage} resizeMode="cover" accessibilityLabel="og-image.png" />
              <View style={styles.shareBody}>
                <Text style={styles.shareSite}>{siteHost().toUpperCase()}</Text>
                <Text style={styles.shareTitle} numberOfLines={2}>
                  {draft.texts[draft.primary].title}
                </Text>
                <Text style={styles.shareDesc} numberOfLines={2}>
                  {draft.texts[draft.primary].description}
                </Text>
              </View>
            </View>
          </Card>
          <Card title="Cho Google biết website">
            <Text style={styles.note}>
              1. Search Console → Thêm tài sản → Tiền tố URL {siteOrigin()} → chọn Thẻ HTML → dán mã vào ô bên trái → Lưu → bấm Xác minh.{'\n'}
              2. Trong Search Console → Sơ đồ trang web → gửi sitemap.xml.{'\n'}
              Google chỉ liệt kê Trang chủ, AI và Presets; trang quản trị và các trang cần ảnh được đánh dấu không lập chỉ mục.
            </Text>
            <View style={styles.actions}>
              <Button label="robots.txt" icon="open-outline" tone="plain" onPress={() => Linking.openURL(`${siteOrigin()}/robots.txt`)} />
              <Button label="sitemap.xml" icon="open-outline" tone="plain" onPress={() => Linking.openURL(`${siteOrigin()}/sitemap.xml`)} />
            </View>
            <Text style={styles.note}>Các thẻ SEO, robots.txt và sitemap.xml chỉ có trên máy chủ thật (camia.app), không có khi chạy thử bằng expo start.</Text>
          </Card>
        </View>
      </Grid>
    </View>
  );
}

function Field({ label, hint, count, good, max, children }: { label: string; hint: string; count?: number; good?: readonly [number, number]; max?: number; children: React.ReactNode }) {
  const ok = count === undefined || !good || (count >= good[0] && count <= good[1]);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      <Text style={styles.hint}>
        {count !== undefined ? (
          <Text style={{ color: ok ? '#2E9E6A' : '#C77C1E', fontFamily: font.semi }}>
            {count}
            {max ? `/${max}` : ''} ký tự
          </Text>
        ) : null}
        {count !== undefined ? ' · ' : ''}
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 6, borderRadius: 14, backgroundColor: colors.surface2, alignSelf: 'flex-start' },
  lang: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  langOn: { backgroundColor: colors.surface },
  langText: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  langTextOn: { fontFamily: font.bold, color: colors.text },
  field: { gap: 6 },
  label: { fontFamily: font.semi, fontSize: 13, color: colors.text },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text,
  },
  area: { minHeight: 96, textAlignVertical: 'top' },
  areaSmall: { minHeight: 64, textAlignVertical: 'top' },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft, lineHeight: 17 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  message: { fontFamily: font.medium, fontSize: 13 },
  google: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, gap: 3, borderWidth: 1, borderColor: colors.border },
  gSite: { fontSize: 12.5, color: '#4D5156', fontFamily: Platform.OS === 'web' ? 'Arial, sans-serif' : undefined },
  gTitle: { fontSize: 19, color: '#1A0DAB', fontFamily: Platform.OS === 'web' ? 'Arial, sans-serif' : undefined },
  gDesc: { fontSize: 13.5, lineHeight: 20, color: '#4D5156', fontFamily: Platform.OS === 'web' ? 'Arial, sans-serif' : undefined },
  note: { fontFamily: font.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSoft },
  share: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#F0F2F5' },
  shareImage: { width: '100%', aspectRatio: 1200 / 630, backgroundColor: colors.bg },
  shareBody: { padding: 12, gap: 2 },
  shareSite: { fontSize: 11.5, color: '#65676B' },
  shareTitle: { fontSize: 15, fontWeight: '600', color: '#050505' },
  shareDesc: { fontSize: 13, color: '#65676B' },
});
