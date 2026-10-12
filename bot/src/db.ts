import { createClient, type Client, type Row, type Value } from '@libsql/client';
import { QuestionType, type Question } from '../../src/types/question';
import type { BoxMeta, Catalog } from './catalog';
import type { Player } from './game-state';
import { requireEnv } from './env';

let client: Client | undefined;

function db(): Client {
  client ??= createClient({ url: requireEnv('TURSO_DATABASE_URL'), authToken: requireEnv('TURSO_AUTH_TOKEN') });
  return client;
}

export async function ensureSchema(): Promise<void> {
  await db().batch([
    `CREATE TABLE IF NOT EXISTS discord_scores (
      guild_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      username   TEXT NOT NULL,
      score      INTEGER NOT NULL DEFAULT 0,
      answers    INTEGER NOT NULL DEFAULT 0,
      firsts     INTEGER NOT NULL DEFAULT 0,
      combos     INTEGER NOT NULL DEFAULT 0,
      fastest    INTEGER NOT NULL DEFAULT 0,
      session_id TEXT NOT NULL,
      box_names  TEXT,
      channel_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    'CREATE INDEX IF NOT EXISTS idx_discord_scores_guild ON discord_scores(guild_id, user_id)',
  ], 'write');
}

// ponytail: même mapping que rowToQuestion de api/questions.ts, dupliqué pour que
// le bot n'ait pas besoin des dépendances de la racine. À factoriser si un 3e lecteur apparaît.
const optionalText = (value: Value | undefined) => (value == null ? undefined : String(value));

function parseList(value: Value | undefined): string[] | undefined {
  if (value == null) return undefined;
  const parsed: unknown = JSON.parse(String(value));
  return Array.isArray(parsed) ? parsed.map(String) : undefined;
}

function questionFromRow(row: Row): Question {
  return {
    id: String(row.id),
    question: String(row.question),
    answer: String(row.answer),
    alternativeAnswers: parseList(row.alternative_answers),
    boxName: String(row.box_name),
    questionType: row.question_type === 'qcm' ? QuestionType.QCM : QuestionType.FREE_TEXT,
    qcmOptions: parseList(row.qcm_options),
    qcmCorrectIndex: row.qcm_correct_index == null ? undefined : Number(row.qcm_correct_index),
    qcmCorrectIndexes: parseList(row.qcm_correct_indexes)?.map(Number),
    createdAt: optionalText(row.created_at),
    imageUrl: optionalText(row.image_url),
    answerImageUrl: optionalText(row.answer_image_url),
  };
}

function boxFromRow(row: Row): BoxMeta {
  return {
    name: String(row.name),
    ordered: Number(row.ordered) === 1,
    hidden: Number(row.hidden) === 1,
    parentBox: optionalText(row.parent_box) ?? null,
  };
}

const CATALOG_TTL_MS = 60_000;
let catalogCache: { catalog: Catalog; expiresAt: number } | undefined;

/** Résumé pour le menu : ≈ 100 ms, contre ≈ 1 s pour relire toutes les questions (mesuré : 5 420 questions, 1,5 Mo). */
export async function loadCatalog(): Promise<Catalog> {
  if (catalogCache && Date.now() < catalogCache.expiresAt) return catalogCache.catalog;
  const [boxRows, countRows] = await db().batch([
    'SELECT name, ordered, hidden, parent_box FROM boxes',
    'SELECT box_name, COUNT(*) AS count FROM questions GROUP BY box_name',
  ], 'read');
  const catalog = {
    boxes: boxRows.rows.map(boxFromRow),
    counts: countRows.rows.map(row => ({ boxName: String(row.box_name), count: Number(row.count) })),
  };
  catalogCache = { catalog, expiresAt: Date.now() + CATALOG_TTL_MS };
  return catalog;
}

/** Questions des boîtes choisies (sous-boîtes comprises), lues au lancement. */
export async function loadQuestions(boxNames: string[]): Promise<Question[]> {
  if (boxNames.length === 0) return [];
  const result = await db().execute({
    sql: `SELECT * FROM questions WHERE box_name IN (${boxNames.map(() => '?').join(', ')}) ORDER BY rowid`,
    args: boxNames,
  });
  return result.rows.map(questionFromRow);
}

export async function saveScores(guildId: string, channelId: string, sessionId: string, boxNames: string[], players: Player[]): Promise<void> {
  if (players.length === 0) return;
  const statements = players.map(player => ({
    sql: `INSERT INTO discord_scores (guild_id, user_id, username, score, answers, firsts, combos, fastest, session_id, box_names, channel_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [guildId, player.userId, player.name, player.score, player.answers, player.firsts, player.combos, player.fastest, sessionId, JSON.stringify(boxNames), channelId],
  }));
  try {
    await db().batch(statements, 'write');
  } catch {
    await db().batch(statements, 'write');
  }
}

export type LeaderboardEntry = { name: string; score: number; answers: number; firsts: number };

export async function leaderboard(guildId: string): Promise<LeaderboardEntry[]> {
  const result = await db().execute({
    sql: `SELECT
            (SELECT d2.username FROM discord_scores d2
             WHERE d2.guild_id = d.guild_id AND d2.user_id = d.user_id
             ORDER BY d2.created_at DESC, d2.rowid DESC LIMIT 1) AS username,
            SUM(score) AS score, SUM(answers) AS answers, SUM(firsts) AS firsts
          FROM discord_scores d
          WHERE guild_id = ?
          GROUP BY user_id
          ORDER BY score DESC
          LIMIT 10`,
    args: [guildId],
  });
  return result.rows.map(row => ({
    name: String(row.username),
    score: Number(row.score),
    answers: Number(row.answers),
    firsts: Number(row.firsts),
  }));
}

export async function deleteGuildScores(guildId: string): Promise<void> {
  await db().execute({ sql: 'DELETE FROM discord_scores WHERE guild_id = ?', args: [guildId] });
}
