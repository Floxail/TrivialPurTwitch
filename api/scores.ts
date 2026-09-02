import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  requireAnyTwitchAuth,
  applyCors,
  validateScorePlayers,
  LEADERBOARD_SQL,
  PLAYER_KEY_BY_NICK_SQL,
  PLAYER_TOTALS_SQL,
  PLAYER_HISTORY_SQL,
} from './_utils.js';
import { getDb, runMigrations } from './_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // ==================== POST /api/scores ====================
    // Enregistre les scores d'une session de quiz terminée
    if (req.method === 'POST') {
      const user = await requireAnyTwitchAuth(req);
      if (!user?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { players, sessionId, boxName } = req.body;

      // Le channel est dérivé du token validé, jamais lu du body : un compte Twitch
      // ne peut donc pas soumettre de scores sur le channel d'un autre streamer,
      // ni contourner le contrôle en omettant simplement le champ.
      const channelId = user.userId;
      // `login` peut manquer selon le type de token Twitch — on garde le fallback null
      // qui existait avant, sinon le bind libsql rejette la requête (500).
      const channelName = user.login || null;

      const validation = validateScorePlayers(players);
      if ('error' in validation) {
        return res.status(400).json({ error: validation.error });
      }

      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: 'sessionId requis' });
      }

      await runMigrations();

      // Batch insert des scores
      const BATCH_SIZE = 100;
      let inserted = 0;

      for (let i = 0; i < validation.players.length; i += BATCH_SIZE) {
        const batch = validation.players.slice(i, i + BATCH_SIZE);
        const statements = batch.map((p) => ({
          sql: `INSERT INTO scores (twitch_id, nick, score, answers, firsts, combos, fastest, session_id, box_name, channel_name, channel_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            p.tid,
            p.nick,
            p.score,
            p.answers,
            p.firsts,
            p.combos,
            p.fastest,
            sessionId,
            typeof boxName === 'string' ? boxName : null,
            channelName,
            channelId,
          ],
        }));

        await getDb().batch(statements as any);
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
        const result = await getDb().execute({ sql: LEADERBOARD_SQL, args: [limit] });

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
        // Le nick de l'URL n'est qu'un point d'entrée : on le résout vers la clé
        // d'identité du compte, pour que la casse et les renommages ne coupent
        // pas l'historique en deux.
        const keyLookup = await getDb().execute({
          sql: PLAYER_KEY_BY_NICK_SQL,
          args: [nick as string],
        });
        if (keyLookup.rows.length === 0) {
          return res.status(404).json({ error: 'Joueur non trouvé' });
        }
        const playerKey = keyLookup.rows[0].player_key as string;

        const result = await getDb().execute({ sql: PLAYER_TOTALS_SQL, args: [playerKey] });

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
        const history = await getDb().execute({
          sql: PLAYER_HISTORY_SQL,
          args: [playerKey, limit],
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
            channelName: r.channel_name || null,
            createdAt: r.created_at,
          })),
        });
      }

      // GET /api/scores?action=sessions → liste des sessions récentes
      if (action === 'sessions') {
        const result = await getDb().execute({
          sql: `SELECT
                  session_id,
                  box_name,
                  channel_name,
                  channel_id,
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
            channelName: r.channel_name || null,
            channelId: r.channel_id || null,
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
