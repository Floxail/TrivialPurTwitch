import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAnyTwitchAuth, applyCors, checkRateLimit } from '../_utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req, res, 30, 60_000)) return;

  const user = await requireAnyTwitchAuth(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const adminIds = (process.env.ADMIN_TWITCH_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return res.status(200).json({
    userId: user.userId,
    login: user.login,
    isAdmin: adminIds.includes(user.userId),
  });
}
