import { modelInfo } from '../ai/models';
import { presetById } from '../develop/presets';
import { isMessageKey, translate } from '../i18n/core';
import { isTrackedEvent, trackedEvents } from './events';

/** Names and formats for the admin page, which is in Vietnamese only (it is for the team, not customers). */

const vi = (key: string, fallback: string) => (isMessageKey(key) ? translate('vi', key) : fallback);

export function toolLabel(tool: string) {
  if (!tool) return 'Không rõ (trước khi có thống kê)';
  if (tool === 'generate') return vi('generate.title', 'Tạo ảnh AI');
  if (tool === 'prompt') return 'Yêu cầu tự viết';
  if (tool === 'logo-edit') return 'Sửa logo bằng mô tả';
  if (tool === 'erase-brush') return 'Xóa vật thể (tô vùng / mô tả)';
  const [kind, id] = tool.split('.');
  if (kind === 'preset') return `Phép AI: ${vi(`aiPreset.${id}`, id)}`;
  if (kind === 'studio') return vi(`studio.${id}.title`, id);
  if (kind === 'blog') return { write: 'Blog: AI viết bài', topics: 'Blog: gợi ý chủ đề', image: 'Blog: AI vẽ ảnh' }[id] ?? `Blog: ${id}`;
  return tool;
}

export function errorLabel(error: string) {
  switch (error) {
    case 'blocked':
      return 'Bị bộ lọc nội dung chặn';
    case 'login_required':
      return 'Khách hết lượt miễn phí';
    case 'no_points':
      return 'Tài khoản hết điểm';
    case 'unexpected':
      return 'Lỗi không xác định (xem log server)';
    case '':
      return '';
    default:
      return vi(error, error);
  }
}

export const statusLabel = { ok: 'Thành công', error: 'Lỗi', denied: 'Hết lượt/điểm', blocked: 'Bị chặn' } as const;

export const reasonLabel = (reason: string) =>
  ({ referral: 'Mời bạn bè (người mời)', referred: 'Đăng ký bằng mã mời', share: 'Chia sẻ Facebook', admin: 'Quản trị viên tặng' })[reason] ?? reason;

export const sourceLabel = (source: string) => ({ fb: 'Link chia sẻ Facebook', link: 'Link mời' })[source] ?? source;

export function eventLabel(name: string, detail: string) {
  const base = isTrackedEvent(name) ? trackedEvents[name] : name;
  if (!detail) return base;
  if (name === 'preset_apply') return `${base}: ${detail === 'custom' ? 'công thức riêng' : (presetById(detail)?.name ?? detail)}`;
  return `${base}: ${detail}`;
}

export const modelName = (id: string) => modelInfo(id)?.name ?? id;

export const num = (n: number) => n.toLocaleString('vi-VN');

export const usd = (n: number) => `$${n.toFixed(2)}`;


export const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : '—');

const pad = (n: number) => String(n).padStart(2, '0');

/** "05/10/2026 14:32" in the admin's own clock. */
export function dateTime(t: number) {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function date(t: number) {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "2026-10-05" → "05/10". */
export const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function duration(sec: number) {
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d} ngày ${h} giờ` : h ? `${h} giờ ${m} phút` : `${m} phút`;
}

/** "€212,61" / "$5,00", the way Google Cloud shows a balance. */
export const money = (n: number, currency: 'EUR' | 'USD') =>
  `${currency === 'EUR' ? '€' : '$'}${n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "2026-12-31" ↔ "31/12/2026". */
export const isoToVn = (iso: string) => iso.split('-').reverse().join('/');
export function vnToIso(text: string) {
  const m = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso;
}
