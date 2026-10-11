import { DEFAULT_PLAN, PLAN_LIMITS, type CreditPlan } from '../ai/credits';
import { imageModels } from '../ai/models';
import { db, getSetting, setSetting } from './db';
import { periodOf } from './time';

/**
 * Monthly points, free tries for guests and the points each model costs, as set on the admin page
 * (defaults in src/ai/credits.ts until something is saved).
 * The monthly points are also kept per month (monthly_allowance): a month's bonus use is worked out with the
 * allowance of that month, so lowering or raising it later never changes past months.
 */

const PLAN_KEY = 'credit_plan';

export function getPlan(): CreditPlan {
  const raw = getSetting(PLAN_KEY);
  if (!raw) return DEFAULT_PLAN;
  const saved = JSON.parse(raw) as Partial<CreditPlan>;
  return { ...DEFAULT_PLAN, ...saved, modelPoints: { ...DEFAULT_PLAN.modelPoints, ...saved.modelPoints } };
}

/** Records this month's allowance the first time it is used, so later changes to the setting don't rewrite it. */
export function rememberAllowance(period = periodOf()) {
  db().prepare('INSERT OR IGNORE INTO monthly_allowance (period, points) VALUES (?, ?)').run(period, getPlan().monthlyPoints);
}

/**
 * Monthly points of a given month: as recorded for it, the current setting for this month,
 * or the original default for months before the setting existed.
 */
export function allowanceFor(period: string) {
  const row = db().prepare('SELECT points FROM monthly_allowance WHERE period = ?').get(period) as { points: number } | undefined;
  if (row) return row.points;
  return period === periodOf() ? getPlan().monthlyPoints : DEFAULT_PLAN.monthlyPoints;
}

export class PlanError extends Error {}

const whole = (v: unknown, max: number, min: number, label: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new PlanError(`${label}: nhập số nguyên từ ${min} đến ${max.toLocaleString('vi-VN')}.`);
  return n;
};

/** Saves the plan typed on the admin page. A new monthly amount applies to the current month right away. */
export function setPlan(input: unknown): CreditPlan {
  const o = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof CreditPlan, unknown>>;
  const current = getPlan();
  const models = (o.modelPoints && typeof o.modelPoints === 'object' ? o.modelPoints : {}) as Record<string, unknown>;
  const next: CreditPlan = {
    monthlyPoints: o.monthlyPoints === undefined ? current.monthlyPoints : whole(o.monthlyPoints, PLAN_LIMITS.monthlyPoints, 0, 'Điểm mỗi tháng'),
    guestFreeTries: o.guestFreeTries === undefined ? current.guestFreeTries : whole(o.guestFreeTries, PLAN_LIMITS.guestFreeTries, 0, 'Lượt miễn phí'),
    modelPoints: Object.fromEntries(
      imageModels.map((m) => [m.id, models[m.id] === undefined ? current.modelPoints[m.id] : whole(models[m.id], PLAN_LIMITS.modelPoints, 1, `Điểm mỗi ảnh ${m.name}`)]),
    ),
  };
  setSetting(PLAN_KEY, JSON.stringify(next));
  db()
    .prepare('INSERT INTO monthly_allowance (period, points) VALUES (?, ?) ON CONFLICT (period) DO UPDATE SET points = excluded.points')
    .run(periodOf(), next.monthlyPoints);
  return next;
}
