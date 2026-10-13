// Lancer : yarn test:api
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type Client } from '@libsql/client';
import { handleAuth, type AuthBody, type AuthReply, type RouteDeps } from './_auth-routes.ts';
import type { AuthRequest, TwitchUser } from './_auth.ts';
import { ACCOUNT_LINKS_SQL, resolvePrimary } from './_accounts.ts';
import type { FetchFn } from './_oauth.ts';

const NOW = 1_000_000;
const SITE = 'https://trivial.floxail.fr';
let db: Client;

beforeEach(async () => {
  db = createClient({ url: ':memory:' });
  for (const sql of ACCOUNT_LINKS_SQL) await db.execute(sql);
  for (const table of ['pending_questions (submitted_by_id TEXT)', 'boxes (created_by_id TEXT)', 'question_reports (reported_by_id TEXT)']) {
    await db.execute(`CREATE TABLE ${table}`);
  }
});

const discordApi: FetchFn = async (input: RequestInfo | URL) => new Response(JSON.stringify(
  String(input).includes('token') ? { access_token: 'at' } : { id: '1', username: 'flo', global_name: 'Flo', avatar: null },
));

const deps = (twitchUser: TwitchUser | null = null): RouteDeps => ({
  twitch: async () => twitchUser,
  db: () => db,
  secret: 'secret',
  now: NOW,
  env: { DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'cs', ADMIN_TWITCH_IDS: '42' },
  fetchFn: discordApi,
  migrate: async () => {},
});

type Sent = { status: number; body: AuthBody | null; location: string; cookies: string[] };
type Extra = { query?: AuthRequest['query']; headers?: AuthRequest['headers']; body?: { providerId: string }; url?: string };

async function call(method: string, action: string, extra: Extra = {}, routeDeps = deps()): Promise<Sent> {
  const sent: Sent = { status: 200, body: null, location: '', cookies: [] };
  const reply: AuthReply = {
    setHeader: (name, value) => { if (name === 'Set-Cookie') sent.cookies = [value].flat(); },
    status: (code) => { sent.status = code; return reply; },
    json: (body) => { sent.body = body; },
    redirect: (code, url) => { sent.status = code; sent.location = url; },
  };
  const req: AuthRequest = {
    method,
    headers: { host: 'trivial.floxail.fr', origin: SITE, ...extra.headers },
    query: action ? { action, ...extra.query } : { ...extra.query },
    body: extra.body,
    url: extra.url ?? `/api/auth/${action}`,
  };
  await handleAuth(req, reply, routeDeps);
  return sent;
}

/** `name=valeur; HttpOnly…` → en-tête Cookie `name=valeur` pour la requête suivante. */
const cookieFrom = (sent: Sent, name: string) => sent.cookies.find(c => c.startsWith(`${name}=`))?.split(';')[0] ?? '';

async function loginDiscord(query: AuthRequest['query'] = {}, cookie = '') {
  const start = await call('GET', 'discord', { query, headers: { cookie } });
  const state = new URL(start.location).searchParams.get('state') ?? '';
  const stateCookie = cookieFrom(start, 'tpt_oauth_state');
  return { start, state, stateCookie, callback: await call('GET', 'discord', { query: { code: 'c', state }, headers: { cookie: [stateCookie, cookie].filter(Boolean).join('; ') } }) };
}

test('connexion Discord : redirection, retour, cookie de session, compte créé', async () => {
  const { start, callback } = await loginDiscord({ return: '/stats' });
  assert.equal(start.status, 302);
  assert.ok(start.location.startsWith('https://discord.com/oauth2/authorize'));
  assert.equal(callback.status, 302);
  assert.equal(callback.location, '/stats');
  assert.ok(cookieFrom(callback, 'tpt_session'));
  assert.equal(await resolvePrimary(db, 'discord:1'), 'discord:1');
});

