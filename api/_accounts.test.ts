// Lancer : yarn test:api
// Logique de liaison contre une vraie base SQLite en mémoire (pas de mock).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type Client } from '@libsql/client';
import {
  ACCOUNT_LINKS_SQL, upsertAccount, resolvePrimary, listGroup, linkAccounts, unlinkAccount,
  discordIdInGroup, discordTotals,
} from './_accounts.ts';

let db: Client;

beforeEach(async () => {
  db = createClient({ url: ':memory:' });
  for (const sql of ACCOUNT_LINKS_SQL) await db.execute(sql);
  await db.execute('CREATE TABLE pending_questions (id TEXT, submitted_by_id TEXT)');
  await db.execute('CREATE TABLE boxes (name TEXT, created_by_id TEXT)');
  await db.execute('CREATE TABLE question_reports (id TEXT, reported_by_id TEXT)');
  await db.execute(`CREATE TABLE discord_scores (guild_id TEXT, user_id TEXT, username TEXT, score INTEGER, answers INTEGER,
    firsts INTEGER, combos INTEGER, fastest INTEGER, session_id TEXT)`);
});

const discord = { providerId: 'discord:1', name: 'Flo', avatar: null };
const google = { providerId: 'google:9', name: 'Flo G', avatar: 'https://lh3/x.png' };
const twitch = { providerId: '42', name: 'floxail', avatar: null };
const submitterOf = async (id: string) =>
  (await db.execute({ sql: 'SELECT submitted_by_id FROM pending_questions WHERE id = ?', args: [id] })).rows[0].submitted_by_id;

test('un compte sans ligne est sa propre identité principale', async () => {
  assert.equal(await resolvePrimary(db, '42'), '42');
});

test('upsertAccount crée la ligne puis met à jour le nom sans toucher la liaison', async () => {
  await upsertAccount(db, discord);
  await linkAccounts(db, { primaryId: '42', name: 'floxail' }, discord);
  await upsertAccount(db, { ...discord, name: 'Flo2' });
  const [row] = (await listGroup(db, '42')).filter(a => a.providerId === 'discord:1');
  assert.equal(row.name, 'Flo2');
  assert.equal(row.primaryId, '42');
});

test('lier Discord à Twitch : propositions Discord réattribuées au Twitch', async () => {
  await upsertAccount(db, discord);
  await db.execute("INSERT INTO pending_questions VALUES ('q1', 'discord:1')");
  assert.equal(await linkAccounts(db, { primaryId: '42', name: 'floxail' }, discord), 'linked');
  assert.equal(await resolvePrimary(db, 'discord:1'), '42');
  assert.equal(await submitterOf('q1'), '42');
});

test('Twitch ajouté à un groupe Discord + Google : le Twitch devient l\'identité principale', async () => {
  await upsertAccount(db, discord);
  await linkAccounts(db, { primaryId: 'discord:1', name: 'Flo' }, google);
  await db.execute("INSERT INTO pending_questions VALUES ('q1', 'discord:1')");
  assert.equal(await linkAccounts(db, { primaryId: 'discord:1', name: 'Flo' }, twitch), 'linked');
  for (const id of ['discord:1', 'google:9', '42']) assert.equal(await resolvePrimary(db, id), '42');
  assert.equal(await submitterOf('q1'), '42');
});

test('compte déjà lié ailleurs ou tête d\'un autre groupe : refusé, rien ne change', async () => {
  await upsertAccount(db, discord);
  await linkAccounts(db, { primaryId: '42', name: 'floxail' }, discord);
  assert.equal(await linkAccounts(db, { primaryId: '77', name: 'autre' }, discord), 'already_linked');
  assert.equal(await resolvePrimary(db, 'discord:1'), '42');
  assert.equal(await linkAccounts(db, { primaryId: '77', name: 'autre' }, twitch), 'already_linked');
});

test('lier un compte à lui-même ou deux fois : sans effet', async () => {
  await upsertAccount(db, discord);
  assert.equal(await linkAccounts(db, { primaryId: 'discord:1', name: 'Flo' }, discord), 'linked');
  assert.equal(await linkAccounts(db, { primaryId: '42', name: 'floxail' }, discord), 'linked');
  assert.equal(await linkAccounts(db, { primaryId: '42', name: 'floxail' }, discord), 'linked');
  assert.equal(await resolvePrimary(db, 'discord:1'), '42');
});

test('délier : interdit sur l\'identité principale et le compte connecté, sinon compte autonome', async () => {
  await upsertAccount(db, discord);
  await upsertAccount(db, google);
  await linkAccounts(db, { primaryId: '42', name: 'floxail' }, discord);
  await linkAccounts(db, { primaryId: '42', name: 'floxail' }, google);
  assert.equal(await unlinkAccount(db, '42', '42', 'discord:1'), 'forbidden');
  assert.equal(await unlinkAccount(db, '42', 'discord:1', 'discord:1'), 'forbidden');
  assert.equal(await unlinkAccount(db, '42', 'google:9', 'discord:1'), 'unlinked');
  assert.equal(await resolvePrimary(db, 'google:9'), 'google:9');
  assert.equal(await unlinkAccount(db, '77', 'discord:1', '77'), 'forbidden');
});

test('liaison avec une identité principale périmée : rattachée à l\'identité actuelle', async () => {
  await upsertAccount(db, discord);
  await linkAccounts(db, { primaryId: 'discord:1', name: 'Flo' }, twitch);
  await linkAccounts(db, { primaryId: 'discord:1', name: 'Flo' }, google);
  assert.equal(await resolvePrimary(db, 'google:9'), '42');
  assert.ok((await listGroup(db, '42')).some(a => a.providerId === 'google:9'));
});

test('discordIdInGroup : ID Discord de la session, ou celui lié au groupe', async () => {
  assert.equal(await discordIdInGroup(db, 'discord:1', 'discord:1'), '1');
  await upsertAccount(db, discord);
  await linkAccounts(db, { primaryId: '42', name: 'floxail' }, discord);
  assert.equal(await discordIdInGroup(db, '42', '42'), '1');
  assert.equal(await discordIdInGroup(db, 'google:9', 'google:9'), null);
});

test('discordTotals : cumul tous serveurs, zéro si jamais joué', async () => {
  await db.execute(`INSERT INTO discord_scores VALUES
    ('g1', '1', 'Flo', 10, 4, 1, 2, 900, 's1'),
    ('g2', '1', 'Flo', 5, 2, 0, 3, 0, 's2'),
    ('g2', '2', 'Autre', 99, 9, 9, 9, 100, 's2')`);
  assert.deepEqual(await discordTotals(db, '1'), { score: 15, games: 2, answers: 6, firsts: 1, bestCombo: 3, fastest: 900 });
  assert.deepEqual(await discordTotals(db, '404'), { score: 0, games: 0, answers: 0, firsts: 0, bestCombo: 0, fastest: null });
});
