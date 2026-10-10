import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors, font } from '../theme';
import { fetchSystem } from './api';
import { dateTime, duration, num } from './labels';
import { Failed, Loading } from './Shell';
import { Badge, Card, Grid, Row } from './ui';
import { useLoad } from './useLoad';

const TABLE_LABELS: Record<string, string> = {
  users: 'Tài khoản',
  sessions: 'Phiên đăng nhập',
  usage: 'Lượt AI đã tính điểm',
  bonus: 'Điểm thưởng',
  visits: 'Lượt mở link chia sẻ',
  ai_log: 'Nhật ký AI',
  actives: 'Lượt hoạt động theo ngày',
  events: 'Bộ đếm chức năng',
  admin_log: 'Nhật ký quản trị',
};

/** Configuration checks, the app's rules (points, rewards, models) and server health. */
export function SystemTab({ refresh }: { refresh: number }) {
  const { data: s, error, reload } = useLoad(fetchSystem, []);
  useEffect(() => {
    if (refresh) reload();
  }, [refresh, reload]);

  if (error && !s) return <Failed message={error} onRetry={reload} />;
  if (!s) return <Loading />;

  const problems = s.checks.filter((c) => !c.ok).length;
  const c = s.config;
  return (
    <View style={{ gap: 16 }}>
      <Card
        title="Kiểm tra cấu hình"
        subtitle="Đọc từ .env trên server; không bao giờ hiện khóa bí mật"
        right={<Badge text={problems ? `${problems} mục cần xem` : 'Ổn'} tone={problems ? 'red' : 'green'} />}
      >
        {s.checks.map((ch) => (
          <View key={ch.label} style={styles.check}>
            <Ionicons name={ch.ok ? 'checkmark-circle' : 'alert-circle'} size={20} color={ch.ok ? '#2E9E6A' : colors.danger} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.checkLabel}>{ch.label}</Text>
              <Text style={styles.checkValue} selectable>
                {ch.value}
              </Text>
              {!ch.ok && ch.hint ? <Text style={styles.checkHint}>{ch.hint}</Text> : null}
            </View>
          </View>
        ))}
      </Card>

      <Grid min={340}>
        <Card title="Quy tắc điểm & thưởng" subtitle="Sửa trong src/ai/credits.ts và src/ai/models.ts">
          {c.models.map((m) => (
            <Row key={m.id} label={`Model ${m.name}${m.isDefault ? ' (mặc định)' : ''}`} sub={m.id} value={`$${m.usd}/ảnh · ${m.points} điểm`} />
          ))}
          <Row label="Khách chưa đăng ký" value={`${c.guestFreeTries} lượt miễn phí`} />
          <Row label="Tài khoản" value={`${num(c.monthlyPoints)} điểm/tháng`} />
          <Row label="Mời bạn bè" value={`+${c.referralInviter} / +${c.referralFriend} điểm`} sub={`Người mời / người được mời · tối đa ${c.maxReferralsPerMonth} lần/tháng`} />
          <Row label="Chia sẻ Facebook" value={`+${c.sharePoints} điểm/tháng`} />
          <Row label="Múi giờ" value={c.timeZone} />
          <Row label="Tháng hiện tại" value={c.period} sub={`Điểm tháng làm mới ngày ${c.resetLabel}`} />
        </Card>

        <Card title="Máy chủ" subtitle={`Cập nhật lúc ${dateTime(s.now)}`}>
          <Row label="Node.js" value={s.node} />
          <Row label="Hệ điều hành" value={s.platform} />
          <Row label="Đã chạy liên tục" value={duration(s.uptimeSec)} />
          <Row label="Bộ nhớ đang dùng" value={`${num(s.memoryMb)} MB`} />
          <Row label="Phiên bản dữ liệu" value={`schema ${s.schema}`} />
          <Row label="Phiên bản app (trang này)" value={Constants.expoConfig?.version ?? '—'} sub={`Đang xem trên ${Platform.OS}`} />
        </Card>
      </Grid>

      <Card title="Cơ sở dữ liệu" subtitle={s.db.file}>
        <Row label="Dung lượng" value={`${s.db.sizeMb} MB`} sub="Nhớ sao lưu file này (và file -wal đi kèm) thường xuyên" />
        {Object.entries(s.db.tables).map(([table, n]) => (
          <Row key={table} label={TABLE_LABELS[table] ?? table} sub={table} value={num(n)} />
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  check: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  checkLabel: { fontFamily: font.semi, fontSize: 13.5, color: colors.text },
  checkValue: { fontFamily: font.regular, fontSize: 12.5, color: colors.textSoft, marginTop: 2 },
  checkHint: { fontFamily: font.regular, fontSize: 12, color: colors.danger, marginTop: 3 },
});
