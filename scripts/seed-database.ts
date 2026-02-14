/**
 * Script de seed : crée les tables et importe les questions depuis questions.json
 *
 * Usage : npx ts-node --esm scripts/seed-database.ts
 * (nécessite .env.development.local avec TURSO_DATABASE_URL et TURSO_AUTH_TOKEN)
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

interface QuestionJSON {
  id: string;
  question: string;
  answer: string;
  alternativeAnswers?: string[];
  category: number;
  boxName: string;
  cardNumber?: number;
  difficulty?: string;
  questionType?: string;
  qcmOptions?: string[];
  qcmCorrectIndex?: number;
}

interface BoxJSON {
  name: string;
  cardNumbers: number[];
  totalQuestions: number;
}

interface QuestionsFile {
  version: string;
  boxes: BoxJSON[];
  questions: QuestionJSON[];
}

async function seed() {
  console.log('Connexion à Turso...');
  console.log('URL:', process.env.TURSO_DATABASE_URL?.substring(0, 30) + '...');

  // Créer les tables
  console.log('\n--- Création des tables ---');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS boxes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      card_numbers TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log('✓ Table boxes créée');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS questions (
      id                  TEXT PRIMARY KEY,
      question            TEXT NOT NULL,
      answer              TEXT NOT NULL,
      alternative_answers TEXT,
      category            INTEGER NOT NULL DEFAULT 0,
      box_name            TEXT NOT NULL,
      card_number         INTEGER,
      difficulty          TEXT DEFAULT 'medium',
      question_type       TEXT DEFAULT 'free_text',
      qcm_options         TEXT,
      qcm_correct_index   INTEGER,
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log('✓ Table questions créée');

  // Créer les index
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_questions_box ON questions(box_name)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type)`);
  console.log('✓ Index créés');

  // Charger les données
  const dataPath = path.resolve(__dirname, '../public/questions/questions.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const data: QuestionsFile = JSON.parse(raw);

  console.log(`\n--- Import des données ---`);
  console.log(`Boxes: ${data.boxes.length}`);
  console.log(`Questions: ${data.questions.length}`);

  // Insérer les boîtes
  console.log('\nInsertion des boîtes...');
  for (const box of data.boxes) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO boxes (name, card_numbers) VALUES (?, ?)',
      args: [box.name, JSON.stringify(box.cardNumbers)],
    });
  }
  console.log(`✓ ${data.boxes.length} boîtes insérées`);

  // Insérer les questions par batch de 100
  console.log('\nInsertion des questions...');
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < data.questions.length; i += BATCH_SIZE) {
    const batch = data.questions.slice(i, i + BATCH_SIZE);

    const statements = batch.map((q) => ({
      sql: `INSERT OR IGNORE INTO questions
            (id, question, answer, alternative_answers, category, box_name,
             card_number, difficulty, question_type, qcm_options, qcm_correct_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        q.id,
        q.question,
        q.answer,
        q.alternativeAnswers ? JSON.stringify(q.alternativeAnswers) : null,
        q.category,
        q.boxName,
        q.cardNumber ?? null,
        q.difficulty ?? 'medium',
        q.questionType ?? 'free_text',
        q.qcmOptions ? JSON.stringify(q.qcmOptions) : null,
        q.qcmCorrectIndex ?? null,
      ],
    }));

    await db.batch(statements as any);
    inserted += batch.length;
    process.stdout.write(`\r  ${inserted}/${data.questions.length} questions...`);
  }

  console.log(`\n✓ ${inserted} questions insérées`);

  // Vérification
  const countBoxes = await db.execute('SELECT COUNT(*) as count FROM boxes');
  const countQuestions = await db.execute('SELECT COUNT(*) as count FROM questions');
  console.log(`\n--- Vérification ---`);
  console.log(`Boxes en DB: ${countBoxes.rows[0].count}`);
  console.log(`Questions en DB: ${countQuestions.rows[0].count}`);

  console.log('\n✅ Seed terminé !');
}

seed().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
