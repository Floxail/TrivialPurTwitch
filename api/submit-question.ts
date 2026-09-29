import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, applyCors, requireAnyTwitchAuth, validateSubmission } from './_utils.js';
import { getDb, runMigrations } from './_db.js';


export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await runMigrations();
  } catch {
    // Ignore migration errors, continue
  }

  // 100/min : la soumission en masse (contribution-page) envoie une requête par question
  if (checkRateLimit(req, res, 100, 60_000)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // L'utilisateur doit être connecté via Twitch
  const user = await requireAnyTwitchAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Token Twitch invalide ou expiré' });
  }

  try {
    const validation = validateSubmission(req.body);
    if ('error' in validation) {
      return res.status(400).json({ error: validation.error });
    }
    const s = validation.submission;

    // Générer un ID unique
    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await getDb().execute({
      sql: `INSERT INTO pending_questions
            (id, question, answer, alternative_answers, category, box_name,
             question_type, qcm_options, qcm_correct_index, qcm_correct_indexes,
             image_url, answer_image_url, submitted_by, submitted_by_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
      args: [
        id,
        s.question,
        s.answer,
        s.alternativeAnswers ? JSON.stringify(s.alternativeAnswers) : null,
        s.category,
        s.boxName,
        s.questionType,
        s.qcmOptions ? JSON.stringify(s.qcmOptions) : null,
        s.qcmCorrectIndex,
        s.qcmCorrectIndexes ? JSON.stringify(s.qcmCorrectIndexes) : null,
        s.imageUrl,
        s.answerImageUrl,
        user.login,
        user.userId,
      ],
    });

    return res.status(201).json({
      success: true,
      id,
      message: 'Question soumise pour modération',
    });
  } catch (err) {
    console.error('Submit question error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
