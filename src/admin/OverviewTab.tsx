import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font } from '../theme';
import { fetchOverview } from './api';
import { errorLabel, eventLabel, dateTime, modelName, num, percent, reasonLabel, shortDay, sourceLabel, toolLabel, usd, usdVnd } from './labels';
import { Failed, Loading } from './Shell';
import type { ToolStat } from './types';
import { BarChart, Card, Empty, Grid, Row, Segmented, ShareRow, Stat, StatGrid } from './ui';
import { useLoad } from './useLoad';

const RANGES = [
  { id: 7, label: '7 ngày' },
  { id: 30, label: '30 ngày' },
  { id: 90, label: '90 ngày' },
];

/** Numbers for the chosen period: accounts, activity, AI use and cost, features, errors and rewards. */
export function OverviewTab({ refresh }: { refresh: number }) {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const { data: o, error, reload } = useLoad(() => fetchOverview(days), [days]);
  useEffect(() => {
    if (refresh) reload();
  }, [refresh, reload]);

  if (error && !o) return <Failed message={error} onRetry={reload} />;
  if (!o) return <Loading />;

  const attempts = o.ai.ok + o.ai.error;
  const errorRate = attempts ? o.ai.error / attempts : 0;
  const maxTool = Math.max(1, ...o.tools.map((t) => t.ok));
  const maxEvent = Math.max(1, ...o.events.map((e) => e.n));
  const openUser = (id: number) => router.push(`/admin/user/${id}`);

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.rangeRow}>
        <Segmented options={RANGES} value={days} onChange={setDays} />
        <Text style={styles.rangeText}>
          {shortDay(o.from)} → {shortDay(o.today)} · giờ {o.timeZone}
        </Text>
      </View>

      <StatGrid>
        <Stat icon="people-outline" label="Tài khoản" value={num(o.users.total)} sub={`+${num(o.users.newInRange)} trong kỳ · +${num(o.users.newToday)} hôm nay`} />
        <Stat
          icon="pulse-outline"
          tone="blue"
          label="Hoạt động hôm nay"
          value={num(o.active.today)}
          sub={`thiết bị · trong kỳ ${num(o.active.inRange)} thiết bị, ${num(o.active.members)} tài khoản`}
        />
        <Stat icon="sparkles-outline" label="Ảnh AI thành công" value={num(o.ai.ok)} sub={`${num(o.ai.okToday)} hôm nay · ${num(o.ai.okMonth)} tháng này`} />
        <Stat icon="cash-outline" tone="green" label="Chi phí AI ước tính" value={usd(o.ai.usd)} sub={`Tháng này: ${usdVnd(o.ai.usdMonth)}`} />
        <Stat
          icon="warning-outline"
          tone={errorRate > 0.1 ? 'red' : 'plain'}
          label="Tỉ lệ lỗi AI"
          value={percent(o.ai.error, attempts)}
          sub={`${num(o.ai.error)} lỗi · trung bình ${(o.ai.avgMs / 1000).toFixed(1)} giây/ảnh`}
        />
        <Stat
          icon="lock-closed-outline"
          tone="plain"
          label="Chạm giới hạn"
          value={num(o.ai.denied)}
          sub={`${num(o.ai.guestDenied)} lần khách hết lượt · ${num(o.ai.denied - o.ai.guestDenied)} lần hết điểm`}
        />
        <Stat icon="diamond-outline" label="Điểm AI đã dùng" value={num(o.ai.points)} sub={`${num(o.users.referred)} tài khoản mới đến từ lời mời`} />
      </StatGrid>

      <Grid min={320}>
        <Card title="Ảnh AI mỗi ngày" subtitle="Màu đỏ: yêu cầu bị lỗi">
          <BarChart data={o.series.map((d) => ({ label: shortDay(d.day), value: d.ai, extra: d.errors }))} unit="ảnh" extraUnit="lỗi" />
        </Card>
        <Card title="Thiết bị hoạt động mỗi ngày" subtitle="Máy mở app hoặc dùng AI">
          <BarChart data={o.series.map((d) => ({ label: shortDay(d.day), value: d.actives }))} unit="thiết bị/ngày" color="#3E7BD6" average />
        </Card>
        <Card title="Tài khoản mới mỗi ngày">
          <BarChart data={o.series.map((d) => ({ label: shortDay(d.day), value: d.signups }))} unit="tài khoản" color="#2E9E6A" />
        </Card>
      </Grid>

      <Card title="Chức năng AI" subtitle="Ảnh tạo thành công trong kỳ; dòng dưới: model, khách/tài khoản, lỗi, thời gian, chi phí">
        {o.tools.length ? o.tools.map((t) => <ToolRow key={t.tool} t={t} max={maxTool} />) : <Empty text="Chưa có ai dùng AI trong kỳ này." />}
      </Card>

      <Grid min={360}>
        <Card title="Chức năng khác" subtitle="Dùng trên máy, không cần AI (từ phiên bản có thống kê)">
          {o.events.length ? (
            o.events.slice(0, 30).map((e) => <ShareRow key={e.name + e.detail} label={eventLabel(e.name, e.detail)} value={e.n} of={maxEvent} />)
          ) : (
            <Empty text="Chưa có số liệu." />
          )}
        </Card>
        <Card title="Lỗi AI" subtitle="Gom theo loại lỗi">
          {o.errors.length ? (
            o.errors.map((e) => <Row key={e.error} label={errorLabel(e.error) || 'Không rõ'} sub={`Gần nhất ${dateTime(e.last)}`} value={num(e.n)} valueColor={colors.danger} />)
          ) : (
            <Empty text="Không có lỗi nào 🎉" />
          )}
        </Card>
      </Grid>

      <Grid min={300}>
        <Card title="Model AI">
          {o.models.length ? o.models.map((m) => <Row key={m.model} label={modelName(m.model)} sub={m.model} value={`${num(m.ok)} ảnh · ${usd(m.usd)}`} />) : <Empty text="Chưa có số liệu." />}
        </Card>
        <Card title="Điểm thưởng & lời mời" subtitle={`Trong ${days} ngày`}>
          {o.rewards.map((r) => (
            <Row key={r.reason} label={reasonLabel(r.reason)} value={`+${num(r.points)} điểm`} sub={`${num(r.count)} lần`} />
          ))}
          {o.visits.map((v) => (
            <Row key={v.source} label={`Người mở ${sourceLabel(v.source).toLowerCase()}`} value={num(v.n)} />
          ))}
          {!o.rewards.length && !o.visits.length && <Empty text="Chưa có điểm thưởng nào." />}
        </Card>
        <Card title="Dùng AI nhiều nhất">
          {o.topUsers.length ? (
            o.topUsers.map((u) => <Row key={u.id} label={u.email} sub={u.name || undefined} value={`${num(u.ai)} ảnh · ${usd(u.usd)}`} onPress={() => openUser(u.id)} />)
          ) : (
            <Empty text="Chưa có tài khoản nào dùng AI." />
          )}
        </Card>
      </Grid>
    </View>
  );
}

function ToolRow({ t, max }: { t: ToolStat; max: number }) {
  const models = Object.entries(t.byModel)
    .map(([m, n]) => `${modelName(m)} ${num(n)}`)
    .join(' · ');
  const parts = [
    models,
    `tài khoản ${num(t.members)} · khách ${num(t.guests)}`,
    t.error ? `lỗi ${num(t.error)}` : '',
    t.denied ? `hết lượt ${num(t.denied)}` : '',
    t.blocked ? `bị chặn ${num(t.blocked)}` : '',
    t.avgMs ? `${(t.avgMs / 1000).toFixed(1)} giây/ảnh` : '',
    usd(t.usd),
  ].filter(Boolean);
  return (
    <View style={styles.tool}>
      <ShareRow label={toolLabel(t.tool)} value={t.ok} of={max} right={`${num(t.ok)} ảnh`} />
      <Text style={styles.toolSub}>{parts.join('  ·  ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rangeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  rangeText: { fontFamily: font.regular, fontSize: 12.5, color: colors.textSoft },
  tool: { gap: 2, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  toolSub: { fontFamily: font.regular, fontSize: 11.5, color: colors.textSoft },
});
