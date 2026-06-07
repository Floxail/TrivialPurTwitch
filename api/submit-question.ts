import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, applyCors, requireAnyTwitchAuth } from './_utils.js';
import { getDb, runMigrations } from './_db.js';


export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await runMigrations();
  } catch {
    // Ignore migration errors, continue
  }

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
    const {
      question,
      answer,
      alternativeAnswers,
      category,
      boxName,
      questionType,
      qcmOptions,
      qcmCorrectIndex,
      qcmCorrectIndexes,
      imageUrl,
      answerImageUrl,
    } = req.body;

    // Validation des champs obligatoires
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Le champ "question" est requis' });
    }
    if (!answer || typeof answer !== 'string' || !answer.trim()) {
      return res.status(400).json({ error: 'Le champ "answer" est requis' });
    }

    // Validation QCM
    if (questionType === 'qcm') {
      if (!Array.isArray(qcmOptions) || qcmOptions.length < 2 || qcmOptions.length > 6) {
        return res.status(400).json({ error: 'QCM : 2 à 6 options requises' });
      }
      if (typeof qcmCorrectIndex !== 'number' || qcmCorrectIndex < 0 || qcmCorrectIndex >= qcmOptions.length) {
        return res.status(400).json({ error: 'QCM : index de la bonne réponse invalide' });
      }
    }

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
        question.trim(),
        answer.trim(),
        alternativeAnswers ? JSON.stringify(alternativeAnswers) : null,
        category ?? 0,
        boxName || null,
        questionType || 'free_text',
        qcmOptions ? JSON.stringify(qcmOptions) : null,
        qcmCorrectIndex ?? null,
        qcmCorrectIndexes ? JSON.stringify(qcmCorrectIndexes) : null,
        imageUrl || null,
        answerImageUrl || null,
        user.login,
        user.userId,
      ],
    });

    return res.status(201).json({
      success: true,
      id,
      message: 'Question soumise pour modération',
    });
  } catch (err: any) {
    console.error('Submit question error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
