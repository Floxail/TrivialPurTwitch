// Lancer : yarn test:api
// Teste le SQL d'identité joueur contre une vraie base SQLite en mémoire (pas de mock).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type Client } from '@libsql/client';
import {
  LEADERBOARD_SQL,
  PLAYER_KEY_BY_NICK_SQL,
  PLAYER_TOTALS_SQL,
  PLAYER_HISTORY_SQL,
  PLAYER_BY_BOX_SQL,
  PLAYER_STREAMS_SQL,
  PLAYER_BEST_SESSION_SQL,
  PLAYER_KEY_EXPR,
} from './_utils.ts';

let db: Client;

type Row = { tid: string; nick: string; score: number; session: string; at: string };

async function seed(rows: Row[]) {
  db = createClient({ url: ':memory:' });
  await db.execute(`CREATE TABLE scores (
    twitch_id TEXT, nick TEXT, score INTEGER, answers INTEGER DEFAULT 0,
    firsts INTEGER DEFAULT 0, combos INTEGER DEFAULT 0, fastest REAL DEFAULT 0,
    session_id TEXT, box_name TEXT, channel_name TEXT, channel_id TEXT,
    created_at TEXT
  )`);
  for (const r of rows) {
    await db.execute({
      sql: `INSERT INTO scores (twitch_id, nick, score, answers, session_id, box_name, channel_name, created_at)
            VALUES (?, ?, ?, 1, ?, 'Cinema', 'streamer1', ?)`,
      args: [r.tid, r.nick, r.score, r.session, r.at],
    });
  }
}

async function leaderboard(limit = 50) {
  const res = await db.execute({ sql: LEADERBOARD_SQL, args: [limit] });
  return res.rows.map((r) => ({ nick: r.nick as string, total: Number(r.total_score) }));
}

async function resolveKey(nick: string): Promise<string | null> {
  const res = await db.execute({ sql: PLAYER_KEY_BY_NICK_SQL, args: [nick] });
  return res.rows.length > 0 ? (res.rows[0].player_key as string) : null;
}

beforeEach(() => {
  db = undefined as unknown as Client;
});

test('un même twitch_id sous deux casses ne compte que pour un joueur', async () => {
  await seed([
    { tid: '111', nick: 'FloXaiL', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '111', nick: 'floxail', score: 5, session: 's2', at: '2026-01-02' },
  ]);
  const board = await leaderboard();
  assert.equal(board.length, 1);
  assert.equal(board[0].total, 15);
});

test('le nick affiché est celui de la ligne la plus récente', async () => {
  await seed([
    { tid: '111', nick: 'AncienNom', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '111', nick: 'NouveauNom', score: 5, session: 's2', at: '2026-06-01' },
  ]);
  const board = await leaderboard();
  assert.equal(board[0].nick, 'NouveauNom');
});

test('un renommage Twitch conserve l\'historique sous une seule entrée', async () => {
  await seed([
    { tid: '222', nick: 'avant', score: 30, session: 's1', at: '2026-01-01' },
    { tid: '222', nick: 'apres', score: 20, session: 's2', at: '2026-02-01' },
  ]);
  const board = await leaderboard();
  assert.equal(board.length, 1);
  assert.equal(board[0].total, 50);
  assert.equal(board[0].nick, 'apres');
});

test('deux twitch_id différents partageant un nick restent deux joueurs', async () => {
  await seed([
    { tid: '111', nick: 'pseudo', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '999', nick: 'pseudo', score: 7, session: 's2', at: '2026-01-02' },
  ]);
  const board = await leaderboard();
  assert.equal(board.length, 2);
  assert.deepEqual(board.map((b) => b.total).sort((a, b) => b - a), [10, 7]);
});

test('les lignes héritées sans twitch_id retombent sur le nick normalisé', async () => {
  await seed([
    { tid: '', nick: 'Legacy', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '', nick: 'legacy', score: 4, session: 's2', at: '2026-01-02' },
  ]);
  const board = await leaderboard();
  assert.equal(board.length, 1);
  assert.equal(board[0].total, 14);
});

test('une ligne héritée et une ligne avec twitch_id restent distinctes', async () => {
  // On ne peut pas prouver que la ligne héritée appartient au même compte :
  // les fusionner inventerait une donnée qu'on n'a pas.
  await seed([
    { tid: '', nick: 'ambigu', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '333', nick: 'ambigu', score: 3, session: 's2', at: '2026-01-02' },
  ]);
  const board = await leaderboard();
  assert.equal(board.length, 2);
});

test('le classement est trié par score total décroissant', async () => {
  await seed([
    { tid: '1', nick: 'petit', score: 5, session: 's1', at: '2026-01-01' },
    { tid: '2', nick: 'gros', score: 50, session: 's2', at: '2026-01-01' },
    { tid: '3', nick: 'moyen', score: 20, session: 's3', at: '2026-01-01' },
  ]);
  const board = await leaderboard();
  assert.deepEqual(board.map((b) => b.nick), ['gros', 'moyen', 'petit']);
});

test('la limite du classement est respectée', async () => {
  await seed([
    { tid: '1', nick: 'a', score: 5, session: 's1', at: '2026-01-01' },
    { tid: '2', nick: 'b', score: 50, session: 's2', at: '2026-01-01' },
    { tid: '3', nick: 'c', score: 20, session: 's3', at: '2026-01-01' },
  ]);
  assert.equal((await leaderboard(2)).length, 2);
});

test('résout un nick vers sa clé d\'identité quelle que soit la casse', async () => {
  await seed([
    { tid: '111', nick: 'FloXaiL', score: 10, session: 's1', at: '2026-01-01' },
  ]);
  assert.equal(await resolveKey('floxail'), '111');
  assert.equal(await resolveKey('FLOXAIL'), '111');
});

