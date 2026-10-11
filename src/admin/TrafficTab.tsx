import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font } from '../theme';
import { fetchOnline, fetchTraffic } from './api';
import { dateTime, isoToVn, num, shortDay, vnToIso } from './labels';
import { PLATFORMS, SCREENS, type ScreenId } from './presence';
import { Failed, Loading } from './Shell';
import type { OnlineNow, OnlinePerson, TrafficPeriod } from './types';
import { BarChart, Button, Card, Empty, Grid, Row, Segmented, ShareRow, Stat, StatGrid } from './ui';
import { useLoad } from './useLoad';

const PERIODS: { id: TrafficPeriod; label: string }[] = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'yesterday', label: 'Hôm qua' },
  { id: 'week', label: 'Tuần này' },
  { id: 'month', label: 'Tháng này' },
  { id: 'custom', label: 'Tùy chỉnh' },
];

/** Longest custom range (the server checks it too). */
const MAX_RANGE_DAYS = 366;

type Range = { from: string; to: string };

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** Today on this device, until the server says what today is in its zone. */
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Who is online right now is refreshed this often while the tab is open. */
const LIVE_REFRESH_MS = 20_000;
const ONLINE_SHOWN = 12;

const GREEN = '#2E9E6A';

/** "45 giây", "12 phút", "2 giờ 5 phút". */
function span(sec: number) {
  const s = Math.round(sec);
  if (s < 60) return `${s} giây`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} giờ ${m} phút` : `${m} phút`;
}

/** "07:39" or "11/10 07:39" in the server's zone, like the charts (the admin's own clock may differ). */
function zoned(t: number, timeZone: string, withDay = false) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(t);
    const p = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
    const time = `${p('hour')}:${p('minute')}`;
    return withDay ? `${p('day')}/${p('month')} ${time}` : time;
  } catch {
    return withDay ? dateTime(t) : dateTime(t).slice(11);
  }
}
const platformLabel = (p: string) => PLATFORMS[p as keyof typeof PLATFORMS] ?? 'Không rõ';
const screenLabel = (s: string) => SCREENS[s as ScreenId] ?? s;

/** "▲ 25%", "▼ 10%", "= " compared with the same stretch of time before. */
function change(cur: number, prev: number) {
  if (!prev) return cur ? '▲ mới' : '=';
  const p = Math.round(((cur - prev) / prev) * 100);
  return p > 0 ? `▲ ${p}%` : p < 0 ? `▼ ${-p}%` : '=';
}

/** Users, visits and online people: right now, and today / yesterday / this week / this month / chosen days. */
export function TrafficTab({ refresh }: { refresh: number }) {
  const router = useRouter();
  const [period, setPeriod] = useState<TrafficPeriod>('today');
  const [range, setRange] = useState<Range>(() => {
    const today = localToday();
    return { from: `${today.slice(0, 8)}01`, to: today };
  });
  const { data: t, error, loading, reload } = useLoad(() => fetchTraffic(period, range), [period, period === 'custom' ? range : null]);
  const [live, setLive] = useState<OnlineNow | null>(null);

  useEffect(() => {
    if (refresh) reload();
  }, [refresh, reload]);
  useEffect(() => {
    if (t) setLive(t.online);
  }, [t]);
  useEffect(() => {
    const timer = setInterval(() => {
      fetchOnline()
        .then(setLive)
        .catch(() => {});
    }, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const header = (
    <View style={{ gap: 12 }}>
      <View style={styles.rangeRow}>
        <Segmented options={PERIODS} value={period} onChange={setPeriod} />
        {t && (
          <Text style={styles.rangeText}>
            {t.from === t.to ? shortDay(t.from) : t.period === 'custom' ? `${isoToVn(t.from)} → ${isoToVn(t.to)}` : `${shortDay(t.from)} → ${shortDay(t.to)}`} · giờ {t.timeZone}
            {loading ? ' · đang tải…' : ''}
          </Text>
        )}
      </View>
      {period === 'custom' && <CustomRange value={range} today={t?.today ?? localToday()} onApply={setRange} />}
    </View>
  );

  if (error && (!t || period === 'custom')) {
    return (
      <View style={{ gap: 16 }}>
        {header}
        <Failed message={error} onRetry={reload} />
      </View>
    );
  }
  if (!t) return <Loading />;

  const c = t.current;
  const p = t.previous;
  const elapsed = t.series.filter((s) => !s.future).length;
  const vs = (cur: number, prev: number) => `${change(cur, prev)} so với ${t.compareLabel} (${num(prev)})`;
  const oneDay = t.from === t.to;
  const shown = t.series.map((s) => ({ ...s, users: s.future ? 0 : s.users, visits: s.future ? 0 : s.visits }));
  const maxPlatform = Math.max(1, ...t.platforms.map((x) => x.users));
  const maxScreen = Math.max(1, ...t.screens.map((x) => x.seconds));
  const openUser = (id: number) => router.push(`/admin/user/${id}`);

  return (
    <View style={{ gap: 16 }}>
      {header}

      <LiveCard live={live ?? t.online} timeZone={t.timeZone} onOpenUser={openUser} />

      <StatGrid>
        <Stat icon="people-outline" label="Người dùng" value={num(c.users)} sub={`${num(c.members)} tài khoản · ${num(c.guests)} khách · ${vs(c.users, p.users)}`} />
        <Stat icon="enter-outline" tone="blue" label="Lượt truy cập" value={num(c.visits)} sub={`${c.users ? (c.visits / c.users).toFixed(1).replace('.', ',') : 0} lượt/người · ${vs(c.visits, p.visits)}`} />
        <Stat
          icon="radio-outline"
          tone="green"
          label="Online cùng lúc cao nhất"
          value={num(c.peak)}
          sub={`${c.peakAt ? `lúc ${zoned(c.peakAt, t.timeZone, !oneDay)}` : 'chưa có'} · ${t.compareLabel}: ${num(p.peak)}`}
        />
        <Stat icon="time-outline" label="Thời gian dùng" value={span(c.seconds)} sub={`TB ${span(c.users ? c.seconds / c.users : 0)}/người · ${span(c.visits ? c.seconds / c.visits : 0)}/lượt`} />
        <Stat icon="person-add-outline" tone="plain" label="Người dùng mới" value={num(c.newUsers)} sub={`Lần đầu mở app · ${vs(c.newUsers, p.newUsers)}`} />
      </StatGrid>

      <Grid min={320}>
        <Card title={oneDay ? 'Người online theo giờ' : 'Người dùng mỗi ngày'} subtitle={oneDay ? 'Số người mở app trong từng giờ' : 'Số người mở app trong từng ngày'}>
          <BarChart data={shown.map((s) => ({ label: s.label, value: s.users }))} unit={oneDay ? 'người/giờ' : 'người/ngày'} color={GREEN} average averageOver={elapsed} />
        </Card>
        <Card title={oneDay ? 'Lượt truy cập theo giờ' : 'Lượt truy cập mỗi ngày'} subtitle="Mỗi lần mở app (nghỉ quá 5 phút tính là lượt mới)">
          <BarChart data={shown.map((s) => ({ label: s.label, value: s.visits }))} unit="lượt" color="#3E7BD6" />
        </Card>
        {oneDay ? (
          <Card title="Online cùng lúc cao nhất theo giờ" subtitle="Số người dùng app cùng một lúc">
            <BarChart data={shown.map((s) => ({ label: s.label, value: s.peak }))} unit="người cùng lúc" color={colors.gold} peakOnly />
          </Card>
        ) : (
          <Card title="Khung giờ đông người" subtitle="Cộng dồn số người online theo giờ trong ngày">
            <BarChart data={t.hours.map((n, h) => ({ label: `${h}h`, value: n }))} unit="lượt người" color={colors.gold} />
          </Card>
        )}
      </Grid>

      <Grid min={300}>
        <Card title="Nền tảng" subtitle="Người dùng theo thiết bị">
          {t.platforms.length ? t.platforms.map((x) => <ShareRow key={x.platform} label={platformLabel(x.platform)} value={x.users} of={maxPlatform} right={`${num(x.users)} người`} />) : <Empty text="Chưa có số liệu." />}
        </Card>
        <Card title="Màn hình dùng nhiều" subtitle="Tổng thời gian ở từng màn hình">
          {t.screens.length ? (
            t.screens.slice(0, 10).map((x) => <ShareRow key={x.screen} label={screenLabel(x.screen)} value={x.seconds} of={maxScreen} right={span(x.seconds)} />)
          ) : (
            <Empty text="Chưa có số liệu." />
          )}
        </Card>
        <Card title="Tài khoản dùng lâu nhất">
          {t.topMembers.length ? (
            t.topMembers.map((m) => <Row key={m.id} label={m.email} sub={`${num(m.visits)} lượt truy cập`} value={span(m.seconds)} onPress={() => openUser(m.id)} />)
          ) : (
            <Empty text="Chưa có tài khoản nào online trong kỳ này." />
          )}
        </Card>
      </Grid>

      <Text style={styles.note}>
        {t.since
          ? `Số liệu online ghi nhận từ ${zoned(t.since, t.timeZone, true)} (app gửi tín hiệu mỗi 45 giây khi đang mở; ẩn app hoặc tắt máy thì ngừng).`
          : 'Chưa có số liệu online: sẽ có ngay khi có người mở app.'}
      </Text>
    </View>
  );
}

/** From / to boxes (dd/mm/yyyy) with shortcuts for the last 7, 30 and 90 days. */
function CustomRange({ value, today, onApply }: { value: Range; today: string; onApply: (r: Range) => void }) {
  const [fromText, setFromText] = useState(isoToVn(value.from));
  const [toText, setToText] = useState(isoToVn(value.to));
  const [problem, setProblem] = useState('');

  const apply = (r: Range) => {
    setFromText(isoToVn(r.from));
    setToText(isoToVn(r.to));
    setProblem('');
    onApply(r);
  };
  const submit = () => {
    const from = vnToIso(fromText);
    const to = vnToIso(toText);
    if (!from || !to) return setProblem('Nhập ngày dạng ngày/tháng/năm, ví dụ 01/10/2026.');
    if (from > to) return setProblem('Ngày bắt đầu phải trước ngày kết thúc.');
    if (to > today) return setProblem(`Ngày kết thúc không được sau hôm nay (${isoToVn(today)}).`);
    if (Date.parse(to) - Date.parse(from) >= MAX_RANGE_DAYS * 86_400_000) return setProblem(`Chọn tối đa ${MAX_RANGE_DAYS} ngày.`);
    apply({ from, to });
  };
  const last = (days: number) => apply({ from: addDays(today, -(days - 1)), to: today });

  return (
    <View style={styles.custom}>
      <View style={styles.customRow}>
        <Text style={styles.customLabel}>Từ</Text>
        <TextInput value={fromText} onChangeText={setFromText} placeholder="01/10/2026" placeholderTextColor={colors.textMute} style={styles.dateInput} onSubmitEditing={submit} inputMode="numeric" />
        <Text style={styles.customLabel}>đến</Text>
        <TextInput value={toText} onChangeText={setToText} placeholder={isoToVn(today)} placeholderTextColor={colors.textMute} style={styles.dateInput} onSubmitEditing={submit} inputMode="numeric" />
        <Button label="Xem" icon="search-outline" onPress={submit} />
      </View>
      <View style={styles.customRow}>
        {[7, 30, 90].map((d) => (
          <Pressable key={d} onPress={() => last(d)} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.7 }]}>
            <Text style={styles.quickText}>{d} ngày qua</Text>
          </Pressable>
        ))}
      </View>
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
    </View>
  );
}

function LiveCard({ live, timeZone, onOpenUser }: { live: OnlineNow; timeZone: string; onOpenUser: (id: number) => void }) {
  const platforms = Object.entries(live.platforms).sort((a, b) => b[1] - a[1]);
  return (
    <Card
      title="Đang online"
      subtitle={`Cập nhật lúc ${zoned(live.now, timeZone)} · tự làm mới mỗi ${LIVE_REFRESH_MS / 1000} giây`}
      right={
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      }
    >
      <View style={styles.liveTop}>
        <Text style={styles.liveNumber}>{num(live.total)}</Text>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.liveSub}>
            {num(live.members)} tài khoản · {num(live.guests)} khách
          </Text>
          {platforms.length ? (
            <View style={styles.chips}>
              {platforms.map(([p, n]) => (
                <View key={p} style={styles.chip}>
                  <Ionicons name={p === 'web' ? 'globe-outline' : p === 'ios' ? 'logo-apple' : p === 'android' ? 'logo-android' : 'help-outline'} size={12} color={colors.textSoft} />
                  <Text style={styles.chipText}>
                    {platformLabel(p)} {num(n)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      {live.people.length ? (
        <View>
          {live.people.slice(0, ONLINE_SHOWN).map((person, i) => (
            <PersonRow key={person.visitor + i} person={person} now={live.now} onOpenUser={onOpenUser} />
          ))}
          {live.total > ONLINE_SHOWN && <Text style={styles.more}>và {num(live.total - ONLINE_SHOWN)} người khác</Text>}
        </View>
      ) : (
        <Empty text="Không có ai đang online." />
      )}
    </Card>
  );
}

function PersonRow({ person, now, onOpenUser }: { person: OnlinePerson; now: number; onOpenUser: (id: number) => void }) {
  const who = person.email ?? `Khách ${person.visitor}`;
  return (
    <Row
      label={who}
      sub={`${platformLabel(person.platform)} · đang ở ${screenLabel(person.screen)}`}
      value={`online ${span((now - person.since) / 1000)}`}
      onPress={person.userId !== null ? () => onOpenUser(person.userId!) : undefined}
    />
  );
}

const styles = StyleSheet.create({
  rangeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  rangeText: { fontFamily: font.regular, fontSize: 12.5, color: colors.textSoft },
  custom: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  customRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  customLabel: { fontFamily: font.medium, fontSize: 13, color: colors.textSoft },
  dateInput: {
    width: 120,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    fontFamily: font.semi,
    fontSize: 14,
    color: colors.text,
  },
  quick: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface2 },
  quickText: { fontFamily: font.medium, fontSize: 12.5, color: colors.text },
  problem: { fontFamily: font.regular, fontSize: 12.5, color: colors.danger },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: `${GREEN}1F` },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  liveText: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1, color: GREEN },
  liveTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  liveNumber: { fontFamily: font.bold, fontSize: 40, color: GREEN, minWidth: 56 },
  liveSub: { fontFamily: font.medium, fontSize: 13.5, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.surface2 },
  chipText: { fontFamily: font.medium, fontSize: 11.5, color: colors.textSoft },
  more: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft, paddingTop: 8 },
  note: { fontFamily: font.regular, fontSize: 12, color: colors.textMute, lineHeight: 18 },
});
