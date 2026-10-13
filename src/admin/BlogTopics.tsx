import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BLOG_CLUSTERS, clusterLabel, DIFFICULTY_LABEL, PRIORITY_LABEL, TOPIC_COUNTS, type BlogTopic, type ClusterCoverage } from '../blog/clusters';
import type { BlogTextModel } from '../blog/types';
import type { Lang } from '../i18n/languages';
import { colors, font } from '../theme';
import { blogAction, fetchBlogTopics } from './api';
import { blogStyles, Chip, Field } from './blogUi';
import { num } from './labels';
import { Badge, Button, Card, Empty, Segmented, type Tone } from './ui';

const DIFFICULTY_TONE: Record<string, Tone> = { low: 'green', medium: 'gold', high: 'red' };

/**
 * Topic ideas for the AI writer: pick a direction (a keyword group or a mix), ask for 5/10/15 ideas, then choose
 * one or skip it. Ideas are remembered on the server, so asking again never brings the same ones back.
 */
export function TopicIdeas({
  lang,
  model,
  selectedId,
  refreshKey,
  onPick,
}: {
  lang: Lang;
  model: BlogTextModel;
  selectedId: number | null;
  refreshKey: number;
  onPick: (topic: BlogTopic) => void;
}) {
  const [direction, setDirection] = useState<string>('random');
  const [count, setCount] = useState<number>(10);
  const [extra, setExtra] = useState('');
  const [pending, setPending] = useState<BlogTopic[]>([]);
  const [cover, setCover] = useState<ClusterCoverage[]>([]);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    fetchBlogTopics(lang)
      .then((r) => {
        setPending(r.topics);
        setCover(r.coverage);
      })
      .catch(() => {});
  }, [lang]);
  useEffect(() => {
    setFresh(new Set());
    load();
  }, [load, refreshKey]);

  const suggest = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const r = await blogAction<{ topics: BlogTopic[]; pending: BlogTopic[]; coverage: ClusterCoverage[] }>('topics', { lang, direction, count, extra, model });
      setPending(r.pending);
      setCover(r.coverage);
      setFresh(new Set(r.topics.map((t) => t.id)));
      setFilter('all');
      setMessage(
        r.topics.length
          ? { text: `Thêm ${r.topics.length} gợi ý mới (đánh dấu “Mới”). Gợi ý cũ vẫn còn bên dưới cho tới khi bạn viết hoặc bỏ qua.`, ok: true }
          : { text: 'AI chỉ đưa ra các chủ đề đã có. Thử đổi hướng chủ đề hoặc thêm yêu cầu.', ok: false },
      );
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Không gợi ý được.', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const skip = async (t: BlogTopic) => {
    setPending((list) => list.filter((x) => x.id !== t.id));
    try {
      const r = await blogAction<{ pending: BlogTopic[]; coverage: ClusterCoverage[] }>('topicStatus', { id: t.id, status: 'skipped' });
      setPending(r.pending);
      setCover(r.coverage);
    } catch {
      load();
    }
  };

  const shown = filter === 'all' ? pending : pending.filter((t) => t.cluster === filter);
  const groupsWithIdeas = [...new Set(pending.map((t) => t.cluster))];

  return (
    <>
      <Field label="Hướng chủ đề">
        <View style={styles.chips}>
          <Chip label="🎲 Trộn ngẫu nhiên" on={direction === 'random'} onPress={() => setDirection('random')} />
          {BLOG_CLUSTERS.map((c) => (
            <Chip key={c.id} label={c.label} on={direction === c.id} onPress={() => setDirection(c.id)} />
          ))}
        </View>
      </Field>
      <View style={styles.row}>
        <TextInput
          value={extra}
          onChangeText={setExtra}
          placeholder="Thêm yêu cầu cho gợi ý (không bắt buộc), VD: cho chủ shop bán quần áo, mùa Giáng sinh…"
          placeholderTextColor={colors.textMute}
          style={[blogStyles.input, { flex: 1, minWidth: 240 }]}
        />
        <Segmented options={TOPIC_COUNTS.map((n) => ({ id: n as number, label: `${n} gợi ý` }))} value={count} onChange={setCount} />
        <Button label={busy ? 'Đang nghĩ…' : 'Gợi ý chủ đề'} icon="bulb-outline" tone="plain" onPress={suggest} disabled={busy} />
      </View>
      {busy ? <Text style={styles.step}>⏳ AI đang nghĩ chủ đề, tránh các chủ đề đã có… (khoảng 20–60 giây)</Text> : null}
      {message ? <Text style={[styles.message, { color: message.ok ? '#2E9E6A' : colors.danger }]}>{message.text}</Text> : null}

      {pending.length > 0 && (
        <View style={{ gap: 10 }}>
          <View style={styles.row}>
            <Text style={styles.label}>Gợi ý đang chờ ({num(pending.length)})</Text>
            {groupsWithIdeas.length > 1 && (
              <View style={styles.chips}>
                <Chip label="Tất cả" on={filter === 'all'} onPress={() => setFilter('all')} />
                {groupsWithIdeas.map((g) => (
                  <Chip key={g} label={`${clusterLabel(g)} (${pending.filter((t) => t.cluster === g).length})`} on={filter === g} onPress={() => setFilter(g)} />
                ))}
              </View>
            )}
          </View>
          <View style={styles.cards}>
            {shown.map((t) => (
              <TopicCard key={t.id} topic={t} isNew={fresh.has(t.id)} selected={t.id === selectedId} onPick={() => onPick(t)} onSkip={() => skip(t)} />
            ))}
          </View>
        </View>
      )}

      <Coverage rows={cover} onPick={(c) => setDirection(c)} />
    </>
  );
}

