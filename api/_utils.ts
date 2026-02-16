import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vérifie que la requête contient la clé API admin.
 * Le client envoie le header `x-api-key` avec la valeur de ADMIN_API_KEY.
 *
 * Usage dans les handlers :
 *   if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
 */
export function requireAuth(req: VercelRequest): boolean {
  const apiKey = req.headers['x-api-key'];
  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    console.error('ADMIN_API_KEY non configurée dans les variables d\'environnement');
    return false;
  }

  return apiKey === expected;
}

/**
 * Vérifie que l'utilisateur est un admin via son token Twitch.
 *
 * Fonctionnement :
 * 1. Le client envoie le header `Authorization: Bearer <twitch_token>`
 * 2. Le middleware valide le token auprès de l'API Twitch
 * 3. Il vérifie que le user_id retourné est dans ADMIN_TWITCH_IDS
 *
 * Variable d'environnement requise :
 *   ADMIN_TWITCH_IDS = "123456,789012" (IDs Twitch séparés par des virgules)
 *
 * Usage :
 *   const admin = await requireAdminAuth(req);
 *   if (!admin) return res.status(401).json({ error: 'Unauthorized' });
 *   // admin.userId et admin.login sont disponibles
 */
export async function requireAdminAuth(req: VercelRequest): Promise<{ userId: string; login: string } | null> {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  const adminIds = process.env.ADMIN_TWITCH_IDS;
  if (!adminIds) {
    console.error('ADMIN_TWITCH_IDS non configurée dans les variables d\'environnement');
    return null;
  }

  try {
    // Valider le token auprès de Twitch
    const response = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { 'Authorization': `OAuth ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();
    const userId = data.user_id as string;
    const login = data.login as string;

    if (!userId) {
      return null;
    }

    // Vérifier que l'ID est dans la liste des admins
    const allowedIds = adminIds.split(',').map((id: string) => id.trim());
    if (!allowedIds.includes(userId)) {
      console.warn(`Tentative d'accès admin refusée pour user_id=${userId} (${login})`);
      return null;
    }

    return { userId, login };
  } catch (err) {
    console.error('Erreur validation token Twitch:', err);
    return null;
  }
}

// ==================== Rate Limiting simple en mémoire ====================

/**
 * Rate limiter basique par IP, en mémoire.
 * Reset au cold start (suffisant pour bloquer le brute force).
 *
 * Usage :
 *   if (checkRateLimit(req, res, 10, 60_000)) return; // 10 req/min
 *
 * @returns true si la requête est bloquée (429 déjà envoyé), false si OK
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  maxRequests: number = 10,
  windowMs: number = 60_000,
): boolean {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || (req.headers['x-real-ip'] as string)
    || 'unknown';

  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count++;

  if (entry.count > maxRequests) {
    res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000).toString());
    res.status(429).json({ error: 'Trop de requêtes. Réessayez plus tard.' });
    return true;
  }

  return false;
}
