import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { apiUrl } from '../account';
import { BLOG_CLUSTERS } from '../blog/clusters';
import { Markdown } from '../blog/Markdown';
import { blogImageUrl, type BlogDraft, type BlogPost, type BlogStatus } from '../blog/types';
import { loadPhotoPair } from '../editor/imageOps';
import { languages, type Lang } from '../i18n/languages';
import { SEO_GOOD, SEO_LANGS } from '../seo';
import { signedJpegOf, useSignature } from '../signature';
import { colors, font } from '../theme';
import { blogAction } from './api';
import { blogStyles, Check, Chip, confirmAction, Field } from './blogUi';
import { Button, Card, Segmented } from './ui';

const langName = (l: Lang) => languages.find((x) => x.code === l)?.name ?? l;

/** The site address for full picture links (this page's origin on the web, the public site in the app). */
const siteOrigin = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://camia.app');

export const emptyDraft = (): BlogDraft => ({ lang: 'es', title: '', description: '', keywords: '', content: '', cover: '', status: 'draft', cluster: '' });

/** Picture name from a cover URL ("/api/blog/image/ab12….jpg" → "ab12….jpg"). */
const coverName = (cover: string) => cover.split('/').pop() ?? '';

/** Writing or editing one article by hand (Markdown), with pictures and a preview. */
export function BlogEditor({ post, onClose }: { post: BlogPost | BlogDraft; onClose: () => void }) {
  const signature = useSignature();
  const initial: BlogDraft = { id: post.id, slug: post.slug ?? '', lang: post.lang, title: post.title, description: post.description, keywords: post.keywords, content: post.content, cover: coverName(post.cover), status: post.status, cluster: post.cluster ?? '' };
  const [draft, setDraft] = useState<BlogDraft>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [selection, setSelection] = useState({ start: post.content.length, end: post.content.length });
  const [logo, setLogo] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const changed = JSON.stringify(draft) !== saved;
  const set = (patch: Partial<BlogDraft>) => {
    setMessage(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  /** Picks a photo, resizes it (and signs it), uploads it; returns its name and URL. */
  const uploadPicked = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.95 });
    if (res.canceled || !res.assets?.[0]) return null;
    setBusy('Đang xử lý và tải ảnh lên…');
    try {
      const { image } = await loadPhotoPair(res.assets[0].uri);
      const jpeg = await signedJpegOf(image, logo ? signature : null);
      return await blogAction<{ name: string; url: string }>('upload', { data: jpeg });
    } finally {
      setBusy(null);
    }
  };

  /** Puts a picture (Markdown) where the cursor was in the content, or at the end, on its own lines. */
  const insertPicture = (url: string, patch: Partial<BlogDraft> = {}) => {
    const text = draft.content;
    const at = Math.min(selection.end, text.length);
    const before = text.slice(0, at).replace(/\s*$/, '');
    const after = text.slice(at).replace(/^\s*/, '');
    const md = `![${draft.title || 'CamIA'}](${url})`;
    set({ content: `${before}${before ? '\n\n' : ''}${md}\n\n${after}`.trimEnd() + '\n', ...patch });
    // Right after it, so a second picture goes below the first.
    const end = `${before}${before ? '\n\n' : ''}${md}\n\n`.length;
    setSelection({ start: end, end });
    setMode('write');
  };

  const copyLink = async (url: string) => {
    await Clipboard.setStringAsync(url);
    setMessage({ text: 'Đã chép link ảnh. Dán vào bài theo dạng ![mô tả](link), hoặc bấm “Chèn vào bài”.', ok: true });
  };

  const insertImage = async () => {
    try {
      const up = await uploadPicked();
      if (!up) return;
      insertPicture(up.url, { cover: draft.cover || up.name });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Không tải được ảnh.', ok: false });
    }
  };

  const changeCover = async () => {
    try {
      const up = await uploadPicked();
      if (up) set({ cover: up.name });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Không tải được ảnh.', ok: false });
    }
  };

  const firstPicture = draft.content.match(/!\[[^\]]*\]\(\/api\/blog\/image\/([a-f0-9]{24}\.jpg)\)/)?.[1];

  const save = async (status?: BlogStatus) => {
    setMessage(null);
    setBusy('Đang lưu…');
    try {
      const next = { ...draft, ...(status && { status }) };
      const r = await blogAction<{ post: BlogPost }>('save', { post: next });
      const savedDraft: BlogDraft = { id: r.post.id, slug: r.post.slug, lang: r.post.lang, title: r.post.title, description: r.post.description, keywords: r.post.keywords, content: r.post.content, cover: coverName(r.post.cover), status: r.post.status, cluster: r.post.cluster };
      setDraft(savedDraft);
      setSaved(JSON.stringify(savedDraft));
      setMessage({ text: r.post.status === 'published' ? `Đã lưu và đăng: camia.app/blog/${r.post.slug}` : 'Đã lưu bản nháp.', ok: true });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Không lưu được.', ok: false });
    } finally {
      setBusy(null);
    }
  };

  const close = async () => {
    if (!changed || (await confirmAction('Bỏ các thay đổi chưa lưu?'))) onClose();
  };

  const count = (n: number, good: readonly [number, number]) => (
    <Text style={{ color: n >= good[0] && n <= good[1] ? '#2E9E6A' : '#C77C1E', fontFamily: font.semi }}>{n} ký tự</Text>
  );

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.topRow}>
        <Button label="Quay lại danh sách" icon="chevron-back" tone="plain" onPress={close} />
        <View style={styles.row}>
          <Button label="Lưu nháp" icon="save-outline" tone="plain" onPress={() => save('draft')} disabled={!!busy} />
          <Button label={draft.status === 'published' ? 'Lưu (đang đăng)' : 'Lưu và đăng'} icon="paper-plane-outline" onPress={() => save('published')} disabled={!!busy} />
        </View>
      </View>
      {busy ? <Text style={styles.step}>⏳ {busy}</Text> : null}
      {message ? <Text style={[styles.message, { color: message.ok ? '#2E9E6A' : colors.danger }]}>{message.text}</Text> : null}

      <Card title={draft.id ? `Sửa bài #${draft.id}` : 'Bài viết mới'} subtitle={draft.status === 'published' ? 'Đang hiển thị trên website' : 'Bản nháp: chưa ai thấy'}>
        <Field label="Ngôn ngữ">
          <View style={styles.chips}>
            {SEO_LANGS.map((l) => (
              <Chip key={l} label={langName(l)} on={l === draft.lang} onPress={() => set({ lang: l })} />
            ))}
          </View>
        </Field>
        <Field label="Tiêu đề">
          <TextInput value={draft.title} onChangeText={(title) => set({ title })} maxLength={120} style={blogStyles.input} placeholder="Tiêu đề bài viết (có từ khoá chính)" placeholderTextColor={colors.textMute} />
          <Text style={styles.hint}>
            {count(draft.title.length, SEO_GOOD.title)} · nên 30–60 để Google không cắt
          </Text>
        </Field>
        <Field label="Đường dẫn">
          <View style={styles.row}>
            <Text style={styles.prefix}>camia.app/blog/</Text>
            <TextInput value={draft.slug ?? ''} onChangeText={(slug) => set({ slug })} autoCapitalize="none" style={[blogStyles.input, { flex: 1, minWidth: 180 }]} placeholder="tự tạo từ tiêu đề" placeholderTextColor={colors.textMute} />
          </View>
        </Field>
        <Field label="Mô tả (hiện trên Google và khi chia sẻ link)">
          <TextInput value={draft.description} onChangeText={(description) => set({ description })} maxLength={300} multiline style={[blogStyles.input, styles.areaSmall]} />
          <Text style={styles.hint}>{count(draft.description.length, SEO_GOOD.description)} · nên 120–160</Text>
        </Field>
        <Field label="Nhóm từ khoá (cho bảng độ phủ chủ đề)">
          <View style={styles.chips}>
            <Chip label="Chưa phân nhóm" on={!draft.cluster} onPress={() => set({ cluster: '' })} />
            {BLOG_CLUSTERS.map((c) => (
              <Chip key={c.id} label={c.label} on={draft.cluster === c.id} onPress={() => set({ cluster: c.id })} />
            ))}
          </View>
        </Field>
        <Field label="Từ khoá (cách nhau bằng dấu phẩy)">
          <TextInput value={draft.keywords} onChangeText={(keywords) => set({ keywords })} maxLength={400} style={blogStyles.input} />
        </Field>
        <Field label="Ảnh bìa">
          <View style={styles.row}>
            {draft.cover ? <Image source={{ uri: apiUrl(blogImageUrl(draft.cover)) }} style={styles.cover} /> : <Text style={styles.hint}>Chưa có ảnh bìa.</Text>}
            <Button label="Tải ảnh lên" icon="image-outline" tone="plain" onPress={changeCover} disabled={!!busy} />
            {firstPicture && firstPicture !== draft.cover && <Button label="Dùng ảnh đầu tiên trong bài" icon="copy-outline" tone="plain" onPress={() => set({ cover: firstPicture })} />}
            {draft.cover ? <Button label="Bỏ ảnh bìa" icon="close" tone="plain" onPress={() => set({ cover: '' })} /> : null}
          </View>
          {draft.cover ? (
            <View style={styles.linkBox}>
              <TextInput value={`${siteOrigin()}${blogImageUrl(draft.cover)}`} editable={false} selectTextOnFocus style={[blogStyles.input, styles.link]} />
              <Button label="Sao chép link" icon="copy-outline" tone="plain" onPress={() => copyLink(`${siteOrigin()}${blogImageUrl(draft.cover)}`)} />
              <Button label="Chèn vào bài" icon="add-circle-outline" onPress={() => insertPicture(blogImageUrl(draft.cover))} />
            </View>
          ) : null}
          {draft.cover ? <Text style={styles.hint}>“Chèn vào bài” đặt ảnh ở chỗ con trỏ trong ô Nội dung (chưa bấm vào ô đó thì ảnh nằm cuối bài).</Text> : null}
        </Field>
      </Card>

      <Card
        title="Nội dung"
        subtitle="Markdown: ## Tiêu đề mục, ### Mục nhỏ, **đậm**, *nghiêng*, - danh sách, [chữ](link), ![mô tả](ảnh)"
        right={<Segmented options={[{ id: 'write', label: 'Soạn' }, { id: 'preview', label: 'Xem trước' }]} value={mode} onChange={setMode} />}
      >
        {mode === 'write' ? (
          <>
            <View style={styles.row}>
              <Button label="Chèn ảnh" icon="image-outline" tone="plain" onPress={insertImage} disabled={!!busy} />
              <Check label="Gắn logo Camia.app vào ảnh tải lên" value={logo} onChange={setLogo} />
            </View>
            <TextInput
              value={draft.content}
              onChangeText={(content) => set({ content })}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              multiline
              style={[blogStyles.input, styles.content]}
              placeholder={'Đoạn mở đầu…\n\n## Mục 1\nNội dung…'}
              placeholderTextColor={colors.textMute}
            />
          </>
        ) : (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>{draft.title || 'Tiêu đề'}</Text>
            <Markdown content={draft.content || '_Chưa có nội dung._'} />
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  prefix: { fontFamily: font.medium, fontSize: 13.5, color: colors.textSoft },
  areaSmall: { minHeight: 64, textAlignVertical: 'top' },
  content: { minHeight: 460, textAlignVertical: 'top', fontFamily: Platform.select({ web: 'ui-monospace, Menlo, Consolas, monospace', default: undefined }), fontSize: 13.5, lineHeight: 21 },
  cover: { width: 160, height: 90, borderRadius: 10, backgroundColor: colors.surface2 },
  linkBox: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  link: { flex: 1, minWidth: 260, fontSize: 13, color: colors.textSoft },
  step: { fontFamily: font.semi, fontSize: 13.5, color: colors.goldDeep },
  message: { fontFamily: font.medium, fontSize: 13.5 },
  preview: { gap: 16, maxWidth: 760 },
  previewTitle: { fontFamily: font.serif, fontSize: 28, lineHeight: 36, color: colors.text },
});
