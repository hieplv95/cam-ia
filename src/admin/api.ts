import { apiFetch } from '../account';
import type { CreditPlan, RewardPoints } from '../ai/credits';
import type { AiSettings, NewSource, OnlineNow, Overview, SystemInfo, TestResult, Traffic, TrafficPeriod, UserDetail, UserList, UserSort } from './types';

/** Calls to /api/admin/* with the signed-in session; failures throw with the server's message. */
async function call<T>(path: string, body?: unknown): Promise<T> {
  const { ok, data } = await apiFetch(path, body ? { body } : {});
  if (!ok) throw new Error(data?.error ?? 'Không tải được dữ liệu.');
  return data as T;
}

export const fetchOverview = (days: number) => call<Overview>(`/api/admin/stats?days=${days}`);
export const fetchSystem = () => call<SystemInfo>('/api/admin/system');
export const fetchTraffic = (period: TrafficPeriod, range?: { from: string; to: string }) =>
  call<Traffic>(`/api/admin/traffic?period=${period}${period === 'custom' && range ? `&from=${range.from}&to=${range.to}` : ''}`);
export const fetchOnline = () => call<OnlineNow>('/api/admin/traffic?live=1');
export const fetchUsers = (q: string, sort: UserSort, offset = 0) =>
  call<UserList>(`/api/admin/users?q=${encodeURIComponent(q)}&sort=${sort}&offset=${offset}`);
export const fetchUser = (id: number) => call<UserDetail>(`/api/admin/users/${id}`);
export const grantBonus = (id: number, points: number, note: string) => call<UserDetail>(`/api/admin/users/${id}`, { action: 'bonus', points, note });
export const setLocked = (id: number, locked: boolean) => call<UserDetail>(`/api/admin/users/${id}`, { action: locked ? 'lock' : 'unlock' });

/* ---------- AI sources ---------- */

export type AiReply = { settings: AiSettings; ok?: string; tests?: TestResult[] };

export const fetchAi = () => call<AiReply>('/api/admin/ai');

/** One change on the Settings tab (see app/api/admin/ai+api.ts for the actions). */
export const aiAction = (action: string, body: Record<string, unknown> = {}) => call<AiReply>('/api/admin/ai', { action, ...body });

export type { NewSource };

/* ---------- Reward amounts ---------- */

export const fetchRewardPoints = () => call<{ points: RewardPoints }>('/api/admin/rewards');
export const saveRewardPoints = (points: RewardPoints) => call<{ points: RewardPoints }>('/api/admin/rewards', points);

/* ---------- Points plan ---------- */

export const fetchPlan = () => call<{ plan: CreditPlan }>('/api/admin/plan');
export const savePlan = (plan: CreditPlan) => call<{ plan: CreditPlan }>('/api/admin/plan', plan);
