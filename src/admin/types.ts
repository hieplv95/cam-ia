/** What the admin API returns (shared by the server and the admin page). Times are epoch ms, days "2026-10-05". */

/** Outcome of one AI request: done, failed, refused for lack of points/tries, or refused by the content filter. */
export type AiStatus = 'ok' | 'error' | 'denied' | 'blocked';

export type DayPoint = { day: string; ai: number; errors: number; signups: number; actives: number };

export type ToolStat = {
  /** 'generate', 'prompt', 'preset.<id>', 'studio.<id>', or '' for results from before the log existed. */
  tool: string;
  ok: number;
  error: number;
  denied: number;
  blocked: number;
  members: number;
  guests: number;
  avgMs: number;
  usd: number;
  byModel: Record<string, number>;
};

export type Overview = {
  days: number;
  from: string;
  today: string;
  timeZone: string;
  resetLabel: string;
  users: { total: number; newInRange: number; newToday: number; locked: number; referred: number };
  active: { today: number; inRange: number; members: number };
  ai: {
    ok: number;
    okToday: number;
    okMonth: number;
    error: number;
    denied: number;
    guestDenied: number;
    blocked: number;
    usd: number;
    usdMonth: number;
    points: number;
    avgMs: number;
  };
  series: DayPoint[];
  tools: ToolStat[];
  models: { model: string; ok: number; usd: number }[];
  events: { name: string; detail: string; n: number }[];
  errors: { error: string; n: number; last: number }[];
  rewards: { reason: string; count: number; points: number }[];
  visits: { source: string; n: number }[];
  topUsers: { id: number; email: string; name: string; ai: number; usd: number }[];
};

export type UserSort = 'new' | 'ai' | 'active';

export type UserRow = {
  id: number;
  email: string;
  name: string;
  createdAt: number;
  locked: boolean;
  admin: boolean;
  ai: number;
  lastDay: string | null;
  invited: number;
  /** Points left: this month's allowance plus bonus. */
  points: number;
  bonus: number;
};

export type UserList = { total: number; users: UserRow[] };

export type UserDetail = {
  user: UserRow & { refCode: string | null; invitedBy: { id: number; email: string } | null; sessions: number };
  monthly: number;
  spentThisMonth: number;
  usd: number;
  errors: number;
  tools: { tool: string; n: number }[];
  recentAi: { at: number; tool: string; model: string; status: AiStatus; error: string; points: number; ms: number }[];
  bonus: { at: number; points: number; reason: string; ref: string }[];
  invited: { id: number; email: string; createdAt: number }[];
  activeDays: string[];
  adminLog: { at: number; admin: string; action: string; detail: string }[];
};

export type Check = { label: string; ok: boolean; value: string; hint?: string };

export type SystemInfo = {
  now: number;
  node: string;
  platform: string;
  uptimeSec: number;
  memoryMb: number;
  schema: number;
  db: { file: string; sizeMb: number; tables: Record<string, number> };
  config: {
    models: { id: string; name: string; usd: number; points: number; isDefault: boolean }[];
    guestFreeTries: number;
    monthlyPoints: number;
    referralInviter: number;
    referralFriend: number;
    maxReferralsPerMonth: number;
    sharePoints: number;
    timeZone: string;
    period: string;
    resetLabel: string;
  };
  checks: Check[];
};

/* ---------- AI sources (Settings tab) ---------- */

export type Currency = 'EUR' | 'USD';

/** A source's balance as copied from Google Cloud at `since`; the app subtracts its own estimated spending after that. */
export type Credit = { amount: number; currency: Currency; since: number; expires?: string; reserve?: number };

export type CreditState = { spent: number; remaining: number; exhausted: boolean; daysLeft: number | null };

/** key = service-account file uploaded on the admin page, file = key file path from .env, adc = gcloud login on the server. */
export type SourceAuth = 'adc' | 'key' | 'file' | 'apikey';

export type SourceView = {
  id: string;
  name: string;
  label: string;
  kind: 'vertex' | 'studio';
  enabled: boolean;
  auth: SourceAuth;
  project?: string;
  keyEmail?: string;
  keyFilename?: string;
  hint?: string;
  credit?: Credit;
  creditState: CreditState | null;
  /** Skipped for a while after an account error (out of money, no access, rate limited). */
  retryInSeconds: number;
  /** The stored key can't be read (CAMI_SECRET changed): the source is skipped until it is added again. */
  broken?: string;
};

export type AiSettings = {
  /** admin = managed on this page; env = read from .env until the first change here. */
  origin: 'admin' | 'env';
  location: string;
  updatedAt?: number;
  /** CAMI_SECRET is set, so keys can be stored encrypted. */
  secretReady: boolean;
  sources: SourceView[];
};

export type TestResult = { id: string; name: string; ok: boolean; message: string };

/** A source being added (secrets in clear text, sent once to the server and stored encrypted). */
export type NewSource = {
  kind: 'vertex' | 'studio';
  label: string;
  project?: string;
  /** Content of the service-account .json file. */
  keyJson?: string;
  apiKey?: string;
  credit?: Omit<Credit, 'since'>;
};
