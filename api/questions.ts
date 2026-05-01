import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type Client } from '@libsql/client';
import dotenv from 'dotenv';
import { requireAdminAuth } from './_utils.js';

dotenv.config({ path: '.env.local' });

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

/** Transforme une row DB en objet frontend */
function rowToQuestion(row: any) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    alternativeAnswers: row.alternative_answers
      ? JSON.parse(row.alternative_answers as string)
      : undefined,
    category: row.category,
    boxName: row.box_name,
    cardNumber: row.card_number ?? undefined,
    difficulty: row.difficulty,
    questionType: row.question_type ?? 'free_text',
    qcmOptions: row.qcm_options
      ? JSON.parse(row.qcm_options as string)
      : undefined,
    qcmCorrectIndex: row.qcm_correct_index ?? undefined,
    qcmCorrectIndexes: row.qcm_correct_indexes
      ? JSON.parse(row.qcm_correct_indexes as string)
      : undefined,
    createdAt: row.created_at ?? undefined,
    imageUrl: row.image_url ?? undefined,
    answerImageUrl: row.answer_image_url ?? undefined,
  };
}

/** Migration paresseuse : ajoute qcm_correct_indexes si la colonne n'existe pas encore */
let migrationDone = false;
async function ensureMigration() {
  if (migrationDone) return;
  await getDb().execute('ALTER TABLE questions ADD COLUMN qcm_correct_indexes TEXT').catch(() => {});
  await getDb().execute('ALTER TABLE questions ADD COLUMN created_by TEXT').catch(() => {});
  await getDb().execute('ALTER TABLE questions ADD COLUMN created_by_id TEXT').catch(() => {});
  await getDb().execute("ALTER TABLE questions ADD COLUMN created_at TEXT DEFAULT (datetime('now'))").catch(() => {});
  await getDb().execute('ALTER TABLE questions ADD COLUMN image_url TEXT').catch(() => {});
  await getDb().execute('ALTER TABLE questions ADD COLUMN answer_image_url TEXT').catch(() => {});
  // Backfill: copier created_at depuis pending_questions pour les questions approuvées existantes
  await getDb().execute(`
    UPDATE questions SET created_at = (
      SELECT pq.created_at FROM pending_questions pq WHERE pq.id = questions.id
    ) WHERE created_at IS NULL AND EXISTS (
      SELECT 1 FROM pending_questions pq WHERE pq.id = questions.id
    )
  `).catch(() => {});
  migrationDone = true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureMigration();

    // ==================== GET ====================
    if (req.method === 'GET') {
      const { boxName } = req.query;

      let sql = 'SELECT * FROM questions';
      const args: any[] = [];

      if (boxName && typeof boxName === 'string') {
        sql += ' WHERE box_name = ?';
        args.push(boxName);
      }

      sql += ' ORDER BY rowid';

      const result = await getDb().execute({ sql, args });
      const questions = result.rows.map(rowToQuestion);

      return res.status(200).json({ questions });
    }

    // ==================== AUTH REQUISE (token Twitch admin) ====================
    const admin = await requireAdminAuth(req);
    if (!admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ==================== POST (créer une question) ====================
    if (req.method === 'POST') {
      const q = req.body;

      if (!q || !q.id || !q.question || !q.answer || !q.boxName) {
        return res.status(400).json({ error: 'Champs requis manquants: id, question, answer, boxName' });
      }

      await getDb().batch([
        // Garantit que la row boxes existe pour cette boîte (sinon édition de meta perdue)
        {
          sql: 'INSERT OR IGNORE INTO boxes (name, card_numbers) VALUES (?, ?)',
          args: [q.boxName, '[]'],
        },
        {
          sql: `INSERT OR REPLACE INTO questions
                (id, question, answer, alternative_answers, category, box_name,
                 card_number, difficulty, question_type, qcm_options, qcm_correct_index, qcm_correct_indexes,
                 created_by, created_by_id, created_at, image_url, answer_image_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
          args: [
            q.id,
            q.question,
            q.answer,
            q.alternativeAnswers ? JSON.stringify(q.alternativeAnswers) : null,
            q.category ?? 0,
            q.boxName,
            q.cardNumber ?? null,
            q.difficulty ?? 'medium',
            q.questionType ?? 'free_text',
            q.qcmOptions ? JSON.stringify(q.qcmOptions) : null,
            q.qcmCorrectIndex ?? null,
            q.qcmCorrectIndexes ? JSON.stringify(q.qcmCorrectIndexes) : null,
            admin.login,
            admin.userId,
            q.imageUrl || null,
            q.answerImageUrl || null,
          ],
        },
      ]);

      return res.status(201).json({ success: true, id: q.id });
    }

    // ==================== PUT (modifier une question) ====================
    if (req.method === 'PUT') {
      const { id } = req.query;
      const updates = req.body;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID requis en query param' });
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Aucune mise à jour fournie' });
      }

      // Construire dynamiquement la requête UPDATE
      const setClauses: string[] = [];
      const args: any[] = [];

      const fieldMap: Record<string, string> = {
        question: 'question',
        answer: 'answer',
        alternativeAnswers: 'alternative_answers',
        category: 'category',
        boxName: 'box_name',
        cardNumber: 'card_number',
        difficulty: 'difficulty',
        questionType: 'question_type',
        qcmOptions: 'qcm_options',
        qcmCorrectIndex: 'qcm_correct_index',
        qcmCorrectIndexes: 'qcm_correct_indexes',
        imageUrl: 'image_url',
        answerImageUrl: 'answer_image_url',
      };

      for (const [jsField, dbField] of Object.entries(fieldMap)) {
        if (jsField in updates) {
          let value = updates[jsField];

          // Sérialiser les champs JSON
          if ((jsField === 'alternativeAnswers' || jsField === 'qcmOptions' || jsField === 'qcmCorrectIndexes') && value) {
            value = JSON.stringify(value);
          }

          setClauses.push(`${dbField} = ?`);
          args.push(value ?? null);
        }
      }

      // Toujours mettre à jour updated_at
      setClauses.push(`updated_at = datetime('now')`);

      args.push(id);

      await getDb().execute({
        sql: `UPDATE questions SET ${setClauses.join(', ')} WHERE id = ?`,
        args,
      });

      return res.status(200).json({ success: true, id });
    }

    // ==================== DELETE ====================
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID requis en query param' });
      }

      await getDb().execute({
        sql: 'DELETE FROM questions WHERE id = ?',
        args: [id],
      });

      return res.status(200).json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API /questions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
