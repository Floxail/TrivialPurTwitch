import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type Client } from '@libsql/client';
import dotenv from 'dotenv';

// En dev local, charger les env vars depuis .env.local
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { boxName } = req.query;

    let sql = 'SELECT * FROM questions';
    const args: any[] = [];

    if (boxName && typeof boxName === 'string') {
      sql += ' WHERE box_name = ?';
      args.push(boxName);
    }

    const result = await getDb().execute({ sql, args });

    // Transformer les colonnes DB → format frontend
    const questions = result.rows.map((row) => ({
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
    }));

    return res.status(200).json({ questions });
  } catch (error) {
    console.error('API /questions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
