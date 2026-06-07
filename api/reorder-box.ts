import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdminAuth, applyCors } from './_utils.js';
import { getDb } from './_db.js';

/**
 * POST /api/reorder-box
 * Body: { boxName: string, questionIds: string[] }
 *
 * Met à jour le created_at de chaque question avec des timestamps incrémentaux
 * pour forcer l'ordre souhaité dans les boîtes ordonnées.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdminAuth(req);
  if (!admin) {
    return res.status(401).json({ error: 'Unauthorized — admin Twitch requis' });
  }

  const { boxName, questionIds } = req.body;

  if (!boxName || !Array.isArray(questionIds) || questionIds.length === 0) {
    return res.status(400).json({ error: 'boxName et questionIds[] requis' });
  }

  try {
    // Vérifier que toutes les questions existent dans cette boîte
    const existing = await getDb().execute({
      sql: 'SELECT id FROM questions WHERE box_name = ?',
      args: [boxName],
    });
    const existingIds = new Set(existing.rows.map(r => r.id as string));

    const missing = questionIds.filter(id => !existingIds.has(id));
    if (missing.length > 0) {
      return res.status(400).json({
        error: `${missing.length} question(s) introuvable(s) dans la boîte "${boxName}"`,
        missing,
      });
    }

    // Mettre à jour created_at avec des timestamps incrémentaux (1 seconde d'écart)
    // Utilisation de batch() pour envoyer toutes les mises à jour en une seule transaction réseau
    const baseDate = new Date('2020-01-01T00:00:00Z');

    const statements = questionIds.map((id: string, i: number) => {
      const ts = new Date(baseDate.getTime() + i * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
      return {
        sql: 'UPDATE questions SET created_at = ? WHERE id = ? AND box_name = ?',
        args: [ts, id, boxName],
      };
    });

    await getDb().batch(statements as any, 'write');

    return res.status(200).json({
      success: true,
      boxName,
      updated: questionIds.length,
      message: `${questionIds.length} questions réordonnées dans "${boxName}"`,
    });
  } catch (err: any) {
    console.error('Reorder box error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
