/**
 * Crée uniquement la table pending_questions (si elle n'existe pas)
 * Usage : npx ts-node --esm scripts/create-pending-table.ts
 */

import { createClient } from '@libsql/client';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function run() {
  console.log('Connexion à Turso...');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS pending_questions (
      id                  TEXT PRIMARY KEY,
      question            TEXT NOT NULL,
      answer              TEXT NOT NULL,
      alternative_answers TEXT,
      category            INTEGER NOT NULL DEFAULT 0,
      box_name            TEXT,
      question_type       TEXT DEFAULT 'free_text',
      qcm_options         TEXT,
      qcm_correct_index   INTEGER,
      submitted_by        TEXT,
      submitted_by_id     TEXT,
      status              TEXT DEFAULT 'pending',
      reviewed_by         TEXT,
      reviewed_at         TEXT,
      created_at          TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log('✓ Table pending_questions créée');

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_questions(status)`);
  console.log('✓ Index créé');

  console.log('\n✅ Terminé !');
}

run().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
