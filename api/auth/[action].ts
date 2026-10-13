import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../_utils.js';
import { handleAuth, routeDeps } from '../_auth-routes.js';

// Une seule fonction pour toute l'authentification : le plan Vercel Hobby limite à 12 fonctions.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (checkRateLimit(req, res, 30, 60_000)) return;
  await handleAuth(req, res, routeDeps());
}
