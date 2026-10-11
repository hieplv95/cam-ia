import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { refreshAccount } from '../account';
import type { CreditPlan } from '../ai/credits';
import { imageModels } from '../ai/models';
import { colors, font } from '../theme';
import { fetchPlan, savePlan } from './api';
import { Failed, Loading } from './Shell';
import { Button, Card } from './ui';
import { useLoad } from './useLoad';

type Field = { key: string; label: string; hint: string; unit: string; get: (p: CreditPlan) => number };

const FIELDS: Field[] = [
  { key: 'monthlyPoints', label: 'Điểm mỗi tháng', hint: 'Cho mỗi tài khoản, làm mới ngày 1 hằng tháng', unit: 'điểm', get: (p) => p.monthlyPoints },
  { key: 'guestFreeTries', label: 'Lượt miễn phí cho khách', hint: 'Khách chưa có tài khoản, mọi model đều tính 1 lượt', unit: 'lượt', get: (p) => p.guestFreeTries },
  ...imageModels.map(
    (m): Field => ({
      key: `model:${m.id}`,
      label: `Mỗi ảnh ${m.name}`,
      hint: `Điểm trừ cho tài khoản (giá Google ~$${m.usd}/ảnh)`,
      unit: 'điểm',
      get: (p) => p.modelPoints[m.id] ?? m.points,
    }),
  ),
];

type Draft = Record<string, string>;
const toDraft = (p: CreditPlan): Draft => Object.fromEntries(FIELDS.map((f) => [f.key, String(f.get(p))]));
const fromDraft = (d: Draft): CreditPlan => ({
  monthlyPoints: Number(d.monthlyPoints || 0),
  guestFreeTries: Number(d.guestFreeTries || 0),
  modelPoints: Object.fromEntries(imageModels.map((m) => [m.id, Number(d[`model:${m.id}`] || 0)])),
});

/** Settings tab: monthly points for accounts, free tries for guests and how many points each model costs. */
export function PlanSettings({ refresh }: { refresh: number }) {
  const { data, error, reload, setData } = useLoad(fetchPlan, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (refresh) reload();
  }, [refresh, reload]);
  useEffect(() => {
    if (data) setDraft(toDraft(data.plan));
  }, [data]);

  if (error && !data) return <Failed message={error} onRetry={reload} />;
  if (!data || !draft) return <Loading />;

  const saved = toDraft(data.plan);
  const changed = FIELDS.some((f) => draft[f.key] !== saved[f.key]);
  const save = async () => {
    setMessage(null);
    setBusy(true);
    try {
      setData(await savePlan(fromDraft(draft)));
      setMessage({ text: 'Đã lưu. Áp dụng ngay, kể cả tháng này; các tháng trước giữ nguyên.', ok: true });
      refreshAccount();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Không lưu được.', ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Điểm AI" subtitle="Điểm hằng tháng của tài khoản, lượt dùng thử của khách và số điểm mỗi ảnh AI.">
      <View style={styles.grid}>
        {FIELDS.map((f) => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.label}>{f.label}</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={draft[f.key]}
                onChangeText={(v) => setDraft({ ...draft, [f.key]: v.replace(/[^0-9]/g, '').slice(0, 6) })}
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
        <Button label={busy ? 'Đang lưu…' : 'Lưu điểm AI'} icon="save-outline" onPress={save} disabled={busy || !changed} />
        {changed && <Button label="Hoàn tác" tone="plain" onPress={() => setDraft(saved)} disabled={busy} />}
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
    width: 100,
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
