import { createHash, randomBytes } from 'node:crypto';

import type { Credit, CreditState, Currency, NewSource, SourceAuth } from '../admin/types';
import { db, getSetting, setSetting } from './db';
import { decrypt, encrypt } from './secret';
import { dayOf } from './time';

/**
 * AI sources (Google Cloud), tried in order by the AI route: Vertex AI projects (main account, spare accounts…)
 * and Google AI Studio API keys. The admin manages them on the Settings tab; until something is saved there,
 * they are read from .env as before (GOOGLE_CLOUD_PROJECT, GEMINI_API_KEY, GOOGLE_CLOUD_LOCATION).
 * Service-account keys and API keys are encrypted before they are stored (see secret.ts).
 * Each source may carry its credit: the balance copied from Google Cloud, minus what the app spent since then.
 */

export type ServiceAccount = { client_email: string; private_key: string; project_id?: string };

/** A source ready to call (secrets decrypted; server only). */
export type RuntimeSource = {
  id: string;
  name: string;
  kind: 'vertex' | 'studio';
  enabled: boolean;
  location: string;
  project?: string;
  credentials?: ServiceAccount;
  keyFilename?: string;
  apiKey?: string;
  credit?: Credit;
  /** Why the source can't be used (its stored key can't be decrypted); it is then skipped. */
  broken?: string;
};

/** `version` changes whenever the configuration does, so callers know when to rebuild their clients. */
export type AiSources = { origin: 'admin' | 'env'; version: string; location: string; sources: RuntimeSource[] };

type StoredSource = {
  id: string;
  label: string;
  kind: 'vertex' | 'studio';
  enabled: boolean;
  project?: string;
  keyEnc?: string;
  keyEmail?: string;
  /** Path of a key file on the server (imported from .env). */
  keyFilename?: string;
  apiKeyEnc?: string;
  hint?: string;
  credit?: Credit;
};

type StoredAi = { v: 1; location: string; sources: StoredSource[]; updatedAt: number };

const AI_KEY = 'ai_sources';
export const DEFAULT_LOCATION = 'global';
export const MAX_SOURCES = 12;
/** Google Cloud credit is often in EUR while model prices are in USD. */
export const USD_TO_EUR = 0.86;

const list = (v?: string) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
export const keyHint = (key: string) => `…${key.slice(-4)}`;
const newId = () => randomBytes(4).toString('hex');

/** Display name: the admin's label, otherwise the project or the end of the API key. */
export const sourceName = (s: Pick<StoredSource, 'label' | 'kind' | 'project' | 'hint'>) =>
  s.label || (s.kind === 'vertex' ? (s.project ?? 'Vertex AI') : `API key ${s.hint ?? ''}`);

export const authOf = (s: Pick<StoredSource, 'kind' | 'keyEnc' | 'keyFilename'>): SourceAuth =>
  s.kind === 'studio' ? 'apikey' : s.keyEnc ? 'key' : s.keyFilename ? 'file' : 'adc';

function readStored(): StoredAi | null {
  const raw = getSetting(AI_KEY);
  return raw ? (JSON.parse(raw) as StoredAi) : null;
}

function writeStored(s: StoredAi) {
  setSetting(AI_KEY, JSON.stringify({ ...s, updatedAt: Date.now() }));
}

/** Sources declared in .env, in the stored shape (secrets not included). */
function envStored(): StoredAi {
  return {
    v: 1,
    location: process.env.GOOGLE_CLOUD_LOCATION || DEFAULT_LOCATION,
    updatedAt: 0,
    sources: [
      ...list(process.env.GOOGLE_CLOUD_PROJECT).map((entry): StoredSource => {
        const [project, keyFilename] = entry.split('@');
        return { id: `env-${project}`, label: '', kind: 'vertex', enabled: true, project, ...(keyFilename && { keyFilename }) };
      }),
      ...list(process.env.GEMINI_API_KEY).map((k, i): StoredSource => ({ id: `env-key-${i + 1}`, label: '', kind: 'studio', enabled: true, hint: keyHint(k) })),
    ],
  };
}

function toRuntime(s: StoredSource, location: string, envKey?: string): RuntimeSource {
  try {
    return decrypted(s, location, envKey);
  } catch (e) {
    // One unreadable key must not stop the other sources.
    return { id: s.id, name: sourceName(s), kind: s.kind, enabled: false, location, broken: e instanceof Error ? e.message : String(e) };
  }
}

