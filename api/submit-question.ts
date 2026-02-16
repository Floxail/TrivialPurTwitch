import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type Client } from '@libsql/client';
import { checkRateLimit } from './_utils.js';

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Valide le token Twitch et retourne les infos utilisateur.
 * Tout utilisateur connecté peut proposer une question.
 */
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Rate limiting : 10 soumissions par minute par IP
  if (checkRateLimit(req, res, 10, 60_000)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // L'utilisateur doit être connecté via Twitch
  const user = await validateTwitchUser(req);
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
             question_type, qcm_options, qcm_correct_index,
             submitted_by, submitted_by_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
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
