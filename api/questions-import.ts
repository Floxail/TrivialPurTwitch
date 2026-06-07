import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdminAuth } from './_utils.js';
import { getDb } from './_db.js';

/**
 * POST /api/questions-import
 * Body: { boxes: BoxData[], questions: QuestionData[] }
 *
 * Import complet d'un fichier JSON (format v2.0 ou v1.0).
 * Insère les boîtes et questions par batch de 100.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!await requireAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { boxes, questions } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Le champ "questions" (tableau) est requis' });
    }

    let boxesInserted = 0;
    let questionsInserted = 0;

    // Insérer les boîtes si fournies
    if (boxes && Array.isArray(boxes) && boxes.length > 0) {
      const boxStatements = boxes.map((box: any) => ({
        sql: 'INSERT OR IGNORE INTO boxes (name, card_numbers) VALUES (?, ?)',
        args: [
          box.name,
          box.cardNumbers ? JSON.stringify(box.cardNumbers) : '[]',
        ],
      }));

      await getDb().batch(boxStatements as any);
      boxesInserted = boxes.length;
    }

    // Insérer les questions par batch de 100 (timeout Vercel 10s)
    const BATCH_SIZE = 100;
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);

      const statements = batch.map((q: any) => ({
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
          q.boxName || q.trivialBox || 'Sans boîte',
          q.cardNumber ?? null,
          q.difficulty ?? 'medium',
          q.questionType ?? 'free_text',
          q.qcmOptions ? JSON.stringify(q.qcmOptions) : null,
          q.qcmCorrectIndex ?? null,
        ],
      }));

      await getDb().batch(statements as any);
      questionsInserted += batch.length;
    }

    return res.status(201).json({
      success: true,
      boxesInserted,
      questionsInserted,
    });
  } catch (error) {
    console.error('API /questions-import error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
