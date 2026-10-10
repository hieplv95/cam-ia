import { apiFetch } from './account';
import type { TrackedEvent } from './admin/events';
import { presetById } from './develop/presets';

/**
 * Counts one use of a feature for the admin dashboard (fire and forget: never slows down or breaks the app).
 * Only the event name and an optional short detail are sent.
 */
export function track(name: TrackedEvent, detail?: string) {
  apiFetch('/api/track', { body: detail ? { name, detail } : { name } }).catch(() => {});
}

/** Built-in presets are counted by id; the user's own recipes all count as "custom" (their names stay on the phone). */
export const trackPreset = (id: string) => track('preset_apply', presetById(id) ? id : 'custom');
