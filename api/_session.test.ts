// Lancer : yarn test:api
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signSession, verifySession, signOAuthState, verifyOAuthState, signLinkTicket, verifyLinkTicket,
  readCookie, setCookie, clearCookie, isAllowedOrigin, originForHost, safeReturnPath, DEFAULT_RETURN_PATH,
} from './_session.ts';

const SECRET = 'secret-de-test';
const NOW = 1_000_000;
const session = { provider: 'discord' as const, providerId: 'discord:42', exp: NOW + 1000 };

test('session signée : relue telle quelle', () => {
  assert.deepEqual(verifySession(signSession(session, SECRET), SECRET, NOW), session);
});

test('session : signature ou contenu modifiés refusés', () => {
  const token = signSession(session, SECRET);
  const lastChar = token.at(-1) === 'A' ? 'B' : 'A';
  assert.equal(verifySession(token.slice(0, -1) + lastChar, SECRET, NOW), null);
  const forged = signSession({ ...session, providerId: 'discord:1' }, SECRET);
  const mixed = forged.split('.').slice(0, -1).join('.') + '.' + token.split('.').at(-1);
  assert.equal(verifySession(mixed, SECRET, NOW), null);
});

test('session : expirée, mauvais secret, illisible ou absente refusée', () => {
  const token = signSession(session, SECRET);
  assert.equal(verifySession(token, SECRET, NOW + 1000), null);
  assert.equal(verifySession(token, 'autre', NOW), null);
  assert.equal(verifySession('abc', SECRET, NOW), null);
  assert.equal(verifySession(null, SECRET, NOW), null);
});

test('un jeton de liaison ne sert pas de session', () => {
  const ticket = signLinkTicket({ primaryId: '42', name: 'x', exp: NOW + 1000 }, SECRET);
  assert.equal(verifySession(ticket, SECRET, NOW), null);
  assert.deepEqual(verifyLinkTicket(ticket, SECRET, NOW), { primaryId: '42', name: 'x', exp: NOW + 1000 });
});

test('state OAuth : chemin de retour hors site remplacé par /contribute', () => {
  const state = { state: 's1', provider: 'google' as const, returnPath: '//evil.example', link: true, exp: NOW + 1000 };
  const read = verifyOAuthState(signOAuthState(state, SECRET), SECRET, NOW);
  assert.deepEqual(read, { ...state, returnPath: DEFAULT_RETURN_PATH });
});

test('cookies : lecture et écriture', () => {
  assert.equal(readCookie('a=1; tpt_session=xyz.abc; b=2', 'tpt_session'), 'xyz.abc');
  assert.equal(readCookie(undefined, 'tpt_session'), null);
  assert.equal(setCookie('n', 'v', 60_000), 'n=v; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=60');
  assert.equal(clearCookie('n'), 'n=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
});

test('origines : seulement la prod et le dev local', () => {
  assert.ok(isAllowedOrigin('https://trivial.floxail.fr'));
  assert.ok(!isAllowedOrigin('https://evil.example'));
  assert.ok(!isAllowedOrigin(undefined));
  assert.equal(originForHost('trivial.floxail.fr'), 'https://trivial.floxail.fr');
  assert.equal(originForHost('localhost:3000'), 'http://localhost:3000');
  assert.equal(originForHost('evil.example'), null);
});

test('safeReturnPath : chemins internes uniquement', () => {
  assert.equal(safeReturnPath('/contribute?mode=bulk'), '/contribute?mode=bulk');
  assert.equal(safeReturnPath('/\\evil'), null);
  assert.equal(safeReturnPath('/callback'), null);
  assert.equal(safeReturnPath(null), null);
});

test('safeReturnPath : caractères de contrôle refusés (le navigateur les retire : "/\t/hôte" devient "//hôte")', () => {
  assert.equal(safeReturnPath('/\t/evil.example'), null);
  assert.equal(safeReturnPath('/\n/evil.example'), null);
  assert.equal(safeReturnPath('/a\\b'), null);
});
