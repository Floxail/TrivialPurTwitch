// Lancer : yarn test:api
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type Client } from '@libsql/client';
import { requireUser, type AuthDeps, type AuthRequest, type TwitchUser } from './_auth.ts';
import { ACCOUNT_LINKS_SQL, upsertAccount, linkAccounts } from './_accounts.ts';
import { signSession } from './_session.ts';

const SECRET = 's';
const NOW = 1_000_000;
let db: Client;

beforeEach(async () => {
  db = createClient({ url: ':memory:' });
  for (const sql of ACCOUNT_LINKS_SQL) await db.execute(sql);
  for (const table of ['pending_questions (submitted_by_id TEXT)', 'boxes (created_by_id TEXT)', 'question_reports (reported_by_id TEXT)']) {
    await db.execute(`CREATE TABLE ${table}`);
  }
  await upsertAccount(db, { providerId: 'discord:1', name: 'Flo', avatar: null });
});

const deps = (twitchUser: TwitchUser | null = null): AuthDeps => ({ twitch: async () => twitchUser, db: () => db, secret: SECRET, now: NOW });
const cookie = `tpt_session=${signSession({ provider: 'discord', providerId: 'discord:1', exp: NOW + 1000 }, SECRET)}`;
const request = (method: string, headers: AuthRequest['headers']): AuthRequest => ({ method, headers, query: {}, body: undefined });

test('Bearer Twitch : utilisateur Twitch, prioritaire sur le cookie', async () => {
  const user = await requireUser(request('GET', { authorization: 'Bearer t', cookie }), deps({ userId: '42', login: 'floxail' }));
  assert.deepEqual(user, { userId: '42', login: 'floxail', provider: 'twitch', providerId: '42' });
});

test('Bearer invalide : refusé, pas de repli sur le cookie', async () => {
  assert.equal(await requireUser(request('GET', { authorization: 'Bearer t', cookie }), deps(null)), null);
});

test('cookie Discord seul : son compte', async () => {
  assert.deepEqual(await requireUser(request('GET', { cookie }), deps()), { userId: 'discord:1', login: 'Flo', provider: 'discord', providerId: 'discord:1' });
});

test('Discord lié à un Twitch puis reconnecté seul : identité du Twitch', async () => {
  await linkAccounts(db, { primaryId: '42', name: 'floxail' }, { providerId: 'discord:1', name: 'Flo', avatar: null });
  assert.equal((await requireUser(request('GET', { cookie }), deps()))?.userId, '42');
});

test('cookie + modification : Origin du site exigée (CSRF)', async () => {
  assert.equal(await requireUser(request('POST', { cookie, origin: 'https://evil.example' }), deps()), null);
  assert.equal(await requireUser(request('POST', { cookie }), deps()), null);
  assert.equal((await requireUser(request('POST', { cookie, origin: 'https://trivial.floxail.fr' }), deps()))?.userId, 'discord:1');
});

test('sans secret, sans identifiant ou compte supprimé : null', async () => {
  assert.equal(await requireUser(request('GET', { cookie }), { ...deps(), secret: undefined }), null);
  assert.equal(await requireUser(request('GET', {}), deps()), null);
  await db.execute("DELETE FROM account_links WHERE provider_id = 'discord:1'");
  assert.equal(await requireUser(request('GET', { cookie }), deps()), null);
});
