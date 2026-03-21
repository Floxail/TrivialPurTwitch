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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ==================== GET ====================
    if (req.method === 'GET') {
      // Auto-migrations
      await getDb().execute('ALTER TABLE boxes ADD COLUMN ordered INTEGER DEFAULT 0').catch(() => {});
      await getDb().execute('ALTER TABLE boxes ADD COLUMN created_by TEXT').catch(() => {});
      await getDb().execute('ALTER TABLE boxes ADD COLUMN created_by_id TEXT').catch(() => {});

      const result = await getDb().execute('SELECT name, card_numbers, ordered FROM boxes ORDER BY name');

      const boxes = result.rows.map((row) => ({
        name: row.name,
        cardNumbers: row.card_numbers ? JSON.parse(row.card_numbers as string) : [],
        ordered: row.ordered === 1,
      }));

      return res.status(200).json({ boxes });
    }

    // ==================== AUTH REQUISE (token Twitch admin) ====================
    const admin = await requireAdminAuth(req);
    if (!admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ==================== POST (créer une boîte) ====================
    if (req.method === 'POST') {
      const { name, ordered } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Le nom de la boîte est requis' });
      }

      await getDb().execute({
        sql: 'INSERT OR IGNORE INTO boxes (name, card_numbers, ordered, created_by, created_by_id) VALUES (?, ?, ?, ?, ?)',
        args: [name.trim(), '[]', ordered ? 1 : 0, admin.login, admin.userId],
      });

      return res.status(201).json({ success: true, name: name.trim() });
    }

    // ==================== PATCH (mettre à jour le flag ordered) ====================
    if (req.method === 'PATCH') {
      const { name, ordered } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Le nom de la boîte est requis' });
      }

      await getDb().execute({
        sql: 'UPDATE boxes SET ordered = ? WHERE name = ?',
        args: [ordered ? 1 : 0, name.trim()],
      });

      return res.status(200).json({ success: true, name: name.trim(), ordered: !!ordered });
    }

    // ==================== PUT (renommer une boîte) ====================
    if (req.method === 'PUT') {
      const { oldName, newName } = req.body;

      if (!oldName || typeof oldName !== 'string' || oldName.trim().length === 0) {
        return res.status(400).json({ error: 'oldName est requis' });
      }
      if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
        return res.status(400).json({ error: 'newName est requis' });
      }
      if (oldName.trim() === newName.trim()) {
        return res.status(400).json({ error: 'Le nouveau nom est identique à l\'ancien' });
      }

      await getDb().batch([
        {
          sql: 'UPDATE boxes SET name = ? WHERE name = ?',
          args: [newName.trim(), oldName.trim()],
        },
        {
          sql: 'UPDATE questions SET box_name = ? WHERE box_name = ?',
          args: [newName.trim(), oldName.trim()],
        },
      ]);

      return res.status(200).json({ success: true, oldName: oldName.trim(), newName: newName.trim() });
    }

    // ==================== DELETE (supprimer une boîte + ses questions) ====================
    if (req.method === 'DELETE') {
      const { name } = req.query;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Le nom de la boîte est requis en query param' });
      }

      // Supprimer les questions de cette boîte puis la boîte elle-même
      await getDb().batch([
        {
          sql: 'DELETE FROM questions WHERE box_name = ?',
          args: [name],
        },
        {
          sql: 'DELETE FROM boxes WHERE name = ?',
          args: [name],
        },
      ]);

      return res.status(200).json({ success: true, name });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API /boxes error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
