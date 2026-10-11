import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Dialog } from '../Dialog';
import { colors, font } from '../theme';
import { aiAction, fetchAi, type AiReply } from './api';
import { dateTime } from './labels';
import { PlanSettings } from './PlanSettings';
import { RewardSettings } from './RewardSettings';
import { Failed, Loading } from './Shell';
import type { Credit, Currency, NewSource, SourceView } from './types';
import { Badge, Button, Card, Empty, Segmented } from './ui';
import { useLoad } from './useLoad';

type Run = (action: string, body?: Record<string, unknown>) => Promise<boolean>;
const money = (n: number, currency: Currency) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(n);
const authLabel = { adc: 'Đăng nhập gcloud trên máy chủ', key: 'File khóa service account', file: 'File khóa trên máy chủ', apikey: 'API key AI Studio' };

/** Manage fallback AI accounts using the existing encrypted server settings. */
export function SettingsTab({ refresh }: { refresh: number }) {
  const { data, error, reload, setData } = useLoad(fetchAi, []);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [tests, setTests] = useState<AiReply['tests']>();
  const [reset, setReset] = useState(false);
  useEffect(() => { if (refresh && !lock.current) reload(); }, [refresh, reload]);

  const run: Run = async (action, body = {}) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setMessage('');
    setTests(undefined);
    try {
      const reply = await aiAction(action, body);
      setData(reply);
      setTests(reply.tests);
      setMessage(reply.ok ?? (reply.tests ? '' : 'Đã lưu thay đổi.'));
      setFailed(false);
      return !reply.tests?.some((t) => !t.ok);
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : 'Không lưu được thay đổi.');
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  if (!data) return error ? <Failed message={error} onRetry={reload} /> : <Loading />;
  const s = data.settings;
  return (
    <View style={styles.stack}>
      <PlanSettings refresh={refresh} />
      <RewardSettings refresh={refresh} />
      <Card title="Tài khoản & API key" subtitle={`App dùng lần lượt từ trên xuống: nguồn bị tắt, lỗi hoặc hết credit sẽ chuyển sang nguồn kế tiếp.${s.updatedAt ? ` Cập nhật lần cuối ${dateTime(s.updatedAt)}.` : ''}`} right={<Badge text={s.origin === 'admin' ? 'Cấu hình đã lưu' : 'Đang dùng .env'} />}>
        {!s.secretReady && <Text style={styles.warning}>Đặt CAMI_SECRET tối thiểu 16 ký tự trên máy chủ để lưu khóa của tài khoản phụ.</Text>}
        {error ? <Text style={styles.warning}>{error}</Text> : null}
        {message ? <Text accessibilityRole="alert" style={failed ? styles.warning : styles.notice}>{message}</Text> : null}
        {busy && <Text style={styles.soft}>Đang xử lý…</Text>}
        {tests?.map((t) => <Text key={t.id} style={t.ok ? styles.notice : styles.warning}>{t.name}: {t.message}</Text>)}
        {tests && <Text style={styles.soft}>Kiểm tra xác nhận kết nối và quyền truy cập model, không xác nhận số dư credit thật.</Text>}
        <View pointerEvents={busy ? 'none' : 'auto'} style={[styles.stack, busy && { opacity: 0.6 }]}>
          {s.sources.length ? s.sources.map((source, i) => <SourceCard key={source.id} source={source} index={i} total={s.sources.length} run={run} />) : <Empty text="Chưa có nguồn AI. Thêm tài khoản hoặc API key bên dưới." />}
          <Button label="Kiểm tra kết nối tất cả nguồn" onPress={() => void run('test-all')} disabled={busy || !s.sources.length} />
          <Card title="Thêm nguồn" subtitle="Tài khoản Google Cloud phụ: bật Vertex AI API, tạo service account có vai trò Vertex AI User và tải file khóa .json.">
            <AddSource run={run} busy={busy} secretReady={s.secretReady} />
          </Card>
          <Location key={s.location} location={s.location} run={run} />
          {s.origin === 'admin' && <Button label="Bỏ cấu hình trên web, dùng lại .env" tone="red" onPress={() => setReset(true)} disabled={busy} />}
        </View>
      </Card>
      <Dialog visible={reset} title="Dùng lại cấu hình .env?" message="Danh sách nguồn đã lưu trên trang này sẽ bị xóa. App quay lại dùng nguồn trong .env của máy chủ." onClose={() => setReset(false)} actions={[{ label: 'Hủy', onPress: () => setReset(false) }, { label: 'Dùng lại .env', destructive: true, onPress: () => { setReset(false); void run('reset'); } }]} />
    </View>
  );
}

