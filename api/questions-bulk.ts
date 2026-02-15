import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type Client } from '@libsql/client';
import dotenv from 'dotenv';
import { requireAuth } from './_utils';

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

/**
 * POST /api/questions-bulk
 * Body: { questions: Question[] }
 *
 * Insère plusieurs questions en batch (max 200 par requête pour rester sous le timeout 10s).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Le champ "questions" (tableau non vide) est requis' });
    }

    if (questions.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 questions par requête (timeout Vercel 10s)' });
    }

    const statements = questions.map((q: any) => ({
      sql: `INSERT OR IGNORE INTO questions
            (id, question, answer, alternative_answers, category, box_name,
             card_number, difficulty, question_type, qcm_options, qcm_correct_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ],
    }));

    await getDb().batch(statements as any);

    return res.status(201).json({ success: true, count: questions.length });
  } catch (error) {
    console.error('API /questions-bulk error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