function decrypted(s: StoredSource, location: string, envKey?: string): RuntimeSource {
  return {
    id: s.id,
    name: sourceName(s),
    kind: s.kind,
    enabled: s.enabled,
    location,
    ...(s.project && { project: s.project }),
    ...(s.keyEnc && { credentials: JSON.parse(decrypt(s.keyEnc)) as ServiceAccount }),
    ...(s.keyFilename && { keyFilename: s.keyFilename }),
    ...(s.apiKeyEnc ? { apiKey: decrypt(s.apiKeyEnc) } : envKey ? { apiKey: envKey } : {}),
    ...(s.credit && { credit: s.credit }),
  };
}

export function getAiSources(): AiSources {
  const s = readStored();
  if (s) return { origin: 'admin', version: `admin:${s.updatedAt}`, location: s.location, sources: s.sources.map((x) => toRuntime(x, s.location)) };
  const env = envStored();
  const keys = list(process.env.GEMINI_API_KEY);
  const fingerprint = [process.env.GOOGLE_CLOUD_PROJECT, process.env.GEMINI_API_KEY, env.location].join('|');
  let k = 0;
  return {
    origin: 'env',
    version: `env:${createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)}`,
    location: env.location,
    sources: env.sources.map((x) => toRuntime(x, env.location, x.kind === 'studio' ? keys[k++] : undefined)),
  };
}

/** What the admin page may see: everything except the secrets themselves. */
export function storedView() {
  const s = readStored();
  const src = s ?? envStored();
  return {
    origin: s ? ('admin' as const) : ('env' as const),
    location: src.location,
    updatedAt: s?.updatedAt,
    sources: src.sources.map(({ keyEnc, apiKeyEnc, ...rest }) => ({ ...rest, name: sourceName(rest), auth: authOf({ kind: rest.kind, keyEnc, keyFilename: rest.keyFilename }) })),
  };
}

/* ---------- Credit ---------- */

const fromUsd = (usd: number, currency: Currency) => (currency === 'EUR' ? usd * USD_TO_EUR : usd);

/** Estimated spending of the source since its balance was entered, and whether it should stop being used. */
export function creditState(sourceId: string, credit: Credit, now = Date.now()): CreditState {
  const usd = (
    db().prepare("SELECT COALESCE(SUM(usd), 0) AS n FROM ai_log WHERE source = ? AND status = 'ok' AND created_at >= ?").get(sourceId, credit.since) as { n: number }
  ).n;
  const spent = fromUsd(usd, credit.currency);
  const remaining = credit.amount - spent;
  // Whole days between today and the expiry date, both in the app's time zone.
  const daysLeft = credit.expires ? Math.round((Date.parse(`${credit.expires}T00:00:00Z`) - Date.parse(`${dayOf(now)}T00:00:00Z`)) / 86_400_000) : null;
  return { spent, remaining, exhausted: remaining <= (credit.reserve ?? 0) || (daysLeft !== null && daysLeft < 0), daysLeft };
}

/* ---------- Changes from the admin page ---------- */

export class SourceError extends Error {}

/** The first change copies the .env sources into the stored list (API keys encrypted); later changes edit it. */
function editable(): StoredAi {
  const s = readStored();
  if (s) return s;
  const env = envStored();
  const keys = list(process.env.GEMINI_API_KEY);
  let k = 0;
  return { ...env, sources: env.sources.map((x) => (x.kind === 'studio' ? { ...x, apiKeyEnc: encrypt(keys[k++]) } : x)) };
}

/** Checks and normalizes a source typed on the admin page. */
export function parseNew(input: NewSource): { label: string; kind: 'vertex' | 'studio'; project?: string; serviceAccount?: ServiceAccount; apiKey?: string } {
  const label = (input.label ?? '').trim().slice(0, 40);
  if (input.kind === 'studio') {
    const apiKey = (input.apiKey ?? '').trim();
    if (!/^[\w-]{20,200}$/.test(apiKey)) throw new SourceError('API key không hợp lệ (thường bắt đầu bằng "AIza").');
    return { label, kind: 'studio', apiKey };
  }
  let serviceAccount: ServiceAccount | undefined;
  if (input.keyJson?.trim()) {
    try {
      const o = JSON.parse(input.keyJson) as Partial<ServiceAccount> & { type?: string };
      if (o.type !== 'service_account' || !o.client_email || !o.private_key) throw new Error();
      serviceAccount = { client_email: o.client_email, private_key: o.private_key, project_id: o.project_id };
    } catch {
      throw new SourceError('File khoá không đúng: cần file .json của service account tải từ Google Cloud (IAM › Service accounts › Keys).');
    }
  }
  const project = (input.project ?? '').trim() || serviceAccount?.project_id || '';
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) throw new SourceError('Project ID không hợp lệ (VD: project-9b250232-b388-4a3b-ab0).');
  return { label, kind: 'vertex', project, serviceAccount };
}

