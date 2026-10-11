import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { refreshAccount } from '../account';
import type { RewardPoints } from '../ai/credits';
import { colors, font } from '../theme';
import { fetchRewardPoints, saveRewardPoints } from './api';
import { Failed, Loading } from './Shell';
import { Button, Card } from './ui';
import { useLoad } from './useLoad';

const FIELDS: { key: keyof RewardPoints; label: string; hint: string; unit: string }[] = [
  { key: 'inviter', label: 'Người mời nhận', hint: 'Khi bạn bè đăng ký bằng mã mời của họ', unit: 'điểm' },
  { key: 'friend', label: 'Bạn được mời nhận', hint: 'Khi đăng ký bằng mã mời', unit: 'điểm' },
  { key: 'maxPerMonth', label: 'Tối đa lượt thưởng mời', hint: 'Mỗi người, mỗi tháng (người mời)', unit: 'lượt/tháng' },
  { key: 'share', label: 'Chia sẻ lên Facebook', hint: 'Khi có người khác mở link, mỗi tháng một lần. 0 = ẩn mục chia sẻ', unit: 'điểm' },
];

type Draft = Record<keyof RewardPoints, string>;
const toDraft = (p: RewardPoints): Draft => ({ inviter: String(p.inviter), friend: String(p.friend), maxPerMonth: String(p.maxPerMonth), share: String(p.share) });

/** Settings tab: how many bonus points invites and Facebook shares give. */
export function RewardSettings({ refresh }: { refresh: number }) {
  const { data, error, reload, setData } = useLoad(fetchRewardPoints, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (refresh) reload();
  }, [refresh, reload]);
  useEffect(() => {
    if (data) setDraft(toDraft(data.points));
  }, [data]);

  if (error && !data) return <Failed message={error} onRetry={reload} />;
  if (!data || !draft) return <Loading />;

  const changed = (Object.keys(draft) as (keyof RewardPoints)[]).some((k) => draft[k] !== String(data.points[k]));
  const save = async () => {
    setMessage(null);
    const points = Object.fromEntries((Object.keys(draft) as (keyof RewardPoints)[]).map((k) => [k, Number(draft[k] || 0)])) as RewardPoints;
    setBusy(true);
    try {
      setData(await saveRewardPoints(points));
      setMessage({ text: 'Đã lưu. Áp dụng cho các lượt thưởng từ bây giờ (điểm đã phát không đổi).', ok: true });
      // The admin's own app shows the new numbers right away.
      refreshAccount();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Không lưu được.', ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Điểm thưởng" subtitle="Số điểm khách nhận khi mời bạn bè và chia sẻ Cami. Điểm thưởng không hết hạn, dùng sau khi hết điểm tháng.">
      <View style={styles.grid}>
        {FIELDS.map((f) => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.label}>{f.label}</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={draft[f.key]}
                onChangeText={(v) => setDraft({ ...draft, [f.key]: v.replace(/[^0-9]/g, '').slice(0, 4) })}
                keyboardType="number-pad"
                accessibilityLabel={f.label}
                style={styles.input}
              />
              <Text style={styles.unit}>{f.unit}</Text>
            </View>
            <Text style={styles.hint}>{f.hint}</Text>
          </View>
        ))}
      </View>
      {message ? (
        <Text accessibilityRole="alert" style={[styles.message, { color: message.ok ? '#2E9E6A' : colors.danger }]}>
          {message.text}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button label={busy ? 'Đang lưu…' : 'Lưu điểm thưởng'} icon="save-outline" onPress={save} disabled={busy || !changed} />
        {changed && <Button label="Hoàn tác" tone="plain" onPress={() => setDraft(toDraft(data.points))} disabled={busy} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { flexGrow: 1, flexBasis: 200, gap: 5 },
  label: { fontFamily: font.semi, fontSize: 12.5, color: colors.text },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    width: 90,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    fontFamily: font.semi,
    fontSize: 15,
    color: colors.text,
  },
  unit: { fontFamily: font.regular, fontSize: 13, color: colors.textSoft },
  hint: { fontFamily: font.regular, fontSize: 11.5, color: colors.textMute },
  message: { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10 },
});
