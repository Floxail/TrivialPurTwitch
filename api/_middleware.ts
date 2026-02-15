import type { VercelRequest } from '@vercel/node';

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
    // Si ADMIN_API_KEY n'est pas configurée, on refuse tout par sécurité
    console.error('ADMIN_API_KEY non configurée dans les variables d\'environnement');
    return false;
  }

  return apiKey === expected;
}