test('résout un nick hérité vers sa clé nick normalisée', async () => {
  await seed([{ tid: '', nick: 'Legacy', score: 10, session: 's1', at: '2026-01-01' }]);
  assert.equal(await resolveKey('LEGACY'), 'legacy');
});

test('un nick inconnu ne résout vers aucune clé', async () => {
  await seed([{ tid: '111', nick: 'FloXaiL', score: 10, session: 's1', at: '2026-01-01' }]);
  assert.equal(await resolveKey('inconnu'), null);
});

test('les totaux joueur agrègent toutes les casses du même compte', async () => {
  await seed([
    { tid: '111', nick: 'FloXaiL', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '111', nick: 'floxail', score: 5, session: 's2', at: '2026-01-02' },
  ]);
  const key = await resolveKey('FLOXAIL');
  const res = await db.execute({ sql: PLAYER_TOTALS_SQL, args: [key] });
  assert.equal(res.rows.length, 1);
  assert.equal(Number(res.rows[0].total_score), 15);
  assert.equal(Number(res.rows[0].sessions), 2);
  assert.equal(res.rows[0].nick, 'floxail');
});

test('les scores d\'un homonyme ne fuient pas dans les totaux', async () => {
  await seed([
    { tid: '111', nick: 'pseudo', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '999', nick: 'pseudo', score: 7, session: 's2', at: '2026-01-02' },
  ]);
  const res = await db.execute({ sql: PLAYER_TOTALS_SQL, args: ['111'] });
  assert.equal(Number(res.rows[0].total_score), 10);
});

test('les lignes insérées dans la même session départagent par rowid', async () => {
  // Un batch de fin de quiz écrit toutes ses lignes avec le même created_at :
  // sans départage, le nick affiché serait non déterministe.
  await seed([
    { tid: '111', nick: 'Premier', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '111', nick: 'Dernier', score: 5, session: 's1', at: '2026-01-01' },
  ]);
  const board = await leaderboard();
  assert.equal(board[0].nick, 'Dernier');
});

test('l\'historique regroupe les sessions de toutes les casses du compte', async () => {
  await seed([
    { tid: '111', nick: 'FloXaiL', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '111', nick: 'floxail', score: 5, session: 's2', at: '2026-01-02' },
    { tid: '999', nick: 'autre', score: 7, session: 's3', at: '2026-01-03' },
  ]);
  const res = await db.execute({ sql: PLAYER_HISTORY_SQL, args: ['111', 50] });
  assert.equal(res.rows.length, 2);
  assert.deepEqual(res.rows.map((r) => r.session_id), ['s2', 's1']);
});

test('l\'historique respecte sa limite', async () => {
  await seed([
    { tid: '111', nick: 'a', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '111', nick: 'a', score: 5, session: 's2', at: '2026-01-02' },
    { tid: '111', nick: 'a', score: 5, session: 's3', at: '2026-01-03' },
  ]);
  const res = await db.execute({ sql: PLAYER_HISTORY_SQL, args: ['111', 2] });
  assert.equal(res.rows.length, 2);
});

test('les stats par boîte agrègent toutes les casses du compte', async () => {
  await seed([
    { tid: '111', nick: 'FloXaiL', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '111', nick: 'floxail', score: 6, session: 's2', at: '2026-01-02' },
    { tid: '999', nick: 'autre', score: 99, session: 's3', at: '2026-01-03' },
  ]);
  const res = await db.execute({ sql: PLAYER_BY_BOX_SQL, args: ['111'] });
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].box_name, 'Cinema');
  assert.equal(Number(res.rows[0].games), 2);
  assert.equal(Number(res.rows[0].total_score), 16);
});

test('les streams du joueur agrègent toutes les casses du compte', async () => {
  await seed([
    { tid: '111', nick: 'FloXaiL', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '111', nick: 'floxail', score: 6, session: 's2', at: '2026-01-02' },
    { tid: '999', nick: 'autre', score: 99, session: 's3', at: '2026-01-03' },
  ]);
  const res = await db.execute({ sql: PLAYER_STREAMS_SQL, args: ['111'] });
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].channel_name, 'streamer1');
  assert.equal(Number(res.rows[0].sessions), 2);
  assert.equal(Number(res.rows[0].total_score), 16);
});

test("la meilleure session ignore les scores d'un homonyme", async () => {
  await seed([
    { tid: '111', nick: 'pseudo', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '999', nick: 'pseudo', score: 99, session: 's2', at: '2026-01-02' },
  ]);
  const res = await db.execute({ sql: PLAYER_BEST_SESSION_SQL, args: ['111'] });
  assert.equal(res.rows.length, 1);
  assert.equal(Number(res.rows[0].score), 10);
});

// stats.ts compose PLAYER_KEY_EXPR dans un COUNT(DISTINCT ...) pour le total
// joueurs et le nombre de joueurs par chaîne. Ce test vérifie que la composition
// est du SQL valide et compte bien par compte, pas par pseudo.
test('le total joueurs compte les comptes, pas les pseudos', async () => {
  await seed([
    { tid: '111', nick: 'FloXaiL', score: 10, session: 's1', at: '2026-01-01' },
    { tid: '111', nick: 'floxail', score: 5, session: 's2', at: '2026-01-02' },
    { tid: '999', nick: 'autre', score: 7, session: 's3', at: '2026-01-03' },
  ]);
  const res = await db.execute(
    `SELECT COUNT(DISTINCT ${PLAYER_KEY_EXPR}) as total_players FROM scores`,
  );
  assert.equal(Number(res.rows[0].total_players), 2);
});
