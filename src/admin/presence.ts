/** Online tracking shared by the app (heartbeat), the server (recording) and the admin page (labels). */

/** The app says "still here" this often while it is on screen. */
export const HEARTBEAT_MS = 45_000;
/** Someone counts as online for this long after their last heartbeat. */
export const ONLINE_MS = 2 * 60_000;
/** A pause longer than this (app closed or in the background) starts a new visit. */
export const VISIT_GAP_MS = 5 * 60_000;

export const PLATFORMS = { web: 'Web', android: 'Android', ios: 'iPhone' } as const;
export type PresencePlatform = keyof typeof PLATFORMS;

/** Screens by the first part of their address ('' = home). Anything else is 'other'. */
export const SCREENS = {
  home: 'Trang chủ',
  ai: 'Tab AI',
  create: 'Chỉnh sửa',
  presets: 'Presets',
  profile: 'Hồ sơ',
  editor: 'Trình chỉnh ảnh',
  adjust: 'Chỉnh màu',
  retouch: 'Làm đẹp',
  studio: 'Studio AI',
  generate: 'Tạo ảnh AI',
  export: 'Xuất ảnh',
  admin: 'Trang quản trị',
  other: 'Khác',
} as const;
export type ScreenId = keyof typeof SCREENS;

/** "/editor?x=1" → 'editor', "/" → 'home', "/admin/user/3" → 'admin'. */
export function screenOf(pathname: unknown): ScreenId {
  if (typeof pathname !== 'string') return 'other';
  const first = pathname.split(/[?#]/)[0].split('/').filter(Boolean)[0] ?? 'home';
  return first in SCREENS ? (first as ScreenId) : 'other';
}