/** A source typed on the admin page, ready for a connection test (not saved). */
export function newToRuntime(input: NewSource): RuntimeSource {
  const n = parseNew(input);
  const location = (readStored() ?? envStored()).location;
  return {
    id: 'new',
    name: n.label || (n.kind === 'vertex' ? n.project! : `API key ${keyHint(n.apiKey!)}`),
    kind: n.kind,
    enabled: true,
    location,
    ...(n.project && { project: n.project }),
    ...(n.serviceAccount && { credentials: n.serviceAccount }),
    ...(n.apiKey && { apiKey: n.apiKey }),
  };
}

export function cleanCredit(c: unknown): Omit<Credit, 'since'> | null {
  if (!c || typeof c !== 'object') return null;
  const o = c as Record<string, unknown>;
  const amount = Number(o.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) throw new SourceError('Số dư không hợp lệ.');
  const currency: Currency = o.currency === 'USD' ? 'USD' : 'EUR';
  const expires = typeof o.expires === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.expires) ? o.expires : undefined;
  const reserve = Number(o.reserve);
  return { amount, currency, ...(expires && { expires }), ...(Number.isFinite(reserve) && reserve > 0 && { reserve }) };
}

export function addSource(input: NewSource): string {
  const n = parseNew(input);
  const credit = cleanCredit(input.credit);
  const s = editable();
  if (s.sources.length >= MAX_SOURCES) throw new SourceError(`Tối đa ${MAX_SOURCES} nguồn.`);
  if (n.kind === 'vertex' && s.sources.some((x) => x.kind === 'vertex' && x.project === n.project)) throw new SourceError('Project này đã có trong danh sách.');
  if (n.apiKey && s.sources.some((x) => x.apiKeyEnc && decrypt(x.apiKeyEnc) === n.apiKey)) throw new SourceError('API key này đã có trong danh sách.');
  const source: StoredSource = {
    id: newId(),
    label: n.label,
    kind: n.kind,
    enabled: true,
    ...(n.project && { project: n.project }),
    ...(n.serviceAccount && { keyEnc: encrypt(JSON.stringify(n.serviceAccount)), keyEmail: n.serviceAccount.client_email }),
    ...(n.apiKey && { apiKeyEnc: encrypt(n.apiKey), hint: keyHint(n.apiKey) }),
    ...(credit && { credit: { ...credit, since: Date.now() } }),
  };
  s.sources.push(source);
  writeStored(s);
  return sourceName(source);
}

/** Edits one source by id; `fn` returns the new source, or null to remove it. Returns the source's name. */
function updateSource(id: string, fn: (x: StoredSource) => StoredSource | null) {
  const s = editable();
  const found = s.sources.find((x) => x.id === id);
  if (!found) throw new SourceError('Không tìm thấy nguồn này (trang đã cũ?). Hãy tải lại.');
  s.sources = s.sources.flatMap((x) => (x.id === id ? (fn(x) ?? []) : [x]));
  writeStored(s);
  return sourceName(found);
}

export const removeSource = (id: string) => updateSource(id, () => null);
export const setSourceEnabled = (id: string, enabled: boolean) => updateSource(id, (x) => ({ ...x, enabled }));
export const setSourceLabel = (id: string, label: string) => updateSource(id, (x) => ({ ...x, label: label.trim().slice(0, 40) }));
export const setSourceCredit = (id: string, credit: Omit<Credit, 'since'> | null) =>
  updateSource(id, ({ credit: _old, ...x }) => (credit ? { ...x, credit: { ...credit, since: Date.now() } } : x));

/** Changes the order: -1 = tried earlier, 1 = later. */
export function moveSource(id: string, dir: -1 | 1) {
  const s = editable();
  const i = s.sources.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= s.sources.length) return;
  [s.sources[i], s.sources[j]] = [s.sources[j], s.sources[i]];
  writeStored(s);
}

export function setLocation(location: string) {
  const loc = location.trim();
  if (!/^[a-z0-9-]{2,30}$/.test(loc)) throw new SourceError('Khu vực không hợp lệ (VD: global, us-central1).');
  writeStored({ ...editable(), location: loc });
}

/** Forgets everything saved on the admin page and goes back to the sources in .env. */
export const clearAiConfig = () => setSetting(AI_KEY, null);