test('retour hors site : /contribute', async () => {
  assert.equal((await loginDiscord({ return: '//evil.example' })).callback.location, '/contribute');
});

test('state différent du cookie ou retour rejoué : retour accueil avec message, jamais de page JSON', async () => {
  const { state, stateCookie } = await loginDiscord();
  assert.equal((await call('GET', 'discord', { query: { code: 'c', state: 'autre' }, headers: { cookie: stateCookie } })).location, '/?login_error=discord');
  assert.equal((await call('GET', 'discord', { query: { code: 'c', state } })).location, '/?login_error=discord');
});

test('refus pendant une liaison : retour Paramètres, ticket effacé', async () => {
  const start = await call('GET', 'discord', { query: { link: '1' } });
  const state = new URL(start.location).searchParams.get('state') ?? '';
  const sent = await call('GET', 'discord', { query: { error: 'access_denied', state }, headers: { cookie: cookieFrom(start, 'tpt_oauth_state') } });
  assert.equal(sent.location, '/settings?link=failed');
  assert.ok(sent.cookies.some(c => c.startsWith('tpt_link=;')));
});

test('action absente de la query (route Vercel) : lue dans le chemin', async () => {
  assert.equal((await call('GET', '', { url: '/api/auth/me?x=1' })).status, 401);
});

test('refus sur Discord : retour accueil avec message', async () => {
  const start = await call('GET', 'discord');
  const state = new URL(start.location).searchParams.get('state') ?? '';
  const sent = await call('GET', 'discord', { query: { error: 'access_denied', state }, headers: { cookie: cookieFrom(start, 'tpt_oauth_state') } });
  assert.equal(sent.location, '/?login_error=discord');
});

test('fournisseur non configuré : retour accueil avec message', async () => {
  assert.equal((await call('GET', 'google')).location, '/?login_error=google');
});

test('me : compte Discord connecté', async () => {
  const session = cookieFrom((await loginDiscord()).callback, 'tpt_session');
  const sent = await call('GET', 'me', { headers: { cookie: session } });
  assert.equal(sent.status, 200);
  assert.deepEqual(sent.body, {
    userId: 'discord:1', login: 'Flo', provider: 'discord', providerId: 'discord:1', avatar: null, isAdmin: false,
    links: [{ providerId: 'discord:1', provider: 'discord', name: 'Flo' }],
  });
  assert.equal((await call('GET', 'me')).status, 401);
});

test('lier Discord depuis Twitch : link-start puis retour OAuth', async () => {
  const twitchDeps = deps({ userId: '42', login: 'floxail' });
  const ticket = cookieFrom(await call('POST', 'link-start', { headers: { authorization: 'Bearer t' } }, twitchDeps), 'tpt_link');
  assert.ok(ticket);
  const { callback } = await loginDiscord({ link: '1', return: '/settings' }, ticket);
  assert.equal(callback.location, '/settings?link=linked');
  assert.equal(await resolvePrimary(db, 'discord:1'), '42');
});

test('lier Twitch depuis une session Discord : Twitch devient l\'identité principale', async () => {
  const session = cookieFrom((await loginDiscord()).callback, 'tpt_session');
  const sent = await call('POST', 'link-twitch', { headers: { authorization: 'Bearer t', cookie: session } }, deps({ userId: '42', login: 'floxail' }));
  assert.deepEqual(sent.body, { result: 'linked' });
  assert.equal(await resolvePrimary(db, 'discord:1'), '42');
});

test('délier l\'identité principale : 403 ; déconnexion efface le cookie', async () => {
  const session = cookieFrom((await loginDiscord()).callback, 'tpt_session');
  assert.equal((await call('POST', 'unlink', { headers: { cookie: session }, body: { providerId: 'discord:1' } })).status, 403);
  const out = await call('POST', 'logout');
  assert.ok(out.cookies.some(c => c.startsWith('tpt_session=;') && c.includes('Max-Age=0')));
});
