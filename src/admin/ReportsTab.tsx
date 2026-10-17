import { Link } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { REPORT_IMAGE_DAYS, type ReportRow } from '../ai/report';
import { translate } from '../i18n/core';
import { colors, font } from '../theme';
import { actOnReport, fetchReports } from './api';
import { dateTime, toolLabel } from './labels';
import { Failed, Loading } from './Shell';
import { Badge, Button, Card, Empty, Segmented } from './ui';
import { useLoad } from './useLoad';

/** "Báo cáo": AI results people flagged from the app, to review and close (or delete). */
export function ReportsTab({ refresh }: { refresh: number }) {
  const [status, setStatus] = useState<'open' | 'done'>('open');
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const { data, error, loading, reload } = useLoad(() => fetchReports(status, offset), [status, offset, refresh]);

  const act = async (r: ReportRow, action: 'done' | 'reopen' | 'delete') => {
    setBusy(r.id);
    try {
      await actOnReport(r.id, action);
      reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <Failed message={error} onRetry={reload} />;
  return (
    <View style={{ gap: 14 }}>
      <Segmented
        options={[
          { id: 'open', label: `Chưa xử lý${data ? ` (${data.open})` : ''}` },
          { id: 'done', label: `Đã xử lý${data ? ` (${data.done})` : ''}` },
        ]}
        value={status}
        onChange={(s) => {
          setStatus(s);
          setOffset(0);
        }}
      />
      <Text style={styles.note}>
        Khách bấm “Báo cáo” dưới kết quả AI trong app. Ảnh bị báo cáo tự xóa sau {REPORT_IMAGE_DAYS} ngày. Nếu nội dung vi phạm, khóa tài khoản ở tab Khách hàng.
      </Text>
      {loading && !data ? <Loading /> : null}
      {data && !data.reports.length ? <Empty text={status === 'open' ? 'Chưa có báo cáo nào cần xử lý.' : 'Chưa có báo cáo đã xử lý.'} /> : null}
      {data?.reports.map((r) => (
        <Card key={r.id} title={`#${r.id} · ${toolLabel(r.tool)}`} subtitle={dateTime(r.createdAt)} right={<Badge text={translate('vi', `report.reason.${r.reason}`)} tone="red" />}>
          <View style={styles.body}>
            {r.image ? (
              <Image source={{ uri: `data:image/jpeg;base64,${r.image}` }} style={styles.image} resizeMode="contain" />
            ) : (
              <View style={[styles.image, styles.noImage]}>
                <Text style={styles.noImageText}>{r.tool === 'video' ? 'Video (không lưu)' : 'Không có ảnh'}</Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 220, gap: 6 }}>
              <Text style={styles.label}>Người báo cáo</Text>
              {r.userId ? (
                <Link href={`/admin/user/${r.userId}`} style={styles.link}>
                  {r.email ?? `#${r.userId}`}
                </Link>
              ) : (
                <Text style={styles.value}>Khách (chưa đăng nhập)</Text>
              )}
              {r.note ? (
                <>
                  <Text style={styles.label}>Ghi chú của khách</Text>
                  <Text style={styles.value}>{r.note}</Text>
                </>
              ) : null}
              {r.prompt ? (
                <>
                  <Text style={styles.label}>Yêu cầu gửi cho AI</Text>
                  <Text style={styles.value}>{r.prompt}</Text>
                </>
              ) : null}
              <View style={styles.buttons}>
                {r.status === 'open' ? (
                  <Button label="Đã xử lý" icon="checkmark" onPress={() => act(r, 'done')} disabled={busy === r.id} />
                ) : (
                  <Button label="Mở lại" icon="refresh" tone="plain" onPress={() => act(r, 'reopen')} disabled={busy === r.id} />
                )}
                <Button label="Xóa" icon="trash-outline" tone="red" onPress={() => act(r, 'delete')} disabled={busy === r.id} />
              </View>
            </View>
          </View>
        </Card>
      ))}
      {data && (offset > 0 || data.reports.length === data.pageSize) ? (
        <View style={styles.buttons}>
          <Button label="Trang trước" tone="plain" disabled={offset === 0} onPress={() => setOffset(Math.max(0, offset - data.pageSize))} />
          <Button label="Trang sau" tone="plain" disabled={data.reports.length < data.pageSize} onPress={() => setOffset(offset + data.pageSize)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: font.regular, fontSize: 13, color: colors.textSoft },
  body: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  image: { width: 220, height: 220, borderRadius: 12, backgroundColor: colors.surface2 },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  noImageText: { fontFamily: font.regular, fontSize: 12, color: colors.textMute },
  label: { fontFamily: font.semi, fontSize: 12, color: colors.textMute },
  value: { fontFamily: font.regular, fontSize: 14, color: colors.text },
  link: { fontFamily: font.medium, fontSize: 14, color: colors.goldDeep, textDecorationLine: 'underline' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
});
