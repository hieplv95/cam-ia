import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { apiUrl } from '../account';
import { clusterLabel, type BlogTopic } from '../blog/clusters';
import { BLOG_LENGTHS, BLOG_TEXT_MODELS, BLOG_TONES, DEFAULT_BLOG_TEXT_MODEL, MAX_BLOG_IMAGES, type BlogLength, type BlogPost, type BlogSummary, type BlogTextModel, type BlogTone } from '../blog/types';
import { languages, type Lang } from '../i18n/languages';
import { SEO_LANGS } from '../seo';
import { colors, font } from '../theme';
import { blogAction, fetchBlogJobs, fetchBlogPost, fetchBlogPosts, type BlogJob } from './api';
import { BlogEditor, emptyDraft } from './BlogEditor';
import { TopicIdeas } from './BlogTopics';
import { blogStyles, Check, Chip, confirmAction, Field } from './blogUi';
import { dateTime, num } from './labels';
import { Failed, Loading } from './Shell';
import { Badge, Button, Card, Empty, Segmented } from './ui';
import { useLoad } from './useLoad';

const langName = (l: Lang) => languages.find((x) => x.code === l)?.name ?? l;
const IMAGE_USD = 0.067;

/** Rough cost of one article: ~2,000 tokens of instructions in, ~1.6 tokens per word out (plus the JSON around it). */
const articleUsd = (m: { usdIn: number; usdOut: number }, words: number) => (2_000 * m.usdIn + (words * 1.6 + 600) * m.usdOut) / 1_000_000;

/** Blog: write articles with AI (text + pictures signed with the Camia.app logo), list, edit, publish. */
export function BlogTab({ refresh }: { refresh: number }) {
  const { data, error, reload } = useLoad(fetchBlogPosts, []);
  const [editing, setEditing] = useState<BlogPost | 'new' | null>(null);
  const [jobsKey, setJobsKey] = useState(0);
  useEffect(() => {
    if (refresh) reload();
  }, [refresh, reload]);

  const openPost = async (id: number) => {
    const { post } = await fetchBlogPost(id);
    setEditing(post);
  };

  if (editing) {
    return (
      <BlogEditor
        post={editing === 'new' ? emptyDraft() : editing}
        onClose={() => {
          setEditing(null);
          reload();
        }}
      />
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.topRow}>
        <Text style={styles.pageTitle}>Blog</Text>
        <View style={styles.actions}>
          <Button label="Xem blog" icon="open-outline" tone="plain" onPress={() => Linking.openURL(Platform.OS === 'web' ? '/blog' : 'https://camia.app/blog')} />
          <Button label="Tự viết bài" icon="create-outline" onPress={() => setEditing('new')} />
        </View>
      </View>
      <AiWriter onQueued={() => setJobsKey((k) => k + 1)} />
      <WriteJobs refreshKey={jobsKey} onFinished={reload} onOpen={openPost} />
      {error && !data ? <Failed message={error} onRetry={reload} /> : !data ? <Loading /> : <PostList posts={data.posts} onOpen={openPost} onChanged={reload} />}
    </View>
  );
}

/* ---------- AI writer ---------- */

