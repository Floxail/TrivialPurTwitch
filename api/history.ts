import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAnyTwitchAuth, applyCors } from './_utils.js';
import { getDb, runMigrations } from './_db.js';

const HISTORY_MAX = 500;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await runMigrations();

    const user = await requireAnyTwitchAuth(req);
    if (!user) return res.status(401).json({ error: 'Auth requise' });

    // ==================== GET : récupère historique ====================
    if (req.method === 'GET') {
      const result = await getDb().execute({
        sql: `SELECT question_id FROM question_history
              WHERE twitch_id = ?
              ORDER BY played_at DESC
              LIMIT ?`,
        args: [user.userId, HISTORY_MAX],
      });

      const ids = result.rows.map((r) => r.question_id as string);
      return res.status(200).json({ ids, total: ids.length });
    }

    // ==================== POST : enregistre questions jouées ====================
    if (req.method === 'POST') {
      const { questionIds, boxName } = req.body;

      if (!Array.isArray(questionIds) || questionIds.length === 0) {
        return res.status(400).json({ error: 'questionIds requis (array)' });
      }

      const now = new Date().toISOString();
      const statements = questionIds.map((qid: string) => ({
        sql: `INSERT OR REPLACE INTO question_history (twitch_id, box_name, question_id, played_at)
              VALUES (?, ?, ?, ?)`,
        args: [user.userId, boxName || null, qid, now],
      }));

      const purgeStatement = {
        sql: `DELETE FROM question_history
              WHERE twitch_id = ?
                AND question_id NOT IN (
                  SELECT question_id FROM question_history
                  WHERE twitch_id = ?
                  ORDER BY played_at DESC
                  LIMIT ?
                )`,
        args: [user.userId, user.userId, HISTORY_MAX],
      };
      await getDb().batch([...statements, purgeStatement], 'write');

      return res.status(200).json({ success: true, recorded: questionIds.length });
    }

    // ==================== DELETE : reset historique ====================
    if (req.method === 'DELETE') {
      const { box } = req.query;
      if (box && typeof box === 'string') {
        await getDb().execute({
          sql: `DELETE FROM question_history WHERE twitch_id = ? AND box_name = ?`,
          args: [user.userId, box],
        });
      } else {
        await getDb().execute({
          sql: `DELETE FROM question_history WHERE twitch_id = ?`,
          args: [user.userId],
        });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('History error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
