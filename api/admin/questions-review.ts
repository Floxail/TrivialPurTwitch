import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type Client } from '@libsql/client';
import { requireAdminAuth, checkRateLimit } from '../_utils.js';

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

function rowToPendingQuestion(row: any) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    alternativeAnswers: row.alternative_answers
      ? JSON.parse(row.alternative_answers as string)
      : undefined,
    category: row.category,
    boxName: row.box_name,
    questionType: row.question_type ?? 'free_text',
    qcmOptions: row.qcm_options
      ? JSON.parse(row.qcm_options as string)
      : undefined,
    qcmCorrectIndex: row.qcm_correct_index ?? undefined,
    submittedBy: row.submitted_by,
    submittedById: row.submitted_by_id,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Toutes les actions nécessitent une auth admin Twitch
  const admin = await requireAdminAuth(req);
  if (!admin) {
    // Rate limiting uniquement pour les non-admins (401)
    if (checkRateLimit(req, res, 30, 60_000)) return;
    return res.status(401).json({ error: 'Unauthorized — admin Twitch requis' });
  }

  try {
    // ==================== GET : Lister les questions en attente ====================
    if (req.method === 'GET') {
      const { status: filterStatus, limit: rawLimit } = req.query;
      const limit = Math.min(parseInt(rawLimit as string) || 50, 200);
      const status = (filterStatus as string) || 'pending';

      const result = await getDb().execute({
        sql: 'SELECT * FROM pending_questions WHERE status = ? ORDER BY created_at DESC LIMIT ?',
        args: [status, limit],
      });

      return res.json({
        questions: result.rows.map(rowToPendingQuestion),
        total: result.rows.length,
      });
    }

    // ==================== POST : Approuver une question ====================
    if (req.method === 'POST') {
      const { id, boxName } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'id requis' });
      }

      // Récupérer la question pending
      const pending = await getDb().execute({
        sql: 'SELECT * FROM pending_questions WHERE id = ? AND status = ?',
        args: [id, 'pending'],
      });

      if (pending.rows.length === 0) {
        return res.status(404).json({ error: 'Question non trouvée ou déjà traitée' });
      }

      const q = pending.rows[0];
      const targetBox = boxName || q.box_name || 'Propositions';

      // Insérer dans la table principale (avec created_at original pour préserver l'ordre de soumission)
      // + garantit que la row boxes existe pour la boîte cible (sinon édition de meta perdue)
      await getDb().batch([
        {
          sql: 'INSERT OR IGNORE INTO boxes (name, card_numbers) VALUES (?, ?)',
          args: [targetBox, '[]'],
        },
        {
          sql: `INSERT OR REPLACE INTO questions
                (id, question, answer, alternative_answers, category, box_name,
                 difficulty, question_type, qcm_options, qcm_correct_index,
                 created_by, created_by_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'medium', ?, ?, ?, ?, ?, ?)`,
          args: [
            q.id,
            q.question,
            q.answer,
            q.alternative_answers ?? null,
            q.category ?? 0,
            targetBox,
            q.question_type ?? 'free_text',
            q.qcm_options ?? null,
            q.qcm_correct_index ?? null,
            q.submitted_by ?? null,
            q.submitted_by_id ?? null,
            q.created_at ?? null,
          ],
        },
      ]);

      // Marquer comme approuvée
      await getDb().execute({
        sql: `UPDATE pending_questions SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`,
        args: [admin.login, id],
      });

      return res.status(200).json({ success: true, id, action: 'approved', boxName: targetBox });
    }

    // ==================== PUT : Modifier une question (tout statut) ====================
    if (req.method === 'PUT') {
      const { id } = req.query;
      const updates = req.body;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'id requis en query param' });
      }

      const setClauses: string[] = [];
      const args: any[] = [];

      const fieldMap: Record<string, string> = {
        question: 'question',
        answer: 'answer',
        alternativeAnswers: 'alternative_answers',
        category: 'category',
        boxName: 'box_name',
        questionType: 'question_type',
        qcmOptions: 'qcm_options',
        qcmCorrectIndex: 'qcm_correct_index',
        status: 'status',
      };

      for (const [jsField, dbField] of Object.entries(fieldMap)) {
        if (jsField in updates) {
          let value = updates[jsField];
          if ((jsField === 'alternativeAnswers' || jsField === 'qcmOptions') && value) {
            value = JSON.stringify(value);
          }
          setClauses.push(`${dbField} = ?`);
          args.push(value ?? null);
        }
      }

      // Si changement de statut, mettre à jour reviewed_by et reviewed_at
      if ('status' in updates) {
        setClauses.push('reviewed_by = ?');
        args.push(admin.login);
        setClauses.push("reviewed_at = datetime('now')");
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'Aucune modification fournie' });
      }

      args.push(id);

      await getDb().execute({
        sql: `UPDATE pending_questions SET ${setClauses.join(', ')} WHERE id = ?`,
        args,
      });

      return res.status(200).json({ success: true, id });
    }

    // ==================== DELETE : Rejeter une question ====================
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'id requis en query param' });
      }

      await getDb().execute({
        sql: `UPDATE pending_questions SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`,
        args: [admin.login, id],
      });

      return res.status(200).json({ success: true, id, action: 'rejected' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Admin questions-review error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