function AiWriter({ onQueued }: { onQueued: () => void }) {
  const [lang, setLang] = useState<Lang>('es');
  const [topic, setTopic] = useState('');
  // The remembered idea being written (marked "written" on the server); kept when the title is reworded, dropped when it is cleared.
  const [picked, setPicked] = useState<BlogTopic | null>(null);
  const [ideasKey, setIdeasKey] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [length, setLength] = useState<BlogLength>('medium');
  const [tone, setTone] = useState<BlogTone>('friendly');
  const [images, setImages] = useState(2);
  const [model, setModel] = useState<BlogTextModel>(DEFAULT_BLOG_TEXT_MODEL);
  const [extra, setExtra] = useState('');
  const [publish, setPublish] = useState(false);
  const [logo, setLogo] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const write = async () => {
    setMessage(null);
    if (topic.trim().length < 3) {
      setMessage({ text: 'Nhập chủ đề bài viết hoặc chọn một gợi ý.', ok: false });
      return;
    }
    setSending(true);
    try {
      await blogAction('write', { lang, topic, keyword, length, tone, images, extra, model, publish, logo, topicId: picked?.id, cluster: picked?.cluster });
      setMessage({ text: `Đã đưa “${topic}” vào hàng chờ. Chọn chủ đề khác để viết tiếp, hoặc đóng trang: máy chủ vẫn viết.`, ok: true });
      setTopic('');
      setKeyword('');
      setPicked(null);
      setIdeasKey((k) => k + 1);
      onQueued();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Không gửi được.', ok: false });
    } finally {
      setSending(false);
    }
  };

  const textModel = BLOG_TEXT_MODELS.find((m) => m.id === model)!;
  return (
    <Card title="✍️ Viết bài tự động bằng AI" subtitle={`Chữ: ${textModel.name} · Ảnh: AI vẽ (Gemini Flash Image)${logo ? ' + logo Camia.app' : ''}`}>
      <Field label="Ngôn ngữ bài viết">
        <View style={styles.chips}>
          {SEO_LANGS.map((l) => (
            <Chip key={l} label={langName(l)} on={l === lang} onPress={() => setLang(l)} />
          ))}
        </View>
      </Field>
      <TopicIdeas
        lang={lang}
        model={model}
        selectedId={picked?.id ?? null}
        refreshKey={ideasKey}
        onPick={(t) => {
          setPicked(t);
          setTopic(t.title);
          setKeyword(t.keyword);
          setMessage(null);
        }}
      />
      <View style={styles.grid}>
        <Field label="Chủ đề bài viết" style={{ flexBasis: 360 }}>
          <TextInput
            value={topic}
            onChangeText={(v) => {
              setTopic(v);
              if (!v.trim()) setPicked(null);
            }}
            placeholder="Nhập chủ đề hoặc chọn một gợi ý ở trên" placeholderTextColor={colors.textMute} style={blogStyles.input} />
        </Field>
        <Field label="Từ khoá chính (SEO)" style={{ flexBasis: 240 }}>
          <TextInput value={keyword} onChangeText={setKeyword} placeholder="Để trống = AI tự chọn" placeholderTextColor={colors.textMute} style={blogStyles.input} />
        </Field>
      </View>
      <View style={styles.grid}>
        <Field label="Độ dài">
          <Segmented options={(Object.keys(BLOG_LENGTHS) as BlogLength[]).map((id) => ({ id, label: BLOG_LENGTHS[id].label }))} value={length} onChange={setLength} />
        </Field>
        <Field label="Số ảnh">
          <Segmented options={Array.from({ length: MAX_BLOG_IMAGES + 1 }, (_, n) => ({ id: n, label: String(n) }))} value={images} onChange={setImages} />
        </Field>
      </View>
      <View style={styles.grid}>
        <Field label="Giọng văn">
          <Segmented options={(Object.keys(BLOG_TONES) as BlogTone[]).map((id) => ({ id, label: BLOG_TONES[id].label }))} value={tone} onChange={setTone} />
        </Field>
        <Field label="Model viết">
          <Segmented options={BLOG_TEXT_MODELS.map((m) => ({ id: m.id as BlogTextModel, label: m.name }))} value={model} onChange={setModel} />
        </Field>
      </View>
      <Field label="Yêu cầu thêm cho AI (không bắt buộc)">
        <TextInput
          value={extra}
          onChangeText={setExtra}
          placeholder="VD: viết cho chủ shop bán hàng online, thêm bảng so sánh, nhắc tới chức năng xoá nền…"
          placeholderTextColor={colors.textMute}
          multiline
          style={[blogStyles.input, styles.area]}
        />
      </Field>
      <View style={styles.writeRow}>
        <Button label={sending ? 'Đang gửi…' : 'Viết bài'} icon="sparkles-outline" onPress={write} disabled={sending} />
        <Check label="Đăng ngay, không cần duyệt" value={publish} onChange={setPublish} />
        <Check label="Gắn logo Camia.app vào ảnh" value={logo} onChange={setLogo} />
      </View>
      <Text style={styles.hint}>
        Chi phí ước tính: bài viết khoảng ${articleUsd(textModel, BLOG_LENGTHS[length].words).toFixed(2).replace('.', ',')}
        {images ? ` + ${images} ảnh × $${String(IMAGE_USD).replace('.', ',')}` : ''} (tính vào chi phí AI ở tab Tổng quan).
      </Text>
      {message ? <Text style={[styles.message, { color: message.ok ? '#2E9E6A' : colors.danger }]}>{message.text}</Text> : null}
    </Card>
  );
}

