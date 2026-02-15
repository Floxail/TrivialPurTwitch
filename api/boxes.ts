import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type Client } from '@libsql/client';
import dotenv from 'dotenv';
import { requireAuth } from './_middleware';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ==================== GET ====================
    if (req.method === 'GET') {
      const result = await getDb().execute('SELECT name, card_numbers FROM boxes ORDER BY name');

      const boxes = result.rows.map((row) => ({
        name: row.name,
        cardNumbers: row.card_numbers ? JSON.parse(row.card_numbers as string) : [],
      }));

      return res.status(200).json({ boxes });
    }

    // ==================== AUTH REQUISE ====================
    if (!requireAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ==================== POST (créer une boîte) ====================
    if (req.method === 'POST') {
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Le nom de la boîte est requis' });
      }

      await getDb().execute({
        sql: 'INSERT OR IGNORE INTO boxes (name, card_numbers) VALUES (?, ?)',
        args: [name.trim(), '[]'],
      });

      return res.status(201).json({ success: true, name: name.trim() });
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
