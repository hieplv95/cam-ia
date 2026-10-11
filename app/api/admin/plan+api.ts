import { imageModels } from '@/src/ai/models';
import { adminOf, audit } from '@/src/server/admin';
import { getPlan, PlanError, setPlan } from '@/src/server/plan';

/** Monthly points, free tries for guests and points per model (admin Settings tab). */
export function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  return Response.json({ plan: getPlan() });
}

/** { monthlyPoints, guestFreeTries, modelPoints: { [modelId]: n } }: applies right away, including to this month. */
export async function POST(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const body = await request.json().catch(() => ({}));
  try {
    const before = getPlan();
    const plan = setPlan(body);
    const models = imageModels.map((m) => `${m.name} ${before.modelPoints[m.id]}→${plan.modelPoints[m.id]}`).join(', ');
    audit(
      admin,
      'plan',
      null,
      `Điểm AI: ${before.monthlyPoints}→${plan.monthlyPoints} điểm/tháng, khách ${before.guestFreeTries}→${plan.guestFreeTries} lượt, ${models} điểm/ảnh`,
    );
    return Response.json({ plan });
  } catch (e) {
    if (e instanceof PlanError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