/* ---------- Articles being written ---------- */

const JOB_POLL_MS = 3_000;

/** Articles the server is writing (up to 3 at once, the rest wait), with their progress; refreshes while any is active. */
function WriteJobs({ refreshKey, onFinished, onOpen }: { refreshKey: number; onFinished: () => void; onOpen: (id: number) => void }) {
  const [jobs, setJobs] = useState<BlogJob[]>([]);
  const finished = useRef<Set<number> | null>(null);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const { jobs: list } = await fetchBlogJobs();
        if (!live) return;
        setJobs(list);
        const done = new Set(list.filter((j) => j.status === 'done' || j.status === 'error').map((j) => j.id));
        // A job just finished: the article list gets its new (or updated) article.
        if (finished.current && [...done].some((id) => !finished.current!.has(id))) onFinished();
        finished.current = done;
        if (list.some((j) => j.status === 'queued' || j.status === 'running')) timer = setTimeout(tick, JOB_POLL_MS);
      } catch {
        if (live) timer = setTimeout(tick, JOB_POLL_MS * 3);
      }
    };
    tick();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [refreshKey, onFinished]);

  if (!jobs.length) return null;
  const active = jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;
  const dismiss = async (id: number) => {
    setJobs((list) => list.filter((j) => j.id !== id));
    blogAction('dismissJob', { id }).catch(() => {});
  };
  return (
    <Card title={active ? `Đang viết (${active})` : 'Bài AI vừa viết'} subtitle="Máy chủ viết tối đa 3 bài cùng lúc; bạn có thể đóng trang, bài vẫn được viết tiếp.">
      {jobs.map((j) => (
        <View key={j.id} style={styles.job}>
          <Ionicons
            name={j.status === 'done' ? 'checkmark-circle' : j.status === 'error' ? 'alert-circle' : j.status === 'running' ? 'sync' : 'time-outline'}
            size={18}
            color={j.status === 'done' ? '#2E9E6A' : j.status === 'error' ? colors.danger : colors.goldDeep}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.postTitle} numberOfLines={1}>
              {j.topic}
            </Text>
            <Text style={[styles.postMeta, j.status === 'error' && { color: colors.danger }]}>
              {j.lang.toUpperCase()} · {j.status === 'error' ? j.error : j.step}
            </Text>
          </View>
          {j.postId && j.status === 'done' ? <IconAction icon="create-outline" label="Mở bài" onPress={() => onOpen(j.postId!)} /> : null}
          {j.status === 'done' || j.status === 'error' ? <IconAction icon="close" label="Ẩn" onPress={() => dismiss(j.id)} /> : null}
        </View>
      ))}
    </Card>
  );
}

/* ---------- Article list ---------- */

