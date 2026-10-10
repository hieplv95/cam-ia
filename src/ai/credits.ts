import { modelInfo } from './models';

/**
 * How AI use is paid for (shared by the app and the API route):
 * - without an account: a few free tries, whatever the model;
 * - with an account: a monthly allowance of points, where a pricier model costs more points.
 */
export const GUEST_FREE_TRIES = 3;
export const MONTHLY_POINTS = 100;

/**
 * Bonus points (never expire; used after the monthly allowance runs out):
 * inviting a friend who signs up with your code, and (once a month) when someone else opens a link you shared on Facebook.
 */
export const REFERRAL_INVITER_POINTS = 20;
export const REFERRAL_FRIEND_POINTS = 10;
export const MAX_REFERRALS_PER_MONTH = 10;
export const SHARE_POINTS = 5;
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
};

/** Points one AI result costs a signed-in user. */
export const pointsFor = (model: string) => modelInfo(model)?.points ?? 1;

/** What the app shows about the user's remaining AI use. */
export type Credits =
  | { kind: 'guest'; left: number; limit: number }
  /** left includes `bonus`; resetAt: when the monthly part renews; resetLabel: that day as "1/11" in the server's time zone. */
  | { kind: 'member'; left: number; limit: number; bonus: number; resetAt: number; resetLabel: string };

export type AccountUser = { id: number; email: string; name: string };
