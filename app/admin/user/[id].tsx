import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useAccount } from '@/src/account';
import { fetchUser, grantBonus, setLocked } from '@/src/admin/api';
import { dateTime, date, errorLabel, modelName, num, reasonLabel, shortDay, statusLabel, toolLabel, usdVnd } from '@/src/admin/labels';
import { Failed, Loading, Shell } from '@/src/admin/Shell';
import type { UserDetail } from '@/src/admin/types';
import { Badge, Button, Card, Empty, Grid, Row, Stat, StatGrid } from '@/src/admin/ui';
import { useLoad } from '@/src/admin/useLoad';
import { Dialog } from '@/src/Dialog';
import { notify } from '@/src/notify';
import { colors, font } from '@/src/theme';

/** One customer: points, AI history, rewards, invited friends; admins can give bonus points or lock the account. */
export default function AdminUser() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const { admin } = useAccount();
  const { data: d, error, reload, setData } = useLoad(() => fetchUser(userId), [userId]);
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);

  if (!admin) return <Shell title="Khách hàng">{error ? <Failed message={error} onRetry={reload} /> : <Loading />}</Shell>;
  if (error && !d) {
    return (
      <Shell title="Khách hàng">
        <Failed message={error} onRetry={reload} />
      </Shell>
    );
  }
  if (!d) {
    return (
      <Shell title="Khách hàng">
        <Loading />
      </Shell>
    );
  }

  const u = d.user;
  const run = async (action: () => Promise<UserDetail>, done: string) => {
    setBusy(true);
    try {
      setData(await action());
      notify(done);
      return true;
    } catch (e: any) {
      notify(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const give = async () => {
    const n = Number(points);
    if (!Number.isInteger(n) || n < 1) return notify('Nhập số điểm là số nguyên dương.');
    if (await run(() => grantBonus(userId, n, note), `Đã tặng ${n} điểm cho ${u.email}`)) {
      setPoints('');
      setNote('');
    }
  };

  const toggleLock = () => {
    setConfirmLock(false);
    run(() => setLocked(userId, !u.locked), u.locked ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản');
  };

  const openUser = (other: number) => router.push(`/admin/user/${other}`);

  return (
    <Shell title={u.email} subtitle={`Khách hàng #${u.id}`} onRefresh={reload}>
      <Card
        title={u.name || 'Chưa đặt tên'}
        subtitle={`Tạo ngày ${dateTime(u.createdAt)}`}
        right={
          <View style={styles.badges}>
            {u.admin && <Badge text="Quản trị" tone="gold" />}
            <Badge text={u.locked ? 'Đã khóa' : 'Đang hoạt động'} tone={u.locked ? 'red' : 'green'} />
          </View>
        }
      >
        <Row label="Mã mời" value={u.refCode ?? '—'} />
        <Row
          label="Được mời bởi"
          value={u.invitedBy ? u.invitedBy.email : 'Không'}
          onPress={u.invitedBy ? () => openUser(u.invitedBy!.id) : undefined}
        />
        <Row label="Đang đăng nhập trên" value={`${num(u.sessions)} thiết bị`} />
        <Row label="Hoạt động gần nhất" value={u.lastDay ? shortDay(u.lastDay) : 'Chưa có'} />
      </Card>

      <StatGrid>
        <Stat icon="diamond-outline" label="Điểm còn lại" value={num(u.points)} sub={`${num(d.monthly)} điểm tháng + ${num(u.bonus)} điểm thưởng`} />
        <Stat icon="trending-down-outline" tone="blue" label="Đã dùng tháng này" value={`${num(d.spentThisMonth)} điểm`} />
        <Stat icon="sparkles-outline" label="Ảnh AI đã tạo" value={num(u.ai)} sub={d.errors ? `${num(d.errors)} lần lỗi` : undefined} />
        <Stat icon="cash-outline" tone="green" label="Chi phí AI" value={usdVnd(d.usd)} />
        <Stat icon="people-outline" tone="plain" label="Bạn bè đã mời" value={num(u.invited)} />
      </StatGrid>

      <Grid min={340}>
        <Card title="Tặng điểm thưởng" subtitle="Không hết hạn; dùng sau khi hết điểm tháng">
          <View style={styles.form}>
            <TextInput
              value={points}
              onChangeText={(v) => setPoints(v.replace(/[^0-9]/g, ''))}
              placeholder="Số điểm (1–1000)"
              placeholderTextColor={colors.textMute}
              keyboardType="number-pad"
              style={[styles.input, { flexBasis: 140, flexGrow: 0 }]}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Lý do (VD: bù ảnh lỗi)"
              placeholderTextColor={colors.textMute}
              maxLength={100}
              style={styles.input}
            />
          </View>
          <View style={styles.actions}>
            <Button label="Tặng điểm" icon="gift-outline" onPress={give} disabled={busy || !points} />
          </View>
        </Card>
        <Card title="Khóa tài khoản" subtitle="Khóa: đăng xuất trên mọi máy, không đăng nhập hay nhận thưởng mời bạn được nữa">
          <View style={styles.actions}>
            {u.locked ? (
              <Button label="Mở khóa tài khoản" icon="lock-open-outline" onPress={() => setConfirmLock(true)} disabled={busy} />
            ) : (
              <Button label="Khóa tài khoản" icon="lock-closed-outline" tone="red" onPress={() => setConfirmLock(true)} disabled={busy || u.admin} />
            )}
          </View>
          {u.admin && !u.locked ? <Text style={styles.note}>Tài khoản quản trị không thể bị khóa.</Text> : null}
        </Card>
      </Grid>

      <Grid min={340}>
        <Card title="Chức năng AI đã dùng">
          {d.tools.length ? d.tools.map((t) => <Row key={t.tool} label={toolLabel(t.tool)} value={`${num(t.n)} ảnh`} />) : <Empty text="Chưa dùng AI." />}
        </Card>
        <Card title="Điểm thưởng đã nhận">
          {d.bonus.length ? (
            d.bonus.map((b, i) => (
              <Row key={i} label={reasonLabel(b.reason)} sub={[dateTime(b.at), b.reason === 'admin' ? b.ref : ''].filter(Boolean).join(' · ')} value={`+${num(b.points)}`} valueColor="#2E9E6A" />
            ))
          ) : (
            <Empty text="Chưa có điểm thưởng." />
          )}
        </Card>
      </Grid>

      <Card title="Lịch sử AI gần đây" subtitle="40 yêu cầu mới nhất">
        {d.recentAi.length ? (
          d.recentAi.map((a, i) => (
            <Row
              key={i}
              label={toolLabel(a.tool)}
              sub={[dateTime(a.at), modelName(a.model), errorLabel(a.error), a.ms ? `${(a.ms / 1000).toFixed(1)} giây` : '']
                .filter(Boolean)
                .join(' · ')}
              value={a.status === 'ok' ? `−${a.points} điểm` : statusLabel[a.status]}
              valueColor={a.status === 'ok' ? undefined : colors.danger}
            />
          ))
        ) : (
          <Empty text="Chưa có yêu cầu nào." />
        )}
      </Card>

      <Grid min={340}>
        <Card title="Bạn bè đã mời">
          {d.invited.length ? (
            d.invited.map((f) => <Row key={f.id} label={f.email} sub={`Đăng ký ${date(f.createdAt)}`} onPress={() => openUser(f.id)} />)
          ) : (
            <Empty text="Chưa mời ai." />
          )}
        </Card>
        <Card title="Ngày hoạt động" subtitle="30 ngày gần nhất có mở app hoặc dùng AI">
          {d.activeDays.length ? (
            <View style={styles.days}>
              {d.activeDays.map((day) => (
                <Badge key={day} text={shortDay(day)} tone="blue" />
              ))}
            </View>
          ) : (
            <Empty text="Chưa có." />
          )}
        </Card>
        <Card title="Nhật ký quản trị">
          {d.adminLog.length ? (
            d.adminLog.map((l, i) => <Row key={i} label={l.detail} sub={`${dateTime(l.at)} · ${l.admin}`} />)
          ) : (
            <Empty text="Chưa có thay đổi nào." />
          )}
        </Card>
      </Grid>

      <Dialog
        visible={confirmLock}
        title={u.locked ? 'Mở khóa tài khoản?' : 'Khóa tài khoản?'}
        message={
          u.locked
            ? `${u.email} sẽ đăng nhập và dùng AI lại được.`
            : `${u.email} sẽ bị đăng xuất trên mọi thiết bị và không đăng nhập được nữa cho tới khi mở khóa.`
        }
        actions={[
          { label: 'Hủy', onPress: () => setConfirmLock(false) },
          { label: u.locked ? 'Mở khóa' : 'Khóa', onPress: toggleLock, primary: true, destructive: !u.locked },
        ]}
        onClose={() => setConfirmLock(false)}
      />
    </Shell>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', gap: 6 },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: {
    flexGrow: 1,
    flexBasis: 200,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text,
  },
  actions: { flexDirection: 'row', gap: 10 },
  note: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