function TopicCard({ topic: t, isNew, selected, onPick, onSkip }: { topic: BlogTopic; isNew: boolean; selected: boolean; onPick: () => void; onSkip: () => void }) {
  return (
    <View style={[styles.card, selected && styles.cardOn]}>
      <View style={styles.cardTop}>
        <View style={styles.badges}>
          {isNew && <Badge text="Mới" tone="blue" />}
          <Badge text={clusterLabel(t.cluster)} tone="plain" />
          <Badge text={DIFFICULTY_LABEL[t.difficulty] ?? t.difficulty} tone={DIFFICULTY_TONE[t.difficulty] ?? 'plain'} />
          {t.priority === 'high' && <Badge text={`★ ${PRIORITY_LABEL.high}`} tone="gold" />}
          {t.priority === 'low' && <Badge text={PRIORITY_LABEL.low} tone="plain" />}
        </View>
        <Pressable onPress={onSkip} hitSlop={8} style={styles.skip} accessibilityLabel="Bỏ qua gợi ý này">
          <Ionicons name="close" size={14} color={colors.textSoft} />
          <Text style={styles.skipText}>Bỏ qua</Text>
        </Pressable>
      </View>
      <Pressable onPress={onPick} style={{ gap: 4 }}>
        <Text style={styles.title}>{t.title}</Text>
        {t.keyword ? <Text style={styles.keyword}>🔑 {t.keyword}</Text> : null}
        {t.reason ? <Text style={styles.reason}>{t.reason}</Text> : null}
        {t.similar ? <Text style={styles.warn}>⚠️ Gần giống: “{t.similar}”</Text> : null}
      </Pressable>
      <Button label={selected ? 'Đã chọn' : 'Chọn chủ đề này'} icon={selected ? 'checkmark' : 'arrow-down-outline'} tone={selected ? 'gold' : 'plain'} onPress={onPick} />
    </View>
  );
}

/** How many articles and ideas each keyword group has: the empty ones are where to write next. */
function Coverage({ rows, onPick }: { rows: ClusterCoverage[]; onPick: (cluster: string) => void }) {
  if (!rows.length) return null;
  const named = rows.filter((r) => r.cluster);
  const loose = rows.find((r) => !r.cluster);
  const max = Math.max(1, ...named.map((r) => r.published + r.drafts));
  const empty = named.filter((r) => r.published + r.drafts === 0).length;
  return (
    <Card title="Độ phủ chủ đề" subtitle={`Số bài mỗi nhóm từ khoá (ngôn ngữ đang chọn). ${empty ? `${empty} nhóm chưa có bài nào: AI ưu tiên gợi ý cho các nhóm này.` : 'Nhóm nào cũng đã có bài.'} Bấm một nhóm để gợi ý riêng cho nhóm đó.`}>
      {named.map((r) => {
        const total = r.published + r.drafts;
        return (
          <Pressable key={r.cluster} onPress={() => onPick(r.cluster)} style={({ pressed }) => [styles.covRow, pressed && { opacity: 0.6 }]}>
            <Text style={styles.covLabel} numberOfLines={1}>
              {clusterLabel(r.cluster)}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fillPublished, { width: `${(r.published / max) * 100}%` }]} />
              <View style={[styles.fillDraft, { width: `${(r.drafts / max) * 100}%` }]} />
            </View>
            <Text style={styles.covNums}>
              {total ? `${r.published} đăng · ${r.drafts} nháp` : 'Còn trống'}
              {r.suggested ? ` · ${r.suggested} gợi ý` : ''}
            </Text>
          </Pressable>
        );
      })}
      {loose && loose.published + loose.drafts > 0 ? <Text style={styles.reason}>{`${loose.published + loose.drafts} bài chưa gắn nhóm (gắn trong trình soạn bài).`}</Text> : null}
      {!named.some((r) => r.published + r.drafts) && <Empty text="Chưa có bài nào trong ngôn ngữ này." />}
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  label: { fontFamily: font.semi, fontSize: 13, color: colors.text },
  step: { fontFamily: font.semi, fontSize: 13.5, color: colors.goldDeep },
  message: { fontFamily: font.medium, fontSize: 13.5 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 1, flexBasis: 300, minWidth: 0, gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardOn: { borderColor: colors.gold, borderWidth: 2, backgroundColor: `${colors.gold}12` },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  skip: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.surface2 },
  skipText: { fontFamily: font.medium, fontSize: 11.5, color: colors.textSoft },
  title: { fontFamily: font.semi, fontSize: 14.5, lineHeight: 20, color: colors.text },
  keyword: { fontFamily: font.regular, fontSize: 12.5, color: colors.textSoft },
  reason: { fontFamily: font.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSoft },
  warn: { fontFamily: font.medium, fontSize: 12.5, color: '#C77C1E' },
  covRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  covLabel: { width: 170, fontFamily: font.medium, fontSize: 13, color: colors.text },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: 'hidden', flexDirection: 'row' },
  fillPublished: { height: '100%', backgroundColor: '#2E9E6A' },
  fillDraft: { height: '100%', backgroundColor: colors.gold, opacity: 0.6 },
  covNums: { width: 170, fontFamily: font.regular, fontSize: 12, color: colors.textSoft, textAlign: 'right' },
});
