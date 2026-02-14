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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await getDb().execute('SELECT name, card_numbers FROM boxes ORDER BY name');

    const boxes = result.rows.map((row) => ({
      name: row.name,
      cardNumbers: row.card_numbers ? JSON.parse(row.card_numbers as string) : [],
    }));

    return res.status(200).json({ boxes });
  } catch (error) {
    console.error('API /boxes error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