function SourceCard({ source: s, index, total, run }: { source: SourceView; index: number; total: number; run: Run }) {
  const [rename, setRename] = useState(false);
  const [label, setLabel] = useState(s.label);
  const [remove, setRemove] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const c = s.credit, state = s.creditState;
  const status = !s.enabled ? 'Đang tắt' : s.broken ? 'Khóa không đọc được' : state?.exhausted ? 'Hết credit' : s.retryInSeconds ? `Tạm nghỉ ${Math.ceil(s.retryInSeconds / 60)} phút` : 'Sẵn sàng';
  const tone = !s.enabled ? 'plain' : s.broken || state?.exhausted ? 'red' : s.retryInSeconds ? 'gold' : 'green';
  const pct = c && state ? Math.min(100, Math.max(0, c.amount > 0 ? state.spent / c.amount * 100 : 100)) : 0;
  return (
    <View style={styles.source}>
      <View style={styles.row}>
        <Text style={styles.order}>{index + 1}</Text>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={styles.name}>{s.name}</Text>
          <View style={styles.row}><Badge text={s.kind === 'vertex' ? 'Vertex AI' : 'AI Studio'} /><Badge text={status} tone={tone} /></View>
          <Text style={styles.soft}>{s.kind === 'vertex' ? `${s.project} · ${authLabel[s.auth]}${s.keyEmail ? ` (${s.keyEmail})` : ''}` : `API key ${s.hint ?? ''}`}</Text>
        </View>
      </View>
      {s.broken && <Text style={styles.warning}>{s.broken}</Text>}
      {c && state ? <View style={styles.stack}>
        <Text style={styles.balance}>{money(Math.max(0, state.remaining), c.currency)} <Text style={styles.soft}>còn lại / {money(c.amount, c.currency)}</Text></Text>
        <View style={styles.track}><View style={{ height: 6, width: `${pct}%`, backgroundColor: state.exhausted ? colors.danger : colors.gold }} /></View>
        <Text style={styles.soft}>Đã dùng qua app ~{money(state.spent, c.currency)} kể từ {dateTime(c.since)}{c.expires ? ` · Hết hạn ${c.expires}` : ''}{c.reserve ? ` · Dừng khi còn ${money(c.reserve, c.currency)}` : ''}</Text>
      </View> : <Text style={styles.soft}>Chưa nhập credit: dùng nguồn này tới khi Google báo hết tiền.</Text>}
      <Toggle label={c ? 'Cập nhật số dư' : 'Nhập credit'} open={creditOpen} onPress={() => setCreditOpen(!creditOpen)} />
      {creditOpen && <CreditForm key={c?.since ?? 0} initial={c} onSave={async (credit) => { if (await run('credit', { id: s.id, credit })) setCreditOpen(false); }} />}
      <View style={styles.row}>
        <Button label="↑" onPress={() => void run('move', { id: s.id, dir: -1 })} disabled={index === 0} />
        <Button label="↓" onPress={() => void run('move', { id: s.id, dir: 1 })} disabled={index === total - 1} />
        <Button label={s.enabled ? 'Tạm tắt' : 'Bật lại'} onPress={() => void run('enable', { id: s.id, enabled: !s.enabled })} />
        <Button label="Đổi tên" onPress={() => { setLabel(s.label); setRename(true); }} />
        {s.kind === 'vertex' && <Button label="Số dư thật ↗" onPress={() => void Linking.openURL(`https://console.cloud.google.com/billing/linkedaccount?project=${encodeURIComponent(s.project ?? '')}`)} />}
        <Button label="Xóa" tone="red" onPress={() => setRemove(true)} />
      </View>
      <Dialog visible={rename} title="Đổi tên nguồn" input={{ value: label, onChange: setLabel, placeholder: 'VD: Tài khoản phụ 1' }} onClose={() => setRename(false)} actions={[{ label: 'Hủy', onPress: () => setRename(false) }, { label: 'Lưu', primary: true, onPress: () => { setRename(false); void run('label', { id: s.id, label }); } }]} />
      <Dialog visible={remove} title="Xóa nguồn AI?" message={`Xóa "${s.name}" khỏi danh sách? App sẽ dùng những nguồn còn lại.`} onClose={() => setRemove(false)} actions={[{ label: 'Hủy', onPress: () => setRemove(false) }, { label: 'Xóa nguồn', destructive: true, onPress: () => { setRemove(false); void run('remove', { id: s.id }); } }]} />
    </View>
  );
}

