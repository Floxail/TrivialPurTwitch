import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type Client } from '@libsql/client';
import { requireAnyTwitchAuth } from './_utils.js';

let db: Client;
function getDb() {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
  }
  return db;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const HISTORY_MAX = 500;

let migrationDone = false;
async function ensureMigration() {
  if (migrationDone) return;
  await getDb().execute(`
    CREATE TABLE IF NOT EXISTS question_history (
      twitch_id   TEXT NOT NULL,
      box_name    TEXT,
      question_id TEXT NOT NULL,
      played_at   TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (twitch_id, question_id)
    )
  `);
  await getDb().execute(`CREATE INDEX IF NOT EXISTS idx_history_twitch ON question_history(twitch_id)`);
  await getDb().execute(`CREATE INDEX IF NOT EXISTS idx_history_box ON question_history(twitch_id, box_name)`);
  migrationDone = true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await ensureMigration();

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
