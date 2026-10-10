/**
 * Features that run on the phone (no AI), counted per day for the admin dashboard.
 * Only the event name (and for some, which preset or app) is sent: no photo, no account, no device details.
 * Shared by the app and the server, so it must not import device APIs. Labels are for the admin page (Vietnamese).
 */
export const trackedEvents = {
  app_open: 'Mở app',
  photo_library: 'Chọn ảnh từ thư viện',
  photo_camera: 'Chụp ảnh mới',
  canvas_create: 'Tạo canvas trống',
  draft_resume: 'Mở lại bản nháp',
  preset_apply: 'Áp dụng preset màu',
  recipe_save: 'Lưu công thức màu',
  export_save: 'Lưu ảnh về máy',
  export_share: 'Chia sẻ ảnh',
  export_app: 'Gửi ảnh sang app khác',
  invite_share: 'Gửi lời mời bạn bè',
  invite_whatsapp: 'Mời qua WhatsApp',
  fb_share: 'Chia sẻ Cami lên Facebook',
} as const;

export type TrackedEvent = keyof typeof trackedEvents;

export const isTrackedEvent = (v: unknown): v is TrackedEvent => typeof v === 'string' && Object.prototype.hasOwnProperty.call(trackedEvents, v);

/** Events that carry a detail: which preset, which app. Others never do. */
const withDetail: TrackedEvent[] = ['preset_apply', 'export_app'];

/** The detail kept for an event: short and plain (an id), so nothing personal can be smuggled in. */
export const eventDetail = (name: TrackedEvent, v: unknown) => (withDetail.includes(name) && typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : '');
