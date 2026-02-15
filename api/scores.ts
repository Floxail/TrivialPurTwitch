import { createClient } from '@libsql/client';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_utils';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Ajouter les headers CORS
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // ==================== POST /api/scores ====================
    // Enregistre les scores d'une session de quiz terminée
    if (req.method === 'POST') {
      if (!requireAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { players, sessionId, boxName } = req.body;

      if (!players || !Array.isArray(players) || players.length === 0) {
        return res.status(400).json({ error: 'players[] requis (tableau non vide)' });
      }

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId requis' });
      }

      // Batch insert des scores
      const BATCH_SIZE = 100;
      let inserted = 0;

      for (let i = 0; i < players.length; i += BATCH_SIZE) {
        const batch = players.slice(i, i + BATCH_SIZE);
        const statements = batch.map((p: any) => ({
          sql: `INSERT INTO scores (twitch_id, nick, score, answers, firsts, combos, fastest, session_id, box_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            p.tid || '',
            p.nick,
            p.score || 0,
            p.stats?.answers || 0,
            p.stats?.firsts || 0,
            p.stats?.combos || 0,
            p.stats?.fastestAnswer === Infinity ? 0 : (p.stats?.fastestAnswer || 0),
            sessionId,
            boxName || null,
          ],
        }));

        await db.batch(statements as any);
        inserted += batch.length;
      }

      return res.status(201).json({ inserted, sessionId });
    }

    // ==================== GET /api/scores ====================
    if (req.method === 'GET') {
      const { action, nick, limit: rawLimit } = req.query;
      const limit = Math.min(parseInt(rawLimit as string) || 50, 200);

      // GET /api/scores?action=leaderboard → classement all-time
      if (action === 'leaderboard') {
        const result = await db.execute({
          sql: `SELECT
                  nick,
                  twitch_id,
                  SUM(score) as total_score,
                  SUM(answers) as total_answers,
                  SUM(firsts) as total_firsts,
                  SUM(combos) as total_combos,
                  MIN(CASE WHEN fastest > 0 THEN fastest ELSE NULL END) as best_fastest,
                  COUNT(DISTINCT session_id) as sessions
                FROM scores
                GROUP BY nick
                ORDER BY total_score DESC
                LIMIT ?`,
          args: [limit],
        });

        const leaderboard = result.rows.map((row) => ({
          nick: row.nick,
          twitchId: row.twitch_id,
          totalScore: Number(row.total_score),
          totalAnswers: Number(row.total_answers),
          totalFirsts: Number(row.total_firsts),
          totalCombos: Number(row.total_combos),
          bestFastest: row.best_fastest ? Number(row.best_fastest) : null,
          sessions: Number(row.sessions),
        }));

        return res.json({ leaderboard });
      }

      // GET /api/scores?action=player&nick=xxx → stats d'un joueur
      if (action === 'player' && nick) {
        const result = await db.execute({
          sql: `SELECT
                  nick,
                  twitch_id,
                  SUM(score) as total_score,
                  SUM(answers) as total_answers,
                  SUM(firsts) as total_firsts,
                  SUM(combos) as total_combos,
                  MIN(CASE WHEN fastest > 0 THEN fastest ELSE NULL END) as best_fastest,
                  COUNT(DISTINCT session_id) as sessions
                FROM scores
                WHERE nick = ?
                GROUP BY nick`,
          args: [nick as string],
        });

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Joueur non trouvé' });
        }

        const row = result.rows[0];
        const player = {
          nick: row.nick,
          twitchId: row.twitch_id,
          totalScore: Number(row.total_score),
          totalAnswers: Number(row.total_answers),
          totalFirsts: Number(row.total_firsts),
          totalCombos: Number(row.total_combos),
          bestFastest: row.best_fastest ? Number(row.best_fastest) : null,
          sessions: Number(row.sessions),
        };

        // Historique des sessions
        const history = await db.execute({
          sql: `SELECT session_id, box_name, score, answers, firsts, combos, fastest, created_at
                FROM scores
                WHERE nick = ?
                ORDER BY created_at DESC
                LIMIT ?`,
          args: [nick as string, limit],
        });

        return res.json({
          player,
          history: history.rows.map((r) => ({
            sessionId: r.session_id,
            boxName: r.box_name,
            score: Number(r.score),
            answers: Number(r.answers),
            firsts: Number(r.firsts),
            combos: Number(r.combos),
            fastest: r.fastest ? Number(r.fastest) : null,
            createdAt: r.created_at,
          })),
        });
      }

      // GET /api/scores?action=sessions → liste des sessions récentes
      if (action === 'sessions') {
        const result = await db.execute({
          sql: `SELECT
                  session_id,
                  box_name,
                  COUNT(*) as player_count,
                  SUM(score) as total_points,
                  MIN(created_at) as started_at
                FROM scores
                GROUP BY session_id
                ORDER BY started_at DESC
                LIMIT ?`,
          args: [limit],
        });

        return res.json({
          sessions: result.rows.map((r) => ({
            sessionId: r.session_id,
            boxName: r.box_name,
            playerCount: Number(r.player_count),
            totalPoints: Number(r.total_points),
            startedAt: r.started_at,
          })),
        });
      }

      return res.status(400).json({ error: 'action requise: leaderboard | player | sessions' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Scores API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
