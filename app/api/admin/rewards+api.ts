import { adminOf, audit } from '@/src/server/admin';
import { getRewardPoints, RewardSettingsError, setRewardPoints } from '@/src/server/rewards';

/** Invite and share bonus amounts (admin Settings tab). */
export function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  return Response.json({ points: getRewardPoints() });
}

/** { inviter, friend, maxPerMonth, share }: whole numbers, 0 turns that reward off. Applies to rewards given from now on. */
export async function POST(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const body = await request.json().catch(() => ({}));
  try {
    const before = getRewardPoints();
    const points = setRewardPoints(body);
    audit(
      admin,
      'rewards',
      null,
      `Điểm thưởng: mời bạn +${before.inviter}→+${points.inviter}, được mời +${before.friend}→+${points.friend}, ` +
        `tối đa ${before.maxPerMonth}→${points.maxPerMonth} lượt/tháng, chia sẻ Facebook +${before.share}→+${points.share}`,
    );
    return Response.json({ points });
  } catch (e) {
    if (e instanceof RewardSettingsError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
