import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { DEFAULT_PLAN, DEFAULT_REWARD_POINTS, type AccountUser, type CreditPlan, type Credits, type RewardPoints, type Rewards } from './ai/credits';
import { getLanguage, t } from './i18n';

/**
 * The signed-in account and remaining AI use, as told by the server (which is the only one enforcing them).
 * The app keeps a session token and a random device id; both go with every API request.
 */

// Empty means "same origin": expo-router resolves relative URLs against the dev server or the `origin` in app.json.
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';
const APP_TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN ?? '';

const TOKEN_KEY = 'cami-session';
const DEVICE_KEY = 'cami-device';
const REF_KEY = 'cami-invite';

/**
 * admin: the account may open the admin page (its email is in the server's ADMIN_EMAILS).
 * rewardPoints / plan: invite and share bonuses, monthly points, free tries and points per model,
 * as currently set on the admin page (defaults until the server answers).
 */
type State = { ready: boolean; user: AccountUser | null; credits: Credits | null; admin: boolean; rewardPoints: RewardPoints; plan: CreditPlan };
let state: State = { ready: false, user: null, credits: null, admin: false, rewardPoints: DEFAULT_REWARD_POINTS, plan: DEFAULT_PLAN };
let token: string | null = null;
const listeners = new Set<(s: State) => void>();

const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
};

const randomId = () => Array.from({ length: 24 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');

/** Loads the stored session and device id once, at startup. */
const loaded = (async () => {
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!(await AsyncStorage.getItem(DEVICE_KEY))) await AsyncStorage.setItem(DEVICE_KEY, randomId());
  } catch {
    // Storage blocked (private browsing): the server falls back to the IP for guests.
  }
})();

async function headers(): Promise<Record<string, string>> {
  await loaded;
  const device = await AsyncStorage.getItem(DEVICE_KEY).catch(() => null);
  return {
    'content-type': 'application/json',
    'x-cami-lang': getLanguage(),
    ...(APP_TOKEN ? { 'x-app-token': APP_TOKEN } : {}),
    ...(device ? { 'x-cami-device': device } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

/** fetch() to the app's API with the session and device headers; returns the parsed JSON body. */
export async function apiFetch(path: string, init: { method?: string; body?: unknown } = {}) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: await headers(),
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new Error(t('common.noNetwork'));
  }
  const data = await res.json().catch(() => ({}));
  if (data?.credits) set({ credits: data.credits });
  return { ok: res.ok, status: res.status, data };
}

async function storeSession(next: string | null) {
  token = next;
  if (next) await AsyncStorage.setItem(TOKEN_KEY, next).catch(() => {});
  else await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}

export async function refreshAccount() {
  const { ok, data } = await apiFetch('/api/account').catch(() => ({ ok: false, data: null }));
  if (!ok || !data) {
    set({ ready: true });
    return;
  }
  // A token the server no longer knows (expired, account deleted) is dropped.
  if (token && !data.user) await storeSession(null);
  set({ ready: true, user: data.user, credits: data.credits, admin: !!data.admin, ...(data.rewardPoints && { rewardPoints: data.rewardPoints }), ...(data.plan && { plan: data.plan }) });
}

async function authenticate(path: string, body: Record<string, string>) {
  const { ok, data } = await apiFetch(path, { body });
  if (!ok) throw new Error(data?.error ?? t('auth.failed'));
  await storeSession(data.token);
  set({ user: data.user, credits: data.credits });
  refreshAccount();
  return { user: data.user as AccountUser, referralBonus: (data.referralBonus as number | undefined) ?? 0 };
}

export async function signUp(email: string, password: string, name: string, ref: string) {
  const out = await authenticate('/api/auth/register', { email, password, name, ref });
  await AsyncStorage.removeItem(REF_KEY).catch(() => {});
  return out;
}
export const signIn = (email: string, password: string) => authenticate('/api/auth/login', { email, password });

export async function signOut() {
  await apiFetch('/api/auth/logout', { body: {} }).catch(() => {});
  await storeSession(null);
  set({ user: null, credits: null, admin: false });
  await refreshAccount();
}

export async function deleteAccount(password: string) {
  const { ok, data } = await apiFetch('/api/account', { method: 'DELETE', body: { password } });
  if (!ok) throw new Error(data?.error ?? t('auth.deleteFailed'));
  await storeSession(null);
  set({ user: null, credits: null, admin: false });
  await refreshAccount();
}

/** Current account state outside React (e.g. right after refreshAccount). */
export const accountState = () => state;

export function useAccount() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    if (!state.ready) refreshAccount();
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

/** "Còn 2/3 lượt miễn phí" / "Còn 87 điểm tháng này". */
export function creditsLabel(c: Credits | null) {
  if (!c) return null;
  return c.kind === 'guest' ? t('credits.guestLeft', { left: c.left, limit: c.limit }) : t('credits.memberLeft', { n: c.left });
}

/* ---------- Invites and share rewards ---------- */

/** Public address of the app, used in invite links (set EXPO_PUBLIC_SHARE_URL to the real domain). */
export function shareBaseUrl() {
  if (process.env.EXPO_PUBLIC_SHARE_URL) return process.env.EXPO_PUBLIC_SHARE_URL.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return 'https://cami.expo.app';
}

/** Link with the user's code; `source` tags where it was posted (e.g. 'fb'), so visits from there can be rewarded. */
export const inviteLink = (code: string, source?: string) => `${shareBaseUrl()}/?ref=${code}${source ? `&s=${source}` : ''}`;

/**
 * An invite code from the link the app was opened with (web ?ref=…, or cami://?ref=… on phones), kept until sign-up.
 * Returns the code only the first time it is seen, so the sign-up sheet opens once per invite; that first time the
 * visit is also reported, which is how a link shared on Facebook earns its owner points.
 */
export async function takeInviteFromLink(): Promise<string | null> {
  let url: string | null = null;
  if (Platform.OS === 'web') url = typeof window !== 'undefined' ? window.location.href : null;
  else url = await Linking.getInitialURL().catch(() => null);
  const params = url ? Linking.parse(url).queryParams : null;
  const ref = params?.ref;
  const code = typeof ref === 'string' ? ref.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16) : '';
  if (!code) return null;
  const known = await AsyncStorage.getItem(REF_KEY).catch(() => null);
  await AsyncStorage.setItem(REF_KEY, code).catch(() => {});
  if (known === code) return null;
  const source = typeof params?.s === 'string' ? params.s : '';
  apiFetch('/api/rewards', { body: { ref: code, source } }).catch(() => {});
  return code;
}

export const pendingInvite = () => AsyncStorage.getItem(REF_KEY).catch(() => null);

export async function getRewards(): Promise<Rewards> {
  const { ok, data } = await apiFetch('/api/rewards');
  if (!ok) throw new Error(data?.error ?? t('rewards.loadFailed'));
  return data.rewards;
}

/* ---------- Sign-in sheet, opened from anywhere ---------- */

type AuthRequest = { reason?: string; mode?: 'login' | 'register' };
let openAuthHandler: ((r: AuthRequest) => void) | null = null;

export const setAuthHandler = (h: typeof openAuthHandler) => {
  openAuthHandler = h;
};

/** Shows the sign-in / sign-up sheet, e.g. when the free tries run out. */
export const openAuth = (r: AuthRequest = {}) => openAuthHandler?.(r);
