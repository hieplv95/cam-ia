import { imageModels, modelInfo } from './models';

/**
 * How AI use is paid for (shared by the app and the API route):
 * - without an account: a few free tries, whatever the model;
 * - with an account: a monthly allowance of points, where a pricier model costs more points.
 * Admins change the numbers on the admin page (Settings); the server sends them to the app.
 */
export type CreditPlan = {
  monthlyPoints: number;
  guestFreeTries: number;
  /** Points one result costs a signed-in user, per model id. */
  modelPoints: Record<string, number>;
};

export const DEFAULT_PLAN: CreditPlan = {
  monthlyPoints: 100,
  guestFreeTries: 3,
  modelPoints: Object.fromEntries(imageModels.map((m) => [m.id, m.points])),
};

/** Limits for the admin page. */
export const PLAN_LIMITS = { monthlyPoints: 100_000, guestFreeTries: 100, modelPoints: 1000 };

/**
 * Bonus points (never expire; used after the monthly allowance runs out):
 * inviting a friend who signs up with your code (inviter and friend both get points, up to maxPerMonth invites a
 * month), and (once a month) `share` points when someone else opens a link you shared on Facebook.
 * Admins change the numbers on the admin page (Settings); the server sends them to the app.
 */
export type RewardPoints = { inviter: number; friend: number; maxPerMonth: number; share: number };
export const DEFAULT_REWARD_POINTS: RewardPoints = { inviter: 20, friend: 10, maxPerMonth: 10, share: 5 };
/** Highest value an admin may set for any of them. */
export const MAX_REWARD_POINTS = 1000;
export const sharePlatforms = ['facebook'] as const;
export type SharePlatform = (typeof sharePlatforms)[number];

/** What the profile shows about invites and shares (members only). */
export type Rewards = {
  code: string;
  invited: number;
  referralPoints: number;
  invitesLeftThisMonth: number;
  /** Share bonus already received this month. */
  shared: Record<SharePlatform, boolean>;
  /** Other people who opened the user's Facebook link this month. */
  shareVisits: number;
  /** The current reward amounts. */
  points: RewardPoints;
};

/** Points one AI result costs a signed-in user under this plan. */
export const pointsFor = (plan: CreditPlan, model: string) => plan.modelPoints[model] ?? modelInfo(model)?.points ?? 1;

/** What the app shows about the user's remaining AI use. */
export type Credits =
  | { kind: 'guest'; left: number; limit: number }
  /**
   * left includes `bonus`; resetAt: when the monthly part renews; resetLabel: that day as "1/11" in the server's time zone.
   * unlimited: an admin account, never stopped for lack of points (its use is still counted).
   */
  | { kind: 'member'; left: number; limit: number; bonus: number; resetAt: number; resetLabel: string; unlimited?: boolean };

export type AccountUser = { id: number; email: string; name: string };

/** Points left as shown to the user ("∞" for admins). */
export const pointsLeftLabel = (c: Credits) => (c.kind === 'member' && c.unlimited ? '∞' : c.left);
