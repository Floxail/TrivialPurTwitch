import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type Client } from '@libsql/client';
import { requireAdminAuth, checkRateLimit } from './_utils.js';

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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function validateTwitchUser(req: VercelRequest): Promise<{ userId: string; login: string } | null> {
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

async function ensureTable() {
  const database = getDb();
  await database.execute(`
    CREATE TABLE IF NOT EXISTS question_reports (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      reason TEXT NOT NULL,
      reported_by TEXT NOT NULL,
      reported_by_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    )
  `);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
  if (req.method === 'OPTIONS') return res.status(204).end();

  await ensureTable();
  const database = getDb();

  // POST — Créer un signalement (tout utilisateur connecté)
  if (req.method === 'POST') {
    if (checkRateLimit(req, res, 5, 60_000)) return;

    const user = await validateTwitchUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Token Twitch invalide' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { questionId, questionText, reason } = body;

    if (!questionId || !questionText || !reason) {
      return res.status(400).json({ error: 'questionId, questionText et reason sont requis' });
    }

    const validReasons = [
      'question_incorrecte',
      'reponse_non_accpeter',
      'categorie_incorrecte',
      'question_obsolete',
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Raison invalide' });
    }

    const id = `report_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await database.execute({
      sql: `INSERT INTO question_reports (id, question_id, question_text, reason, reported_by, reported_by_id)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, questionId, questionText, reason, user.login, user.userId],
    });

    return res.status(201).json({ success: true, id });
  }

  // GET — Lister les signalements (admin uniquement)
  if (req.method === 'GET') {
    const admin = await requireAdminAuth(req);
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });

    const status = (req.query.status as string) || 'pending';

    const result = await database.execute({
      sql: `SELECT * FROM question_reports WHERE status = ? ORDER BY created_at DESC`,
      args: [status],
    });

    const reports = result.rows.map(row => ({
      id: row.id,
      questionId: row.question_id,
      questionText: row.question_text,
      reason: row.reason,
      reportedBy: row.reported_by,
      reportedById: row.reported_by_id,
      status: row.status,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
    }));

    return res.status(200).json(reports);
  }

  // PUT — Marquer comme traité (admin uniquement)
  if (req.method === 'PUT') {
    const admin = await requireAdminAuth(req);
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });

    const putBody = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { reportId } = putBody;
    if (!reportId) return res.status(400).json({ error: 'reportId requis' });

    await database.execute({
      sql: `UPDATE question_reports SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?`,
      args: [reportId],
    });

    return res.status(200).json({ success: true });
  }

  // DELETE — Supprimer un signalement (admin uniquement)
  if (req.method === 'DELETE') {
    const admin = await requireAdminAuth(req);
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });

    const delBody = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { reportId: delReportId } = delBody;
    if (!delReportId) return res.status(400).json({ error: 'reportId requis' });

    await database.execute({
      sql: `DELETE FROM question_reports WHERE id = ?`,
      args: [delReportId],
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
