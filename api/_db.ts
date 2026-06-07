import { createClient, type Client } from '@libsql/client';

let db: Client | undefined;

export function getDb(): Client {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
  }
  return db;
}

let migrationDone = false;

export async function runMigrations(): Promise<void> {
  if (migrationDone) return;

  const client = getDb();

  // CREATE TABLE IF NOT EXISTS — batch safe (idempotent)
  await client.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS question_stats (
        question_id TEXT PRIMARY KEY,
        times_asked INTEGER DEFAULT 0,
        times_correct INTEGER DEFAULT 0,
        times_wrong INTEGER DEFAULT 0,
        fastest_correct_ms INTEGER DEFAULT 0
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS question_reports (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        reason TEXT NOT NULL,
        reported_by TEXT NOT NULL,
        reported_by_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        resolved_at TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS question_history (
        twitch_id   TEXT NOT NULL,
        box_name    TEXT,
        question_id TEXT NOT NULL,
        played_at   TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (twitch_id, question_id)
      )`,
      args: [],
    },
  ], 'write');

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_history_twitch ON question_history(twitch_id)`).catch(() => {});
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_history_box ON question_history(twitch_id, box_name)`).catch(() => {});

  // ALTER TABLE — chaque colonne séparée car échoue si elle existe déjà
  await client.execute('ALTER TABLE questions ADD COLUMN qcm_correct_indexes TEXT').catch(() => {});
  await client.execute('ALTER TABLE questions ADD COLUMN created_by TEXT').catch(() => {});
  await client.execute('ALTER TABLE questions ADD COLUMN created_by_id TEXT').catch(() => {});
  await client.execute("ALTER TABLE questions ADD COLUMN created_at TEXT DEFAULT (datetime('now'))").catch(() => {});
  await client.execute('ALTER TABLE questions ADD COLUMN image_url TEXT').catch(() => {});
  await client.execute('ALTER TABLE questions ADD COLUMN answer_image_url TEXT').catch(() => {});

  await client.execute('ALTER TABLE scores ADD COLUMN channel_name TEXT').catch(() => {});
  await client.execute('ALTER TABLE scores ADD COLUMN channel_id TEXT').catch(() => {});

  await client.execute('ALTER TABLE boxes ADD COLUMN ordered INTEGER DEFAULT 0').catch(() => {});
  await client.execute('ALTER TABLE boxes ADD COLUMN created_by TEXT').catch(() => {});
  await client.execute('ALTER TABLE boxes ADD COLUMN created_by_id TEXT').catch(() => {});
  await client.execute('ALTER TABLE boxes ADD COLUMN description TEXT').catch(() => {});
  await client.execute('ALTER TABLE boxes ADD COLUMN hidden INTEGER DEFAULT 0').catch(() => {});
  await client.execute('ALTER TABLE boxes ADD COLUMN parent_box TEXT').catch(() => {});

  await client.execute('ALTER TABLE pending_questions ADD COLUMN qcm_correct_indexes TEXT').catch(() => {});
  await client.execute('ALTER TABLE pending_questions ADD COLUMN image_url TEXT').catch(() => {});
  await client.execute('ALTER TABLE pending_questions ADD COLUMN answer_image_url TEXT').catch(() => {});

  // Backfill created_at depuis pending_questions pour questions approuvées
  await client.execute(`
    UPDATE questions SET created_at = (
      SELECT pq.created_at FROM pending_questions pq WHERE pq.id = questions.id
    ) WHERE created_at IS NULL AND EXISTS (
      SELECT 1 FROM pending_questions pq WHERE pq.id = questions.id
    )
  `).catch(() => {});

  migrationDone = true;
}
