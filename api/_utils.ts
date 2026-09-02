import type { VercelRequest, VercelResponse } from '@vercel/node';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function applyCors(res: VercelResponse): void {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
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

/**
 * Accepte n'importe quel token Twitch valide (pas forcément admin).
 * Utilisé pour les endpoints accessibles à tous les streamers connectés (ex: scores).
 */
export async function requireAnyTwitchAuth(req: VercelRequest): Promise<{ userId: string; login: string } | null> {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { 'Authorization': `OAuth ${token}` },
    });
    if (!response.ok) return null;
    const data: any = await response.json();
    if (!data.user_id) return null;
    return { userId: data.user_id, login: data.login };
  } catch {
    return null;
  }
}

// ==================== Validation des scores ====================

/**
 * Ligne de score normalisée, prête à insérer dans la table `scores`.
 */
export type NormalizedScorePlayer = {
  tid: string;
  nick: string;
  score: number;
  answers: number;
  firsts: number;
  combos: number;
  fastest: number;
};

const MAX_PLAYERS_PER_SESSION = 1000;
const MAX_NICK_LENGTH = 64;
/** Plafond commun à score et aux stats : toutes ces colonnes sont sommées
 *  dans le leaderboard global, donc toutes doivent être bornées. */
const MAX_STAT_VALUE = 100_000;

function normalizeStat(value: unknown, field: string): number | { error: string } {
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { error: `${field} doit être un nombre fini` };
  }
  if (value < 0) return { error: `${field} ne peut pas être négatif` };
  if (value > MAX_STAT_VALUE) return { error: `${field} dépasse le plafond autorisé` };
  return value;
}

/**
 * Valide et normalise le tableau `players` reçu du client.
 *
 * Les nicks viennent du chat Twitch : le serveur ne peut pas les authentifier.
 * Il peut en revanche borner ce qui finit dans les agrégats du leaderboard,
 * pour qu'un compte authentifié ne puisse pas y injecter de valeurs absurdes.
 */
export function validateScorePlayers(
  raw: unknown,
): { error: string } | { players: NormalizedScorePlayer[] } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'players[] requis (tableau non vide)' };
  }
  if (raw.length > MAX_PLAYERS_PER_SESSION) {
    return { error: `players[] limité à ${MAX_PLAYERS_PER_SESSION} entrées` };
  }

  const players: NormalizedScorePlayer[] = [];

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      return { error: 'chaque joueur doit être un objet' };
    }

    const { tid, nick, score, stats } = entry as Record<string, unknown>;

    if (typeof nick !== 'string' || nick.trim().length === 0) {
      return { error: 'nick requis (chaîne non vide)' };
    }
    if (nick.trim().length > MAX_NICK_LENGTH) {
      return { error: `nick limité à ${MAX_NICK_LENGTH} caractères` };
    }

    const normalizedScore = normalizeStat(score, 'score');
    if (typeof normalizedScore !== 'number') return normalizedScore;

    const rawStats = (typeof stats === 'object' && stats !== null ? stats : {}) as Record<string, unknown>;

    // fastestAnswer vaut Infinity tant qu'aucune réponse n'a été donnée.
    const rawFastest = rawStats.fastestAnswer === Infinity ? 0 : rawStats.fastestAnswer;

    const answers = normalizeStat(rawStats.answers, 'answers');
    if (typeof answers !== 'number') return answers;
    const firsts = normalizeStat(rawStats.firsts, 'firsts');
    if (typeof firsts !== 'number') return firsts;
    const combos = normalizeStat(rawStats.combos, 'combos');
    if (typeof combos !== 'number') return combos;
    const fastest = normalizeStat(rawFastest, 'fastestAnswer');
    if (typeof fastest !== 'number') return fastest;

    players.push({
      tid: typeof tid === 'string' ? tid : '',
      nick: nick.trim(),
      score: normalizedScore,
      answers,
      firsts,
      combos,
      fastest,
    });
  }

  return { players };
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
