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

// ==================== Boîte de destination ====================

/**
 * Bac des questions sans boîte assignée.
 *
 * Déjà le nom utilisé par l'ajout direct (contribution-page) et par l'import
 * JSON. La modération doit atterrir au même endroit : sans ça, une question
 * approuvée sans boîte choisie finit dans une boîte arbitraire.
 */
export const DEFAULT_BOX_NAME = 'Sans boîte';

/**
 * Décide dans quelle boîte atterrit une question approuvée.
 *
 * Priorité : le choix explicite du modérateur, puis la boîte proposée par le
 * contributeur, puis le bac par défaut. C'est le seul endroit qui tranche —
 * le client n'invente pas de valeur de repli.
 */
export function resolveTargetBox(requested: unknown, pendingBoxName: unknown): string {
  const clean = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  return clean(requested) ?? clean(pendingBoxName) ?? DEFAULT_BOX_NAME;
}

// ==================== Identité joueur ====================

/**
 * Clé d'identité d'un joueur dans la table `scores`.
 *
 * `twitch_id` quand il est présent (fourni par le tag IRC `user-id`, donc
 * autoritatif), sinon le nick normalisé en minuscules pour les lignes héritées
 * écrites avant que l'id soit collecté.
 *
 * Grouper sur cette clé plutôt que sur `nick` évite qu'un même compte se
 * dédouble entre deux casses ou qu'un renommage Twitch coupe l'historique en
 * deux. Une ligne héritée n'est jamais fusionnée avec une ligne identifiée :
 * rien ne prouve qu'elles appartiennent au même compte.
 */
export const PLAYER_KEY_EXPR = "COALESCE(NULLIF(twitch_id, ''), LOWER(nick))";

/** CTE qui expose `player_key` sur chaque ligne de `scores`. */
const KEYED_SCORES_CTE = `WITH keyed AS (
    SELECT scores.rowid AS row_id, scores.*, ${PLAYER_KEY_EXPR} AS player_key FROM scores
  )`;

/**
 * Nick à afficher pour un `player_key` : celui de la ligne la plus récente.
 * Le départage par `rowid` est nécessaire car un batch de fin de quiz écrit
 * toutes ses lignes avec le même `created_at`.
 */
const CURRENT_NICK_SUBQUERY = `(
    SELECT k2.nick FROM keyed k2
    WHERE k2.player_key = k.player_key
    ORDER BY k2.created_at DESC, k2.row_id DESC
    LIMIT 1
  )`;

const PLAYER_AGGREGATES = `SUM(score) as total_score,
    SUM(answers) as total_answers,
    SUM(firsts) as total_firsts,
    SUM(combos) as total_combos,
    MIN(CASE WHEN fastest > 0 THEN fastest ELSE NULL END) as best_fastest,
    COUNT(DISTINCT session_id) as sessions`;

/** Classement all-time. Paramètre : limite. */
export const LEADERBOARD_SQL = `${KEYED_SCORES_CTE}
  SELECT
    k.player_key,
    ${CURRENT_NICK_SUBQUERY} as nick,
    MAX(k.twitch_id) as twitch_id,
    ${PLAYER_AGGREGATES}
  FROM keyed k
  GROUP BY k.player_key
  ORDER BY total_score DESC
  LIMIT ?`;

/** Résout un nick (insensible à la casse) vers son `player_key`. Paramètre : nick. */
export const PLAYER_KEY_BY_NICK_SQL = `SELECT ${PLAYER_KEY_EXPR} AS player_key
  FROM scores
  WHERE LOWER(nick) = LOWER(?)
  ORDER BY created_at DESC, rowid DESC
  LIMIT 1`;

/** Stats d'un joueur par boîte. Paramètre : player_key. */
export const PLAYER_BY_BOX_SQL = `SELECT
    box_name,
    COUNT(*) as games,
    SUM(score) as total_score,
    SUM(answers) as total_answers,
    AVG(score) as avg_score
  FROM scores
  WHERE ${PLAYER_KEY_EXPR} = ? AND box_name IS NOT NULL
  GROUP BY box_name
  ORDER BY total_score DESC`;

/** Chaînes sur lesquelles un joueur a joué. Paramètre : player_key. */
export const PLAYER_STREAMS_SQL = `SELECT
    channel_name,
    MAX(channel_id) as channel_id,
    COUNT(DISTINCT session_id) as sessions,
    SUM(score) as total_score,
    MIN(created_at) as first_played,
    MAX(created_at) as last_played
  FROM scores
  WHERE ${PLAYER_KEY_EXPR} = ? AND channel_name IS NOT NULL AND channel_name != ''
  GROUP BY channel_name
  ORDER BY sessions DESC`;

/** Meilleure session d'un joueur. Paramètre : player_key. */
export const PLAYER_BEST_SESSION_SQL = `SELECT
    session_id, box_name, score, answers, firsts, combos, fastest, channel_name, created_at
  FROM scores
  WHERE ${PLAYER_KEY_EXPR} = ?
  ORDER BY score DESC
  LIMIT 1`;

/** Historique des sessions d'un joueur. Paramètres : player_key, limite. */
export const PLAYER_HISTORY_SQL = `SELECT
    session_id, box_name, score, answers, firsts, combos, fastest, channel_name, created_at
  FROM scores
  WHERE ${PLAYER_KEY_EXPR} = ?
  ORDER BY created_at DESC, rowid DESC
  LIMIT ?`;

/** Totaux d'un joueur. Paramètre : player_key. */
export const PLAYER_TOTALS_SQL = `${KEYED_SCORES_CTE}
  SELECT
    k.player_key,
    ${CURRENT_NICK_SUBQUERY} as nick,
    MAX(k.twitch_id) as twitch_id,
    ${PLAYER_AGGREGATES},
    MAX(score) as best_score,
    AVG(score) as avg_score,
    MIN(created_at) as first_game,
    MAX(created_at) as last_game
  FROM keyed k
  WHERE k.player_key = ?
  GROUP BY k.player_key`;

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