function AddSource({ run, busy, secretReady }: { run: Run; busy: boolean; secretReady: boolean }) {
  const [kind, setKind] = useState<'vertex' | 'studio'>('vertex');
  const [auth, setAuth] = useState<'key' | 'adc'>('key');
  const [label, setLabel] = useState('');
  const [project, setProject] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [keyJson, setKeyJson] = useState('');
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const [creditOpen, setCreditOpen] = useState(false);
  const [credit, setCredit] = useState<CreditDraft>(emptyCredit);
  const [picking, setPicking] = useState(false);
  const pick = async () => {
    try {
      setError('');
      setPicking(true);
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true, base64: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.name.toLowerCase().endsWith('.json') || (asset.size ?? 0) > 64 * 1024) throw new Error('Chọn file khóa .json dưới 64 KB.');
      let text: string;
      if (Platform.OS === 'web' && asset.file) {
        text = await asset.file.text();
      } else {
        const file = new File(asset.uri);
        try { text = await file.text(); } finally { file.delete(); }
      }
      if (text.length > 64 * 1024) throw new Error('File khóa quá lớn.');
      const key = JSON.parse(text);
      if (key.type !== 'service_account' || !key.client_email || !key.private_key) throw new Error('Cần file .json của service account Google Cloud.');
      setKeyJson(text);
      setFilename(asset.name);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không đọc được file.'); }
    finally { setPicking(false); }
  };
  const submit = async (action: 'test' | 'add') => {
    try {
      setError('');
      if (kind === 'vertex' && auth === 'key' && !keyJson) throw new Error('Chọn file khóa service account trước.');
      const source: NewSource = { kind, label, ...(kind === 'vertex' ? { project, ...(auth === 'key' ? { keyJson } : {}) } : { apiKey }), ...(creditOpen && credit.amount.trim() ? { credit: toCredit(credit) } : {}) };
      if (await run(action, { source }) && action === 'add') {
        setLabel(''); setProject(''); setApiKey(''); setKeyJson(''); setFilename(''); setCredit(emptyCredit); setCreditOpen(false);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Dữ liệu không hợp lệ.'); }
  };
  return <View style={styles.stack}>
    <Segmented options={[{ id: 'vertex', label: 'Google Cloud' }, { id: 'studio', label: 'API key AI Studio' }]} value={kind} onChange={setKind} />
    <Field label="Tên gợi nhớ" value={label} onChange={setLabel} placeholder="VD: Tài khoản phụ 1" maxLength={40} />
    {kind === 'vertex' ? <>
      <Segmented options={[{ id: 'key', label: 'File khóa .json' }, { id: 'adc', label: 'Gcloud máy chủ' }]} value={auth} onChange={setAuth} />
      <Text style={styles.soft}>{auth === 'key' ? 'Mỗi tài khoản phụ dùng file khóa service account riêng.' : 'Dùng tài khoản gcloud đã đăng nhập trên máy chủ.'}</Text>
      {auth === 'key' && <Button label={filename || 'Chọn file khóa (.json)'} icon="document-attach-outline" onPress={() => void pick()} disabled={picking || busy} />}
      <Field label="Project ID" value={project} onChange={setProject} placeholder={auth === 'key' ? 'Để trống = lấy theo file khóa' : 'VD: my-google-project'} />
    </> : <Field label="API key" value={apiKey} onChange={setApiKey} placeholder="AIza…" secure />}
    <Toggle label="Credit của nguồn này (không bắt buộc)" open={creditOpen} onPress={() => setCreditOpen(!creditOpen)} />
    {creditOpen && <CreditFields value={credit} onChange={setCredit} />}
    {error ? <Text accessibilityRole="alert" style={styles.warning}>{error}</Text> : null}
    <View style={styles.row}>
      <Button label="Kiểm tra" onPress={() => void submit('test')} disabled={busy || picking} />
      <Button label="Thêm nguồn" tone="gold" onPress={() => void submit('add')} disabled={busy || picking || !secretReady} />
    </View>
  </View>;
}

type CreditDraft = { amount: string; currency: Currency; expires: string; reserve: string };
const emptyCredit: CreditDraft = { amount: '', currency: 'EUR', expires: '', reserve: '' };
function toCredit(v: CreditDraft): Omit<Credit, 'since'> {
  const amount = Number(v.amount.replace(',', '.')), reserve = v.reserve.trim() ? Number(v.reserve.replace(',', '.')) : 0;
  if (!v.amount.trim() || !Number.isFinite(amount) || amount < 0 || amount > 1_000_000) throw new Error('Số dư phải từ 0 đến 1.000.000.');
  if (!Number.isFinite(reserve) || reserve < 0) throw new Error('Mức dự phòng không hợp lệ.');
  const expires = v.expires.trim();
  if (expires && (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || new Date(`${expires}T00:00:00Z`).toISOString().slice(0, 10) !== expires)) throw new Error('Ngày hết hạn cần đúng dạng YYYY-MM-DD.');
  return { amount, currency: v.currency, ...(expires ? { expires } : {}), ...(reserve ? { reserve } : {}) };
}
function CreditFields({ value: v, onChange }: { value: CreditDraft; onChange: (v: CreditDraft) => void }) {
  return <View style={styles.stack}>
    <Field label="Số dư hiện tại" value={v.amount} onChange={(amount) => onChange({ ...v, amount })} placeholder="VD: 257,00" decimal />
    <Segmented options={[{ id: 'EUR', label: 'EUR (€)' }, { id: 'USD', label: 'USD ($)' }]} value={v.currency} onChange={(currency) => onChange({ ...v, currency })} />
    <Field label="Ngày hết hạn (không bắt buộc)" value={v.expires} onChange={(expires) => onChange({ ...v, expires })} placeholder="YYYY-MM-DD" />
    <Field label="Dừng khi số dư còn dưới" value={v.reserve} onChange={(reserve) => onChange({ ...v, reserve })} placeholder="Không bắt buộc" decimal />
    <Text style={styles.soft}>Chép số dư thật từ Google Cloud. App trừ chi phí ước tính từ lúc lưu; cập nhật định kỳ để khớp số dư thật.</Text>
  </View>;
}
function CreditForm({ initial, onSave }: { initial?: Credit; onSave: (credit: Omit<Credit, 'since'> | null) => Promise<void> }) {
  const [v, setV] = useState<CreditDraft>({ ...emptyCredit, currency: initial?.currency ?? 'EUR', expires: initial?.expires ?? '', reserve: initial?.reserve?.toString() ?? '' });
  const [error, setError] = useState('');
  return <View style={styles.stack}>
    <CreditFields value={v} onChange={setV} />
    {error ? <Text style={styles.warning}>{error}</Text> : null}
    <View style={styles.row}>
      <Button label="Lưu số dư" tone="gold" onPress={() => { try { const c = toCredit(v); setError(''); void onSave(c); } catch (e) { setError(e instanceof Error ? e.message : 'Số dư không hợp lệ.'); } }} />
      {initial && <Button label="Bỏ theo dõi credit" onPress={() => void onSave(null)} />}
    </View>
  </View>;
}
function Location({ location, run }: { location: string; run: Run }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(location);
  return <View style={styles.stack}>
    <Toggle label={`Khu vực AI: ${location}`} open={open} onPress={() => setOpen(!open)} />
    {open && <><Field label="Khu vực" value={value} onChange={setValue} placeholder="global" /><Button label="Lưu khu vực" onPress={() => void run('location', { location: value })} /></>}
  </View>;
}
function Toggle({ label, open, onPress }: { label: string; open: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.toggle}><Text style={styles.toggleText}>{open ? '▾' : '▸'} {label}</Text></Pressable>;
}
function Field({ label, value, onChange, placeholder, secure, decimal, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; secure?: boolean; decimal?: boolean; maxLength?: number }) {
  return <View style={{ gap: 5 }}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textSoft} secureTextEntry={secure} autoCapitalize="none" autoCorrect={false} autoComplete="off" keyboardType={decimal ? 'decimal-pad' : 'default'} maxLength={maxLength} style={styles.input} /></View>;
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  source: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 12 },
  order: { fontFamily: font.semi, color: colors.goldDeep, backgroundColor: colors.goldSoft, borderRadius: 18, padding: 10 },
  name: { fontFamily: font.semi, fontSize: 15, color: colors.text },
  soft: { fontFamily: font.regular, fontSize: 12, color: colors.textSoft, lineHeight: 18 },
  balance: { fontFamily: font.serif, fontSize: 24, color: colors.text },
  track: { height: 6, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  warning: { fontFamily: font.regular, fontSize: 13, color: colors.danger, lineHeight: 20 },
  notice: { fontFamily: font.regular, fontSize: 13, color: '#2E9E6A', lineHeight: 20 },
  toggle: { paddingVertical: 12 },
  toggleText: { fontFamily: font.medium, fontSize: 13, color: colors.goldDeep },
  fieldLabel: { fontFamily: font.semi, fontSize: 12.5, color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: colors.text, fontFamily: font.regular, fontSize: 14, backgroundColor: colors.surface },
});