function PostList({ posts, onOpen, onChanged }: { posts: BlogSummary[]; onOpen: (id: number) => void; onChanged: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const published = posts.filter((p) => p.status === 'published').length;
  const run = async (id: number, action: string, body: Record<string, unknown>) => {
    setBusy(id);
    try {
      await blogAction(action, body);
      onChanged();
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Lỗi';
      if (Platform.OS === 'web') window.alert(text);
      else Alert.alert('Lỗi', text);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card title="Bài viết" right={<Text style={styles.count}>{`${num(posts.length)} bài · ${num(published)} đã đăng`}</Text>}>
      {!posts.length && <Empty text="Chưa có bài viết nào. Bấm “Viết bài” ở trên hoặc “Tự viết bài”." />}
      {posts.map((p) => (
        <View key={p.id} style={styles.post}>
          <Pressable onPress={() => onOpen(p.id)} style={styles.postMain}>
            {p.cover ? <Image source={{ uri: apiUrl(p.cover) }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty]} />}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.postTitle} numberOfLines={2}>
                {p.title}
              </Text>
              <View style={styles.badges}>
                <Badge text={p.status === 'published' ? 'Đã đăng' : 'Nháp'} tone={p.status === 'published' ? 'green' : 'plain'} />
                <Badge text={p.lang.toUpperCase()} tone="blue" />
                {p.ai && <Badge text="AI" tone="gold" />}
                {p.cluster ? <Badge text={clusterLabel(p.cluster)} tone="plain" /> : null}
                <Text style={styles.postMeta}>
                  {dateTime(p.publishedAt ?? p.createdAt)} · {p.minutes} phút đọc
                </Text>
              </View>
            </View>
          </Pressable>
          <View style={styles.postActions}>
            {p.status === 'published' && (
              <IconAction icon="open-outline" label="Xem" onPress={() => Linking.openURL(Platform.OS === 'web' ? `/blog/${p.slug}` : `https://camia.app/blog/${p.slug}`)} />
            )}
            <IconAction icon="create-outline" label="Sửa" onPress={() => onOpen(p.id)} />
            <IconAction
              icon={p.status === 'published' ? 'eye-off-outline' : 'paper-plane-outline'}
              label={p.status === 'published' ? 'Ẩn' : 'Đăng'}
              disabled={busy === p.id}
              onPress={() => run(p.id, 'status', { id: p.id, status: p.status === 'published' ? 'draft' : 'published' })}
            />
            <IconAction
              icon="trash-outline"
              label="Xoá"
              danger
              disabled={busy === p.id}
              onPress={async () => {
                if (await confirmAction(`Xoá bài “${p.title}”? Không khôi phục được.`)) run(p.id, 'delete', { id: p.id });
              }}
            />
          </View>
        </View>
      ))}
    </Card>
  );
}

/* ---------- Small pieces ---------- */

function IconAction({ icon, label, onPress, danger, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const c = danger ? colors.danger : colors.text;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.iconAction, (pressed || disabled) && { opacity: 0.5 }]}>
      <Ionicons name={icon} size={16} color={c} />
      <Text style={[styles.iconActionText, { color: c }]}>{label}</Text>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  pageTitle: { fontFamily: font.bold, fontSize: 22, color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  area: { minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  writeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  step: { fontFamily: font.semi, fontSize: 13.5, color: colors.goldDeep },
  message: { fontFamily: font.medium, fontSize: 13.5 },
  count: { fontFamily: font.regular, fontSize: 12.5, color: colors.textSoft },
  post: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  postMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flexGrow: 1, flexBasis: 320, minWidth: 0 },
  thumb: { width: 88, height: 50, borderRadius: 8, backgroundColor: colors.surface2 },
  thumbEmpty: { borderWidth: 1, borderColor: colors.border },
  postTitle: { fontFamily: font.semi, fontSize: 14, color: colors.text },
  badges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  postMeta: { fontFamily: font.regular, fontSize: 12, color: colors.textMute },
  postActions: { flexDirection: 'row', gap: 4 },
  job: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  iconActionText: { fontFamily: font.medium, fontSize: 12.5 },
});

