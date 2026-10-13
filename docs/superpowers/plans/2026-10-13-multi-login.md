# Connexion Discord et Google — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Se connecter au site avec Discord ou Google en plus de Twitch, lier ces comptes en une seule identité, et ouvrir propositions, signalements, création de boîtes et stats à ces comptes.

**Architecture:** OAuth « code » côté serveur dans une seule Vercel Function dynamique (`api/auth/[action].ts`), cookie de session signé HMAC (aucune dépendance), table `account_links` qui traduit chaque compte vers son identité principale. `requireUser` accepte le Bearer Twitch actuel ou le cookie. Le front ajoute un `account` (chargé par `/api/auth/me`) à `auth-store`.

**Tech Stack:** Vercel Functions (Node 24, ESM), `@libsql/client` (Turso), `node:crypto`, `node:test` (API), CRA + React 18 + zustand + Jest (front).

**Spec:** `docs/superpowers/specs/2026-10-13-multi-login-design.md`

## Global Constraints

- Ne jamais commiter ni pousser : l'utilisateur gère git. Les étapes « Point de contrôle » remplacent les commits.
- Aucune nouvelle dépendance npm.
- Aucun emoji dans les textes du site, du bot ou des docs.
- Lint anti-slop (`yarn lint`) : pas de `typeof` à l'exécution, pas de paramètre ou retour `unknown`, pas de type `object`, pas de `as unknown as`, toute assertion `as` précédée d'un commentaire `// SAFETY: …`, pas de `...(cond ? {...} : {})`.
- Le code API importe ses voisins en `.js` (`./_utils.js`) ; les tests importent en `.ts`.
- Scopes : Discord `identify`, Google `openid profile`. Jamais d'e-mail.
- Cookie de session : `tpt_session`, `HttpOnly; Secure; SameSite=Lax; Path=/`, 30 jours.
- Origines autorisées : `https://trivial.floxail.fr` et `http://localhost:3000`.
- IDs : Twitch sans préfixe (inchangé), `discord:<id>`, `google:<sub>`.
- L'admin reste réservé au jeton Twitch (`requireAdminAuth` inchangé).
- Variables : `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`. Absente → 503 sur la connexion concernée, le reste fonctionne.

## Écarts assumés par rapport à la spec

- **Une seule fonction `api/auth/[action].ts`** (remplace `api/auth/me.ts`) au lieu de fichiers séparés : le projet a déjà 12 fonctions, la limite du plan Vercel Hobby. Les URL restent celles de la spec (`/api/auth/discord`, `/api/auth/me`…).
- **Le cookie ne contient que `provider`, `providerId`, `exp`.** Nom et avatar vivent dans `account_links` (colonnes `name`, `avatar`) : chaque compte Discord/Google y a sa ligne dès sa première connexion (ligne « à soi-même », `primary_id = provider_id`). Évite JSON dans le cookie et donc un parseur non typé.
- Le jeton du cookie commence par un champ de type (`session`, `state`, `link`) : un cookie de liaison ne peut pas servir de session.

## Review Focus

1. Rafraîchir la page de retour OAuth (même `code`, cookie `state` déjà effacé) → 400 « Connexion expirée, recommence », jamais 500. Test : Task 5.
2. Lier le compte avec lequel on est connecté à lui-même → `linked` sans effet, pas `already_linked`. Test : Task 2.
3. Compte Discord qui n'a jamais joué avec le bot → stats à zéro, pas d'erreur. Test : Task 2.
4. Compte Discord sans avatar, compte Google sans photo → `avatar: null`, connexion OK. Test : Task 3.
5. Compte Discord lié à un Twitch, reconnecté plus tard via Discord seul → mêmes propositions et mêmes stats que le Twitch (identité principale). Test : Task 4.

---

### Task 1: Jetons signés, cookies et origines (`api/_session.ts`)

**Files:**
- Create: `api/_session.ts`
- Test: `api/_session.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `type Provider = 'discord' | 'google'`
  - `type Session = { provider: Provider; providerId: string; exp: number }`
  - `type OAuthState = { state: string; provider: Provider; returnPath: string; link: boolean; exp: number }`
  - `type LinkTicket = { primaryId: string; name: string; exp: number }`
  - `SESSION_COOKIE`, `STATE_COOKIE`, `LINK_COOKIE`, `SESSION_TTL_MS`, `SHORT_TTL_MS`, `DEFAULT_RETURN_PATH`
  - `signSession(s, secret): string`, `verifySession(token: string | null, secret, now): Session | null`
  - `signOAuthState(s, secret): string`, `verifyOAuthState(token, secret, now): OAuthState | null`
  - `signLinkTicket(t, secret): string`, `verifyLinkTicket(token, secret, now): LinkTicket | null`
  - `parseProvider(value: string | undefined): Provider | null`
  - `readCookie(header: string | undefined, name: string): string | null`
  - `setCookie(name, value, maxAgeMs): string`, `clearCookie(name): string`
  - `isAllowedOrigin(origin: string | undefined): boolean`, `originForHost(host: string | undefined): string | null`
  - `safeReturnPath(path: string | null): string | null`

- [ ] **Step 1: Write the failing test**

`api/_session.test.ts` :

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:api`
Expected: FAIL, `Cannot find module '…/api/_session.ts'`.

- [ ] **Step 3: Write minimal implementation**

`api/_session.ts` :

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export type Provider = 'discord' | 'google';
export type Session = { provider: Provider; providerId: string; exp: number };
export type OAuthState = { state: string; provider: Provider; returnPath: string; link: boolean; exp: number };
export type LinkTicket = { primaryId: string; name: string; exp: number };

export const SESSION_COOKIE = 'tpt_session';
export const STATE_COOKIE = 'tpt_oauth_state';
export const LINK_COOKIE = 'tpt_link';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SHORT_TTL_MS = 10 * 60 * 1000;
export const DEFAULT_RETURN_PATH = '/contribute';

const ALLOWED_ORIGINS = ['https://trivial.floxail.fr', 'http://localhost:3000'];

const encode = (text: string) => Buffer.from(text, 'utf8').toString('base64url');
const decode = (text: string) => Buffer.from(text, 'base64url').toString('utf8');
const mac = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('base64url');

/** `b64(champ1).b64(champ2)….signature` — HMAC-SHA256, comparaison à temps constant. */
function signFields(fields: string[], secret: string): string {
  const data = fields.map(encode).join('.');
  return `${data}.${mac(data, secret)}`;
}

function verifyFields(token: string | null, secret: string): string[] | null {
  if (!token) return null;
  const cut = token.lastIndexOf('.');
  if (cut <= 0) return null;
  const data = token.slice(0, cut);
  const given = Buffer.from(token.slice(cut + 1));
  const expected = Buffer.from(mac(data, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return data.split('.').map(decode);
}

export function parseProvider(value: string | undefined): Provider | null {
  return value === 'discord' || value === 'google' ? value : null;
}

function parseExp(value: string | undefined, now: number): number | null {
  const exp = Number(value);
  return Number.isFinite(exp) && exp > now ? exp : null;
}

// Le premier champ nomme le type de jeton : un cookie de liaison ne peut pas servir de session.
export function signSession(session: Session, secret: string): string {
  return signFields(['session', session.provider, session.providerId, String(session.exp)], secret);
}

export function verifySession(token: string | null, secret: string, now: number): Session | null {
  const fields = verifyFields(token, secret);
  if (!fields || fields.length !== 4 || fields[0] !== 'session' || !fields[2]) return null;
  const provider = parseProvider(fields[1]);
  const exp = parseExp(fields[3], now);
  return provider && exp !== null ? { provider, providerId: fields[2], exp } : null;
}

export function signOAuthState(state: OAuthState, secret: string): string {
  return signFields(['state', state.state, state.provider, state.returnPath, state.link ? '1' : '0', String(state.exp)], secret);
}

export function verifyOAuthState(token: string | null, secret: string, now: number): OAuthState | null {
  const fields = verifyFields(token, secret);
  if (!fields || fields.length !== 6 || fields[0] !== 'state' || !fields[1]) return null;
  const provider = parseProvider(fields[2]);
  const exp = parseExp(fields[5], now);
  if (!provider || exp === null) return null;
  return { state: fields[1], provider, returnPath: safeReturnPath(fields[3]) ?? DEFAULT_RETURN_PATH, link: fields[4] === '1', exp };
}

export function signLinkTicket(ticket: LinkTicket, secret: string): string {
  return signFields(['link', ticket.primaryId, ticket.name, String(ticket.exp)], secret);
}

export function verifyLinkTicket(token: string | null, secret: string, now: number): LinkTicket | null {
  const fields = verifyFields(token, secret);
  if (!fields || fields.length !== 4 || fields[0] !== 'link' || !fields[1]) return null;
  const exp = parseExp(fields[3], now);
  return exp === null ? null : { primaryId: fields[1], name: fields[2], exp };
}

export function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export function setCookie(name: string, value: string, maxAgeMs: number): string {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}`;
}

export const clearCookie = (name: string) => setCookie(name, '', 0);

export function isAllowedOrigin(origin: string | undefined): boolean {
  return origin !== undefined && ALLOWED_ORIGINS.includes(origin);
}

export function originForHost(host: string | undefined): string | null {
  return ALLOWED_ORIGINS.find(origin => new URL(origin).host === host) ?? null;
}

/** Copie de safeReturnPath (src/helpers.ts) : l'API ne charge pas le code du navigateur. */
export function safeReturnPath(path: string | null): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  if (path === '/' || path.startsWith('/callback')) return null;
  return path;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:api`
Expected: PASS, `_session.test.ts` 8/8, anciens tests toujours verts.

- [ ] **Step 5: Point de contrôle** — pas de commit (l'utilisateur gère git).

---

### Task 2: Table `account_links` et logique de liaison (`api/_accounts.ts`)

**Files:**
- Create: `api/_accounts.ts`
- Modify: `api/_db.ts` (ajout des CREATE dans le batch de `runMigrations`)
- Test: `api/_accounts.test.ts`

**Interfaces:**
- Consumes: rien (prend un `Client` libsql en paramètre).
- Produces:
  - `type AccountProvider = 'twitch' | 'discord' | 'google'`
  - `type AccountProfile = { providerId: string; name: string; avatar: string | null }`
  - `type AccountRow = AccountProfile & { primaryId: string }`
  - `type GroupRef = { primaryId: string; name: string }`
  - `type LinkResult = 'linked' | 'already_linked'`, `type UnlinkResult = 'unlinked' | 'forbidden'`
  - `type DiscordTotals = { score: number; games: number; answers: number; firsts: number; bestCombo: number; fastest: number | null }`
  - `ACCOUNT_LINKS_SQL: string[]`
  - `isTwitchId(id): boolean`, `providerOf(id): AccountProvider`
  - `upsertAccount(db, profile): Promise<void>`
  - `findAccount(db, providerId): Promise<AccountRow | null>`
  - `resolvePrimary(db, providerId): Promise<string>`
  - `listGroup(db, primaryId): Promise<AccountRow[]>`
  - `linkAccounts(db, current: GroupRef, added: AccountProfile): Promise<LinkResult>`
  - `unlinkAccount(db, primaryId, providerId, currentProviderId): Promise<UnlinkResult>`
  - `discordIdInGroup(db, primaryId, providerId): Promise<string | null>`
  - `discordTotals(db, discordId): Promise<DiscordTotals>`

- [ ] **Step 1: Write the failing test**

`api/_accounts.test.ts` :

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:api`
Expected: FAIL, `Cannot find module '…/api/_accounts.ts'`.

- [ ] **Step 3: Write minimal implementation**

`api/_accounts.ts` :

```ts
import type { Client, Row } from '@libsql/client';

export type AccountProvider = 'twitch' | 'discord' | 'google';
export type AccountProfile = { providerId: string; name: string; avatar: string | null };
export type AccountRow = AccountProfile & { primaryId: string };
export type GroupRef = { primaryId: string; name: string };
export type LinkResult = 'linked' | 'already_linked';
export type UnlinkResult = 'unlinked' | 'forbidden';
export type DiscordTotals = { score: number; games: number; answers: number; firsts: number; bestCombo: number; fastest: number | null };

export const ACCOUNT_LINKS_SQL = [
  `CREATE TABLE IF NOT EXISTS account_links (
    provider_id TEXT PRIMARY KEY,
    primary_id  TEXT NOT NULL,
    name        TEXT,
    avatar      TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  )`,
  'CREATE INDEX IF NOT EXISTS idx_account_links_primary ON account_links(primary_id)',
];

/** Les ID Twitch n'ont pas de préfixe ; Discord et Google sont `discord:…` / `google:…`. */
export const isTwitchId = (id: string) => !id.includes(':');

export function providerOf(id: string): AccountProvider {
  if (id.startsWith('discord:')) return 'discord';
  if (id.startsWith('google:')) return 'google';
  return 'twitch';
}

const toAccount = (row: Row): AccountRow => ({
  providerId: String(row.provider_id),
  primaryId: String(row.primary_id),
  name: String(row.name ?? ''),
  avatar: row.avatar == null ? null : String(row.avatar),
});

const SELECT_ACCOUNT = 'SELECT provider_id, primary_id, name, avatar FROM account_links';

/** Crée la ligne du compte (identité principale = lui-même) ou rafraîchit nom et avatar. */
export async function upsertAccount(db: Client, profile: AccountProfile): Promise<void> {
  await db.execute({
    sql: `INSERT INTO account_links (provider_id, primary_id, name, avatar) VALUES (?, ?, ?, ?)
          ON CONFLICT(provider_id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar`,
    args: [profile.providerId, profile.providerId, profile.name, profile.avatar],
  });
}

export async function findAccount(db: Client, providerId: string): Promise<AccountRow | null> {
  const result = await db.execute({ sql: `${SELECT_ACCOUNT} WHERE provider_id = ?`, args: [providerId] });
  return result.rows.length > 0 ? toAccount(result.rows[0]) : null;
}

/** Identité principale d'un compte : lui-même s'il n'a pas de ligne. */
export async function resolvePrimary(db: Client, providerId: string): Promise<string> {
  return (await findAccount(db, providerId))?.primaryId ?? providerId;
}

export async function listGroup(db: Client, primaryId: string): Promise<AccountRow[]> {
  const result = await db.execute({ sql: `${SELECT_ACCOUNT} WHERE primary_id = ? ORDER BY created_at`, args: [primaryId] });
  return result.rows.map(toAccount);
}

const REATTRIBUTE_SQL = [
  'UPDATE pending_questions SET submitted_by_id = ? WHERE submitted_by_id = ?',
  'UPDATE boxes SET created_by_id = ? WHERE created_by_id = ?',
  'UPDATE question_reports SET reported_by_id = ? WHERE reported_by_id = ?',
];

export async function linkAccounts(db: Client, current: GroupRef, added: AccountProfile): Promise<LinkResult> {
  if (added.providerId === current.primaryId) return 'linked';
  const existing = await findAccount(db, added.providerId);
  if (existing?.primaryId === current.primaryId) return 'linked';
  if (existing && existing.primaryId !== added.providerId) return 'already_linked';
  const members = await listGroup(db, added.providerId);
  if (members.some(member => member.providerId !== added.providerId)) return 'already_linked';

  // Un Twitch devient l'identité principale : scores, historique et admin restent rattachés à son ID.
  const newPrimary = isTwitchId(added.providerId) && !isTwitchId(current.primaryId) ? added.providerId : current.primaryId;
  const replacedId = newPrimary === current.primaryId ? added.providerId : current.primaryId;
  await db.batch([
    { sql: 'INSERT OR IGNORE INTO account_links (provider_id, primary_id, name) VALUES (?, ?, ?)', args: [current.primaryId, current.primaryId, current.name] },
    {
      sql: `INSERT INTO account_links (provider_id, primary_id, name, avatar) VALUES (?, ?, ?, ?)
            ON CONFLICT(provider_id) DO UPDATE SET primary_id = excluded.primary_id, name = excluded.name, avatar = excluded.avatar`,
      args: [added.providerId, newPrimary, added.name, added.avatar],
    },
    { sql: 'UPDATE account_links SET primary_id = ? WHERE primary_id = ?', args: [newPrimary, current.primaryId] },
    ...REATTRIBUTE_SQL.map(sql => ({ sql, args: [newPrimary, replacedId] })),
  ], 'write');
  return 'linked';
}

export async function unlinkAccount(db: Client, primaryId: string, providerId: string, currentProviderId: string): Promise<UnlinkResult> {
  if (providerId === primaryId || providerId === currentProviderId) return 'forbidden';
  const account = await findAccount(db, providerId);
  if (!account || account.primaryId !== primaryId) return 'forbidden';
  // Un Discord/Google délié redevient un compte autonome ; un Twitch sans liaison n'a pas de ligne.
  await db.execute(isTwitchId(providerId)
    ? { sql: 'DELETE FROM account_links WHERE provider_id = ?', args: [providerId] }
    : { sql: 'UPDATE account_links SET primary_id = provider_id WHERE provider_id = ?', args: [providerId] });
  return 'unlinked';
}

/** ID Discord brut (celui de `discord_scores`) du compte connecté ou de son groupe. */
export async function discordIdInGroup(db: Client, primaryId: string, providerId: string): Promise<string | null> {
  const prefix = 'discord:';
  if (providerId.startsWith(prefix)) return providerId.slice(prefix.length);
  const result = await db.execute({
    sql: "SELECT provider_id FROM account_links WHERE primary_id = ? AND provider_id LIKE 'discord:%' LIMIT 1",
    args: [primaryId],
  });
  return result.rows.length > 0 ? String(result.rows[0].provider_id).slice(prefix.length) : null;
}

export async function discordTotals(db: Client, discordId: string): Promise<DiscordTotals> {
  const result = await db.execute({
    sql: `SELECT COALESCE(SUM(score), 0) AS score, COUNT(DISTINCT session_id) AS games,
                 COALESCE(SUM(answers), 0) AS answers, COALESCE(SUM(firsts), 0) AS firsts,
                 COALESCE(MAX(combos), 0) AS best_combo, MIN(NULLIF(fastest, 0)) AS fastest
          FROM discord_scores WHERE user_id = ?`,
    args: [discordId],
  });
  const row = result.rows[0];
  return {
    score: Number(row.score),
    games: Number(row.games),
    answers: Number(row.answers),
    firsts: Number(row.firsts),
    bestCombo: Number(row.best_combo),
    fastest: row.fastest == null ? null : Number(row.fastest),
  };
}
```

Dans `api/_db.ts`, ajouter l'import en tête et les deux requêtes dans le batch `CREATE TABLE IF NOT EXISTS` de `runMigrations` :

```ts
import { ACCOUNT_LINKS_SQL } from './_accounts.js';
```

```ts
    ...ACCOUNT_LINKS_SQL.map(sql => ({ sql, args: [] })),
  ], 'write');
```

(à la place de la ligne `  ], 'write');` qui ferme ce premier batch.)

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:api`
Expected: PASS, `_accounts.test.ts` 9/9, tous les autres verts.

- [ ] **Step 5: Point de contrôle** — pas de commit.

---

### Task 3: Échange OAuth Discord et Google (`api/_oauth.ts`)

**Files:**
- Create: `api/_oauth.ts`
- Test: `api/_oauth.test.ts`

**Interfaces:**
- Consumes: `Provider` (Task 1), `AccountProfile` (Task 2), en `import type`.
- Produces:
  - `type OAuthConfig = { clientId: string; clientSecret: string }`
  - `type FetchFn = typeof fetch`
  - `oauthConfig(provider, env: NodeJS.ProcessEnv): OAuthConfig | null`
  - `authorizeUrl(provider, clientId, redirectUri, state): string`
  - `exchangeCode(provider, config, redirectUri, code, fetchFn): Promise<AccountProfile | null>`

- [ ] **Step 1: Write the failing test**

`api/_oauth.test.ts` :

```ts
// Lancer : yarn test:api
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeUrl, exchangeCode, oauthConfig, type FetchFn } from './_oauth.ts';

const config = { clientId: 'cid', clientSecret: 'secret' };
const json = (body: Record<string, string | null>, status = 200) => new Response(JSON.stringify(body), { status });

/** Faux fournisseur : jeton puis profil. */
function provider(profile: Record<string, string | null>, tokenStatus = 200): FetchFn {
  return async (input: RequestInfo | URL) => (String(input).includes('token')
    ? json({ access_token: 'at' }, tokenStatus)
    : json(profile));
}

test('URL d\'autorisation : scope minimal, state et redirect_uri', () => {
  const url = new URL(authorizeUrl('discord', 'cid', 'https://trivial.floxail.fr/api/auth/discord', 'st'));
  assert.equal(url.origin + url.pathname, 'https://discord.com/oauth2/authorize');
  assert.equal(url.searchParams.get('scope'), 'identify');
  assert.equal(url.searchParams.get('state'), 'st');
  assert.equal(url.searchParams.get('response_type'), 'code');
  const google = new URL(authorizeUrl('google', 'cid', 'https://x/api/auth/google', 'st'));
  assert.equal(google.searchParams.get('scope'), 'openid profile');
});

test('Discord : profil avec avatar, ou sans avatar', async () => {
  assert.deepEqual(
    await exchangeCode('discord', config, 'r', 'code', provider({ id: '1', username: 'flo', global_name: 'Flo', avatar: 'abc' })),
    { providerId: 'discord:1', name: 'Flo', avatar: 'https://cdn.discordapp.com/avatars/1/abc.png' },
  );
  assert.deepEqual(
    await exchangeCode('discord', config, 'r', 'code', provider({ id: '1', username: 'flo', global_name: null, avatar: null })),
    { providerId: 'discord:1', name: 'flo', avatar: null },
  );
});

test('Google : profil sans photo', async () => {
  assert.deepEqual(
    await exchangeCode('google', config, 'r', 'code', provider({ sub: '9', name: 'Flo G' })),
    { providerId: 'google:9', name: 'Flo G', avatar: null },
  );
});

test('code refusé, profil sans identifiant ou réseau en panne : null', async () => {
  assert.equal(await exchangeCode('discord', config, 'r', 'code', provider({ id: '1' }, 400)), null);
  assert.equal(await exchangeCode('google', config, 'r', 'code', provider({ name: 'x' })), null);
  const down: FetchFn = async () => { throw new Error('réseau'); };
  assert.equal(await exchangeCode('google', config, 'r', 'code', down), null);
});

test('configuration absente : null', () => {
  assert.equal(oauthConfig('discord', { DISCORD_CLIENT_ID: 'x' }), null);
  assert.deepEqual(oauthConfig('google', { GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b' }), { clientId: 'a', clientSecret: 'b' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:api`
Expected: FAIL, `Cannot find module '…/api/_oauth.ts'`.

- [ ] **Step 3: Write minimal implementation**

`api/_oauth.ts` :

```ts
import type { Provider } from './_session.js';
import type { AccountProfile } from './_accounts.js';

export type OAuthConfig = { clientId: string; clientSecret: string };
export type FetchFn = typeof fetch;

const ENDPOINTS = {
  discord: {
    authorize: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    profile: 'https://discord.com/api/users/@me',
    scope: 'identify',
  },
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    profile: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid profile',
  },
} as const;

type TokenResponse = { access_token?: string };
type DiscordUser = { id?: string; username?: string; global_name?: string | null; avatar?: string | null };
type GoogleUser = { sub?: string; name?: string; picture?: string };

export function oauthConfig(provider: Provider, env: NodeJS.ProcessEnv): OAuthConfig | null {
  const prefix = provider === 'discord' ? 'DISCORD' : 'GOOGLE';
  const clientId = env[`${prefix}_CLIENT_ID`];
  const clientSecret = env[`${prefix}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function authorizeUrl(provider: Provider, clientId: string, redirectUri: string, state: string): string {
  const url = new URL(ENDPOINTS[provider].authorize);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ENDPOINTS[provider].scope,
    state,
  }).toString();
  return url.toString();
}

function discordProfile(user: DiscordUser): AccountProfile | null {
  if (!user.id) return null;
  return {
    providerId: `discord:${user.id}`,
    name: user.global_name || user.username || 'Discord',
    avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
  };
}

function googleProfile(user: GoogleUser): AccountProfile | null {
  if (!user.sub) return null;
  return { providerId: `google:${user.sub}`, name: user.name || 'Google', avatar: user.picture ?? null };
}

/** Code d'autorisation → profil minimal. Toute erreur (refus, réseau, réponse incomplète) → null. */
export async function exchangeCode(provider: Provider, config: OAuthConfig, redirectUri: string, code: string, fetchFn: FetchFn): Promise<AccountProfile | null> {
  const endpoints = ENDPOINTS[provider];
  try {
    const tokenRes = await fetchFn(endpoints.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) return null;
    const token: TokenResponse = await tokenRes.json();
    if (!token.access_token) return null;
    const profileRes = await fetchFn(endpoints.profile, { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!profileRes.ok) return null;
    return provider === 'discord' ? discordProfile(await profileRes.json()) : googleProfile(await profileRes.json());
  } catch (err) {
    console.error(`Échange OAuth ${provider} impossible:`, err);
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:api`
Expected: PASS, `_oauth.test.ts` 5/5.

- [ ] **Step 5: Point de contrôle** — pas de commit.

---

### Task 4: `requireUser` et ouverture des endpoints

**Files:**
- Create: `tools/ts-resolve.mjs`, `api/_auth.ts`
- Modify: `package.json` (script `test:api`), `api/_utils.ts:67` (type du paramètre de `requireAnyTwitchAuth`), `api/submit-question.ts`, `api/reports.ts`, `api/boxes.ts`
- Test: `api/_auth.test.ts`

**Interfaces:**
- Consumes: Task 1 (`SESSION_COOKIE`, `readCookie`, `verifySession`, `isAllowedOrigin`, `Provider`), Task 2 (`findAccount`, `resolvePrimary`), `requireAnyTwitchAuth` (`api/_utils.ts`), `getDb` (`api/_db.ts`).
- Produces:
  - `type AuthRequest = Pick<VercelRequest, 'method' | 'headers' | 'query' | 'body'>`
  - `type TwitchUser = { userId: string; login: string }`
  - `type AuthUser = { userId: string; login: string; provider: 'twitch' | Provider; providerId: string }` (`userId` = identité principale)
  - `type AuthDeps = { twitch: (req: Pick<VercelRequest, 'headers'>) => Promise<TwitchUser | null>; db: () => Client; secret: string | undefined; now: number }`
  - `authDeps(): AuthDeps`
  - `sessionUser(req: AuthRequest, deps: AuthDeps): Promise<AuthUser | null>`
  - `requireUser(req: AuthRequest, deps?: AuthDeps): Promise<AuthUser | null>`

- [ ] **Step 1: Loader de test** — les tests chargent des modules qui importent leurs voisins en `.js` ; Node exécute le `.ts` mais ne réécrit pas l'extension.

`tools/ts-resolve.mjs` :

```js
// Tests API (node --test) : `import './_x.js'` désigne `_x.ts` dans les sources (convention ESM de Vercel).
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && specifier.endsWith('.js')) {
        return nextResolve(`${specifier.slice(0, -3)}.ts`, context);
      }
      throw err;
    }
  },
});
```

`package.json`, remplacer le script :

```json
    "test:api": "node --import ./tools/ts-resolve.mjs --test \"api/**/*.test.ts\"",
```

Run: `yarn test:api`
Expected: PASS, mêmes résultats qu'avant (le loader ne change rien aux tests existants).

- [ ] **Step 2: Write the failing test**

`api/_auth.test.ts` :

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn test:api`
Expected: FAIL, `Cannot find module '…/api/_auth.ts'`.

- [ ] **Step 4: Write minimal implementation**

`api/_utils.ts` ligne 67, élargir le paramètre (seuls les en-têtes sont lus) :

```ts
export async function requireAnyTwitchAuth(req: Pick<VercelRequest, 'headers'>): Promise<{ userId: string; login: string } | null> {
```

`api/_auth.ts` :

```ts
import type { VercelRequest } from '@vercel/node';
import type { Client } from '@libsql/client';
import { requireAnyTwitchAuth } from './_utils.js';
import { SESSION_COOKIE, isAllowedOrigin, readCookie, verifySession, type Provider } from './_session.js';
import { findAccount, resolvePrimary } from './_accounts.js';
import { getDb } from './_db.js';

export type AuthRequest = Pick<VercelRequest, 'method' | 'headers' | 'query' | 'body'>;
export type TwitchUser = { userId: string; login: string };
export type AuthUser = { userId: string; login: string; provider: 'twitch' | Provider; providerId: string };
export type AuthDeps = {
  twitch: (req: Pick<VercelRequest, 'headers'>) => Promise<TwitchUser | null>;
  db: () => Client;
  secret: string | undefined;
  now: number;
};

export const authDeps = (): AuthDeps => ({ twitch: requireAnyTwitchAuth, db: getDb, secret: process.env.SESSION_SECRET, now: Date.now() });

/** Session Discord/Google du cookie. Requête de modification venue d'une autre origine : refusée (CSRF). */
export async function sessionUser(req: AuthRequest, deps: AuthDeps): Promise<AuthUser | null> {
  if (!deps.secret) return null;
  if (req.method !== 'GET' && !isAllowedOrigin(req.headers.origin)) return null;
  const session = verifySession(readCookie(req.headers.cookie, SESSION_COOKIE), deps.secret, deps.now);
  if (!session) return null;
  const account = await findAccount(deps.db(), session.providerId);
  if (!account) return null;
  return { userId: account.primaryId, login: account.name, provider: session.provider, providerId: session.providerId };
}

/** Bearer Twitch en priorité, sinon session Discord/Google. `userId` = identité principale du groupe. */
export async function requireUser(req: AuthRequest, deps: AuthDeps = authDeps()): Promise<AuthUser | null> {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    const twitch = await deps.twitch(req);
    if (!twitch) return null;
    return { userId: await resolvePrimary(deps.db(), twitch.userId), login: twitch.login, provider: 'twitch', providerId: twitch.userId };
  }
  return sessionUser(req, deps);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test:api`
Expected: PASS, `_auth.test.ts` 6/6.

- [ ] **Step 6: Brancher les endpoints**

`api/submit-question.ts` : remplacer l'import `requireAnyTwitchAuth` par `requireUser` depuis `./_auth.js`, et déplacer la vérification dans le `try` (elle lit maintenant la base) :

```ts
import { checkRateLimit, applyCors, validateSubmission } from './_utils.js';
import { requireUser } from './_auth.js';
```

```ts
  try {
    const user = await requireUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Connexion requise' });
    }

    const validation = validateSubmission(req.body);
```

(supprimer le bloc `const user = await requireAnyTwitchAuth(req); …` situé avant le `try`.)

`api/reports.ts` : import `requireUser` depuis `./_auth.js` (garder `requireAdminAuth`, retirer `requireAnyTwitchAuth`), puis dans le POST :

```ts
    const user = await requireUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Connexion requise' });
    }
```

`api/boxes.ts` : idem, import `requireUser` depuis `./_auth.js`, retirer `requireAnyTwitchAuth` de l'import `_utils.js`, et dans le POST :

```ts
    // ==================== POST (créer une boîte — tout utilisateur connecté) ====================
    if (req.method === 'POST') {
      if (checkRateLimit(req, res, 10, 60_000)) return;

      const user = await requireUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Connexion requise' });
      }
```

Run: `npx tsc -p api --noEmit` puis `yarn test:api`
Expected: aucune erreur de type ; tous les tests verts.

- [ ] **Step 7: Point de contrôle** — pas de commit.

---

### Task 5: Routes d'authentification (`api/auth/[action].ts`)

**Files:**
- Create: `api/_auth-routes.ts`, `api/auth/[action].ts`
- Delete: `api/auth/me.ts` (remplacé, même URL `/api/auth/me`)
- Test: `api/_auth-routes.test.ts`

**Interfaces:**
- Consumes: Tasks 1 à 4 (noms exacts ci-dessus), `runMigrations` (`api/_db.ts`), `checkRateLimit` (`api/_utils.ts`).
- Produces:
  - `type MeBody = { userId: string; login: string; provider: 'twitch' | Provider; providerId: string; avatar: string | null; isAdmin: boolean; links: { providerId: string; provider: AccountProvider; name: string }[] }`
  - `type AuthBody = { error: string } | { success: true } | { result: LinkResult | UnlinkResult } | MeBody`
  - `interface AuthReply { setHeader(name: string, value: string | string[]): void; status(code: number): AuthReply; json(body: AuthBody): void; redirect(code: number, url: string): void }`
  - `type RouteDeps = AuthDeps & { env: NodeJS.ProcessEnv; fetchFn: FetchFn; migrate: () => Promise<void> }`
  - `routeDeps(): RouteDeps`, `handleAuth(req: AuthRequest, reply: AuthReply, deps: RouteDeps): Promise<void>`
  - Réponses HTTP consommées par le front (Task 7) :
    - `GET /api/auth/me` → 200 `MeBody` | 401
    - `GET /api/auth/discord|google[?return=…&link=1]` → 302
    - `POST /api/auth/logout` → 200 `{ success: true }`
    - `POST /api/auth/link-start` → 200 `{ success: true }` | 401
    - `POST /api/auth/link-twitch` → 200 `{ result: 'linked' | 'already_linked' }` | 401
    - `POST /api/auth/unlink { providerId }` → 200 `{ result: 'unlinked' }` | 403 `{ result: 'forbidden' }` | 400 | 401
    - Retour OAuth : 302 vers le chemin de retour, `/?login_error=<fournisseur>`, ou `/settings?link=linked|already_linked|expired`

- [ ] **Step 1: Write the failing test**

`api/_auth-routes.test.ts` :

```ts
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

async function call(method: string, action: string, extra: { query?: AuthRequest['query']; headers?: AuthRequest['headers']; body?: { providerId: string } } = {}, routeDeps = deps()): Promise<Sent> {
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
    query: { action, ...extra.query },
    body: extra.body,
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

test('state différent du cookie ou retour rejoué : 400, pas 500', async () => {
  const { state, stateCookie } = await loginDiscord();
  assert.equal((await call('GET', 'discord', { query: { code: 'c', state: 'autre' }, headers: { cookie: stateCookie } })).status, 400);
  assert.equal((await call('GET', 'discord', { query: { code: 'c', state } })).status, 400);
});

test('refus sur Discord : retour accueil avec message', async () => {
  const start = await call('GET', 'discord');
  const state = new URL(start.location).searchParams.get('state') ?? '';
  const sent = await call('GET', 'discord', { query: { error: 'access_denied', state }, headers: { cookie: cookieFrom(start, 'tpt_oauth_state') } });
  assert.equal(sent.location, '/?login_error=discord');
});

test('fournisseur non configuré : 503', async () => {
  assert.equal((await call('GET', 'google')).status, 503);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:api`
Expected: FAIL, `Cannot find module '…/api/_auth-routes.ts'`.

- [ ] **Step 3: Write minimal implementation**

`api/_auth-routes.ts` :

```ts
import { randomBytes } from 'node:crypto';
import { authDeps, requireUser, sessionUser, type AuthDeps, type AuthRequest } from './_auth.js';
import {
  DEFAULT_RETURN_PATH, LINK_COOKIE, SESSION_COOKIE, SESSION_TTL_MS, SHORT_TTL_MS, STATE_COOKIE,
  clearCookie, originForHost, parseProvider, readCookie, safeReturnPath, setCookie,
  signLinkTicket, signOAuthState, signSession, verifyLinkTicket, verifyOAuthState, type Provider,
} from './_session.js';
import {
  findAccount, linkAccounts, listGroup, providerOf, unlinkAccount, upsertAccount,
  type AccountProvider, type LinkResult, type UnlinkResult,
} from './_accounts.js';
import { authorizeUrl, exchangeCode, oauthConfig, type FetchFn } from './_oauth.js';
import { runMigrations } from './_db.js';

export type MeBody = {
  userId: string;
  login: string;
  provider: 'twitch' | Provider;
  providerId: string;
  avatar: string | null;
  isAdmin: boolean;
  links: { providerId: string; provider: AccountProvider; name: string }[];
};
export type AuthBody = { error: string } | { success: true } | { result: LinkResult | UnlinkResult } | MeBody;

/** Sous-ensemble de VercelResponse utilisé ici (remplaçable dans les tests). */
export interface AuthReply {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): AuthReply;
  json(body: AuthBody): void;
  redirect(code: number, url: string): void;
}

export type RouteDeps = AuthDeps & { env: NodeJS.ProcessEnv; fetchFn: FetchFn; migrate: () => Promise<void> };

export const routeDeps = (): RouteDeps => ({ ...authDeps(), env: process.env, fetchFn: fetch, migrate: runMigrations });

const queryText = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

export async function handleAuth(req: AuthRequest, reply: AuthReply, deps: RouteDeps): Promise<void> {
  try {
    await deps.migrate();
    const action = queryText(req.query.action);
    const provider = parseProvider(action);
    if (provider) return await oauthRoute(req, reply, deps, provider);
    if (action === 'me' && req.method === 'GET') return await meRoute(req, reply, deps);
    if (req.method !== 'POST') return reply.status(405).json({ error: 'Method not allowed' });
    if (action === 'logout') {
      reply.setHeader('Set-Cookie', clearCookie(SESSION_COOKIE));
      return reply.status(200).json({ success: true });
    }
    if (action === 'link-start') return await linkStartRoute(req, reply, deps);
    if (action === 'link-twitch') return await linkTwitchRoute(req, reply, deps);
    if (action === 'unlink') return await unlinkRoute(req, reply, deps);
    return reply.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('Auth error:', err);
    return reply.status(500).json({ error: 'Internal server error' });
  }
}

async function oauthRoute(req: AuthRequest, reply: AuthReply, deps: RouteDeps, provider: Provider): Promise<void> {
  if (req.method !== 'GET') return reply.status(405).json({ error: 'Method not allowed' });
  const config = oauthConfig(provider, deps.env);
  if (!config || !deps.secret) return reply.status(503).json({ error: 'Connexion indisponible' });
  const origin = originForHost(req.headers.host);
  if (!origin) return reply.status(400).json({ error: 'Hôte non autorisé' });
  const redirectUri = `${origin}/api/auth/${provider}`;
  const code = queryText(req.query.code);
  const refused = queryText(req.query.error);

  if (!code && !refused) {
    const state = randomBytes(16).toString('base64url');
    const returnPath = safeReturnPath(queryText(req.query.return)) ?? DEFAULT_RETURN_PATH;
    const saved = signOAuthState({ state, provider, returnPath, link: queryText(req.query.link) === '1', exp: deps.now + SHORT_TTL_MS }, deps.secret);
    reply.setHeader('Set-Cookie', setCookie(STATE_COOKIE, saved, SHORT_TTL_MS));
    return reply.redirect(302, authorizeUrl(provider, config.clientId, redirectUri, state));
  }

  const saved = verifyOAuthState(readCookie(req.headers.cookie, STATE_COOKIE), deps.secret, deps.now);
  if (!saved || saved.provider !== provider || saved.state !== queryText(req.query.state)) {
    return reply.status(400).json({ error: 'Connexion expirée, recommence' });
  }
  const cookies = [clearCookie(STATE_COOKIE)];
  const profile = refused ? null : await exchangeCode(provider, config, redirectUri, code, deps.fetchFn);
  if (!profile) {
    reply.setHeader('Set-Cookie', cookies);
    return reply.redirect(302, `/?login_error=${provider}`);
  }

  const db = deps.db();
  if (saved.link) {
    const ticket = verifyLinkTicket(readCookie(req.headers.cookie, LINK_COOKIE), deps.secret, deps.now);
    cookies.push(clearCookie(LINK_COOKIE));
    const result = ticket ? await linkAccounts(db, ticket, profile) : 'expired';
    reply.setHeader('Set-Cookie', cookies);
    return reply.redirect(302, `/settings?link=${result}`);
  }

  await upsertAccount(db, profile);
  const session = signSession({ provider, providerId: profile.providerId, exp: deps.now + SESSION_TTL_MS }, deps.secret);
  cookies.push(setCookie(SESSION_COOKIE, session, SESSION_TTL_MS));
  reply.setHeader('Set-Cookie', cookies);
  return reply.redirect(302, saved.returnPath);
}

async function meRoute(req: AuthRequest, reply: AuthReply, deps: RouteDeps): Promise<void> {
  const user = await requireUser(req, deps);
  if (!user) return reply.status(401).json({ error: 'Unauthorized' });
  const db = deps.db();
  const [self, group] = await Promise.all([findAccount(db, user.providerId), listGroup(db, user.userId)]);
  const adminIds = (deps.env.ADMIN_TWITCH_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean);
  return reply.status(200).json({
    userId: user.userId,
    login: user.login,
    provider: user.provider,
    providerId: user.providerId,
    avatar: self?.avatar ?? null,
    // L'admin reste lié au jeton Twitch : un compte lié n'hérite pas du rôle.
    isAdmin: user.provider === 'twitch' && adminIds.includes(user.providerId),
    links: group.map(account => ({ providerId: account.providerId, provider: providerOf(account.providerId), name: account.name })),
  });
}

async function linkStartRoute(req: AuthRequest, reply: AuthReply, deps: RouteDeps): Promise<void> {
  const user = await requireUser(req, deps);
  if (!user || !deps.secret) return reply.status(401).json({ error: 'Connexion requise' });
  const ticket = signLinkTicket({ primaryId: user.userId, name: user.login, exp: deps.now + SHORT_TTL_MS }, deps.secret);
  reply.setHeader('Set-Cookie', setCookie(LINK_COOKIE, ticket, SHORT_TTL_MS));
  return reply.status(200).json({ success: true });
}

async function linkTwitchRoute(req: AuthRequest, reply: AuthReply, deps: RouteDeps): Promise<void> {
  const [twitch, session] = await Promise.all([deps.twitch(req), sessionUser(req, deps)]);
  if (!twitch || !session) return reply.status(401).json({ error: 'Connexion Twitch et session requises' });
  const result = await linkAccounts(deps.db(), { primaryId: session.userId, name: session.login }, { providerId: twitch.userId, name: twitch.login, avatar: null });
  return reply.status(200).json({ result });
}

async function unlinkRoute(req: AuthRequest, reply: AuthReply, deps: RouteDeps): Promise<void> {
  const providerId = String(req.body?.providerId ?? '');
  if (!providerId) return reply.status(400).json({ error: 'providerId requis' });
  const user = await requireUser(req, deps);
  if (!user) return reply.status(401).json({ error: 'Connexion requise' });
  const result = await unlinkAccount(deps.db(), user.userId, providerId, user.providerId);
  return reply.status(result === 'unlinked' ? 200 : 403).json({ result });
}
```

`api/auth/[action].ts` :

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../_utils.js';
import { handleAuth, routeDeps } from '../_auth-routes.js';

// Une seule fonction pour toute l'authentification : le plan Vercel Hobby limite à 12 fonctions.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (checkRateLimit(req, res, 30, 60_000)) return;
  await handleAuth(req, res, routeDeps());
}
```

Supprimer `api/auth/me.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:api` puis `npx tsc -p api --noEmit`
Expected: PASS, `_auth-routes.test.ts` 9/9 ; aucune erreur de type (`VercelResponse` est assignable à `AuthReply`).

- [ ] **Step 5: Point de contrôle** — pas de commit.

---

### Task 6: Stats (`my_discord` et compteur par identifiant)

**Files:**
- Modify: `api/_utils.ts` (nouvelle constante SQL), `api/stats.ts`
- Test: `api/_submissions.test.ts`

**Interfaces:**
- Consumes: `requireUser` (Task 4), `discordIdInGroup`, `discordTotals`, `DiscordTotals` (Task 2).
- Produces:
  - `APPROVED_SUBMISSIONS_SQL` (args `[playerKey, nick]`) dans `api/_utils.ts`
  - `GET /api/stats?action=my_discord` → 200 `DiscordTotals` | 401 | 403 `{ error }`

- [ ] **Step 1: Write the failing test**

`api/_submissions.test.ts` :

```ts
// Lancer : yarn test:api
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { APPROVED_SUBMISSIONS_SQL } from './_utils.ts';

test('propositions approuvées : par identifiant, un pseudo Discord identique ne compte pas', async () => {
  const db = createClient({ url: ':memory:' });
  await db.execute('CREATE TABLE pending_questions (submitted_by TEXT, submitted_by_id TEXT, status TEXT)');
  await db.execute(`INSERT INTO pending_questions VALUES
    ('floxail', '42', 'approved'),
    ('Floxail', 'discord:1', 'approved'),
    ('floxail', NULL, 'approved'),
    ('floxail', '42', 'pending')`);
  const result = await db.execute({ sql: APPROVED_SUBMISSIONS_SQL, args: ['42', 'floxail'] });
  assert.equal(Number(result.rows[0].count), 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:api`
Expected: FAIL, `APPROVED_SUBMISSIONS_SQL` absent (SQL `undefined`).

- [ ] **Step 3: Write minimal implementation**

`api/_utils.ts`, après `PLAYER_HISTORY_SQL` :

```ts
/**
 * Propositions approuvées d'un joueur : par identifiant (un pseudo Discord ou Google
 * identique au pseudo Twitch ne fusionne pas les compteurs), et par pseudo pour les
 * anciennes lignes sans identifiant. Args : [playerKey, nick].
 */
export const APPROVED_SUBMISSIONS_SQL = `SELECT COUNT(*) AS count FROM pending_questions
  WHERE status = 'approved'
    AND (submitted_by_id = ? OR (submitted_by_id IS NULL AND LOWER(submitted_by) = LOWER(?)))`;
```

`api/stats.ts` : ajouter `APPROVED_SUBMISSIONS_SQL` à l'import de `./_utils.js`, plus :

```ts
import { requireUser } from './_auth.js';
import { discordIdInGroup, discordTotals } from './_accounts.js';
```

Remplacer la requête « Questions soumises » de l'action `player` :

```ts
        // Questions soumises (depuis pending_questions — approuvées)
        getDb().execute({ sql: APPROVED_SUBMISSIONS_SQL, args: [playerKey, nick] }),
```

Ajouter l'action, juste avant le bloc `POST /api/stats?action=record_questions` :

```ts
    // ==================== GET /api/stats?action=my_discord ====================
    // Totaux du bot Discord, tous serveurs confondus, visibles par le seul titulaire.
    if (req.method === 'GET' && action === 'my_discord') {
      const user = await requireUser(req);
      if (!user) return res.status(401).json({ error: 'Connexion requise' });
      const discordId = await discordIdInGroup(getDb(), user.userId, user.providerId);
      if (!discordId) return res.status(403).json({ error: 'Aucun compte Discord lié' });
      return res.status(200).json(await discordTotals(getDb(), discordId));
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:api` puis `npx tsc -p api --noEmit`
Expected: PASS ; aucune erreur de type.

- [ ] **Step 5: Point de contrôle** — pas de commit.

---

### Task 7: Front — compte, connexion Discord/Google

**Files:**
- Modify: `src/helpers.ts`, `src/helpers.test.ts`, `src/components/store/auth-store.ts`, `src/components/login.tsx`
- Create: `src/services/api-auth-service.ts`
- Test: `src/components/store/auth-store.test.ts`

**Interfaces:**
- Consumes: routes HTTP de Task 5.
- Produces:
  - `helpers.ts` : `type LoginProvider = 'discord' | 'google'`, `providerLoginUrl(provider, returnPath: string | null, link?: boolean): string`, `startProviderLogin(provider: LoginProvider): void`, `LINK_TWITCH_KEY`
  - `auth-store` : `type AccountProvider`, `type LinkedAccount = { providerId: string; provider: AccountProvider; name: string }`, `type Account = { userId; login; provider; providerId; avatar: string | null; isAdmin: boolean; links: LinkedAccount[] }`, champ `account?: Account`, actions `loadAccount(): Promise<void>`, `hasTwitch(): boolean` ; `isLoggedIn()` = Twitch OU `account`
  - `api-auth-service.ts` : `apiLinkStart(): Promise<void>`, `apiLinkTwitch(): Promise<'linked' | 'already_linked'>`, `apiUnlink(providerId): Promise<'unlinked' | 'forbidden'>`

- [ ] **Step 1: Write the failing tests**

Ajouter à `src/helpers.test.ts` (et `providerLoginUrl` à l'import) :

```ts
describe('providerLoginUrl', () => {
  it('passe le retour interne et le mode liaison au serveur', () => {
    expect(providerLoginUrl('discord', '/stats', false)).toBe('/api/auth/discord?return=%2Fstats');
    expect(providerLoginUrl('google', '/settings', true)).toBe('/api/auth/google?return=%2Fsettings&link=1');
  });

  it('ignore un retour hors site ou absent', () => {
    expect(providerLoginUrl('discord', '//evil.example', false)).toBe('/api/auth/discord');
    expect(providerLoginUrl('discord', null, false)).toBe('/api/auth/discord');
  });
});
```

`src/components/store/auth-store.test.ts` :

```ts
import { useAuthStore } from './auth-store';

const discordAccount = {
  userId: 'discord:1', login: 'Flo', provider: 'discord', providerId: 'discord:1',
  avatar: null, isAdmin: false, links: [{ providerId: 'discord:1', provider: 'discord', name: 'Flo' }],
};

// jsdom (CRA) n'a pas forcément Response : faux fetch minimal, loadAccount ne lit que ok et json()
const respond = (status: number, body: typeof discordAccount | { error: string }) => {
  Object.assign(global, { fetch: async () => ({ ok: status < 400, status, json: async () => body }) });
};

describe('loadAccount', () => {
  beforeEach(() => useAuthStore.setState({ twitchOauthToken: undefined, account: undefined }));

  it('compte Discord : connecté, sans Twitch', async () => {
    respond(200, discordAccount);
    await useAuthStore.getState().loadAccount();
    expect(useAuthStore.getState().isLoggedIn()).toBe(true);
    expect(useAuthStore.getState().hasTwitch()).toBe(false);
    expect(useAuthStore.getState().account?.login).toBe('Flo');
  });

  it('pas de session : non connecté', async () => {
    respond(401, { error: 'Unauthorized' });
    await useAuthStore.getState().loadAccount();
    expect(useAuthStore.getState().isLoggedIn()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:CI='true'; yarn test --watchAll=false src/helpers.test.ts src/components/store/auth-store.test.ts`
Expected: FAIL, `providerLoginUrl is not a function` et `loadAccount is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/helpers.ts`, après `startTwitchLogin` :

```ts
export type LoginProvider = 'discord' | 'google';

/** Clé posée avant de se connecter à Twitch pour le lier au compte Discord/Google en cours. */
export const LINK_TWITCH_KEY = 'link_twitch_pending';

/** Connexion Discord/Google : l'échange OAuth se fait côté serveur (`api/auth/[action].ts`). */
export function providerLoginUrl(provider: LoginProvider, returnPath: string | null, link = false): string {
  const params = new URLSearchParams();
  const safe = safeReturnPath(returnPath);
  if (safe) params.set('return', safe);
  if (link) params.set('link', '1');
  const query = params.toString();
  return `/api/auth/${provider}${query ? `?${query}` : ''}`;
}

export function startProviderLogin(provider: LoginProvider): void {
  window.location.href = providerLoginUrl(provider, takeReturnPath());
}
```

`src/components/store/auth-store.ts` :

Types, après `AuthData` :

```ts
export type AccountProvider = 'twitch' | 'discord' | 'google';
export type LinkedAccount = { providerId: string; provider: AccountProvider; name: string };
/** Identité renvoyée par /api/auth/me (Twitch ou session Discord/Google). Jamais persistée : vient du serveur. */
export type Account = {
  userId: string;
  login: string;
  provider: AccountProvider;
  providerId: string;
  avatar: string | null;
  isAdmin: boolean;
  links: LinkedAccount[];
};
```

Dans `AuthData`, ajouter `account?: Account,`. Dans `Actions`, ajouter :

```ts
  loadAccount: () => Promise<void>;
  hasTwitch: () => boolean;
```

`clear` (ajouter `account: undefined` et l'appel de déconnexion serveur) :

```ts
      clear: () => {
        set({
          twitchOauthToken: undefined,
          tokenExpiresAt: undefined,
          twitchUserId: undefined,
          isAdmin: undefined,
          account: undefined,
        });
        // Le cookie de session Discord/Google est HttpOnly : seul le serveur peut l'effacer
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        // Explicitly clear localStorage
        localStorage.removeItem('auth_data');
        sessionStorage.clear();
      },
```

Nouvelles actions (après `checkIsAdmin`) :

```ts
      loadAccount: async () => {
        const headers: Record<string, string> = {};
        const token = get().getTwitchOAuthToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        try {
          const res = await fetch('/api/auth/me', { headers });
          const account: Account | undefined = res.ok ? await res.json() : undefined;
          set({ account });
        } catch {
          // Erreur réseau : on garde l'état connu
        }
      },
      hasTwitch: (): boolean => get().twitchOauthToken !== undefined,
```

`isLoggedIn` :

```ts
      isLoggedIn: (): boolean => {
        const current = get();
        return current.twitchOauthToken !== undefined || current.account !== undefined;
      },
```

`partialize` : exclure aussi `account` :

```ts
          Object.entries(state).filter(([key]) => !['twitchNick', 'account'].includes(key)),
```

`src/services/api-auth-service.ts` :

```ts
/**
 * Liaison de comptes (Twitch, Discord, Google). Le cookie de session part tout seul
 * (même origine) ; le jeton Twitch est ajouté quand il existe.
 */
import { useAuthStore } from 'components/store/auth-store';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = useAuthStore.getState().getTwitchOAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function post(action: string, body?: { providerId: string }): Promise<Response> {
  return fetch(`/api/auth/${action}`, { method: 'POST', headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
}

export async function apiLinkStart(): Promise<void> {
  const res = await post('link-start');
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
}

export async function apiLinkTwitch(): Promise<'linked' | 'already_linked'> {
  const res = await post('link-twitch');
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const body: { result: 'linked' | 'already_linked' } = await res.json();
  return body.result;
}

export async function apiUnlink(providerId: string): Promise<'unlinked' | 'forbidden'> {
  const res = await post('unlink', { providerId });
  if (res.status === 403) return 'forbidden';
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return 'unlinked';
}
```

`src/components/login.tsx` :

Import :

```ts
import { startProviderLogin, startTwitchLogin } from '../helpers';
```

Dans le composant, avant `return` :

```tsx
  const discordIcon = <FontAwesomeIcon icon={['fab', 'discord']} color="#5865F2" />;
  const googleIcon = <FontAwesomeIcon icon={['fab', 'google']} color="#EA4335" />;
  // Seules les valeurs connues sont affichées : le paramètre vient de l'URL
  const failedProvider = ['discord', 'google'].find(p => p === new URLSearchParams(window.location.search).get('login_error'));
```

Remplacer le texte d'accroche et le bloc des boutons :

```tsx
        <p style={{ color: 'var(--lumon-text-dim)', fontFamily: "'Share Tech Mono', monospace", marginTop: '1rem' }}>Connecte-toi pour commencer</p>
      </div>
      {failedProvider && (
        <p className="text-glow-danger" style={{ textAlign: 'center' }}>Connexion {failedProvider} impossible. Réessaie.</p>
      )}
      <LoginButton loggedIn={isLoggedIn()} appName="Twitch" onClick={twitchLogin} icon={twitchIcon} />
      <p style={{ textAlign: 'center', color: 'var(--lumon-text-dim)', fontSize: '0.8rem', margin: '0 0 1rem' }}>
        Twitch est requis pour animer un quiz.
      </p>
      <LoginButton loggedIn={false} appName="Discord" onClick={async () => startProviderLogin('discord')} icon={discordIcon} />
      <LoginButton loggedIn={false} appName="Google" onClick={async () => startProviderLogin('google')} icon={googleIcon} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `$env:CI='true'; yarn test --watchAll=false` puis `npx tsc --noEmit -p .`
Expected: toutes les suites vertes ; aucune erreur de type.

- [ ] **Step 5: Point de contrôle** — pas de commit.

---

### Task 8: Front — routage, menu, quiz réservé à Twitch, comptes liés

**Files:**
- Create: `src/components/twitch-required.tsx`, `src/components/linked-accounts.tsx`
- Modify: `src/App.tsx`, `src/components/global-menu.tsx`, `src/components/settings.tsx`

**Interfaces:**
- Consumes: Task 7 (`loadAccount`, `hasTwitch`, `account`, `providerLoginUrl`, `LINK_TWITCH_KEY`, `apiLinkStart`, `apiLinkTwitch`, `apiUnlink`), `startTwitchLogin` (`helpers.ts`).
- Produces: composants `TwitchRequired` et `LinkedAccounts` (exports par défaut).

- [ ] **Step 1: Composant `TwitchRequired`**

`src/components/twitch-required.tsx` :

```tsx
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { startTwitchLogin } from '../helpers';

/** /quiz pour un compte Discord/Google : le quiz parle dans le chat avec le jeton du streamer. */
const TwitchRequired = () => (
  <div style={{ textAlign: 'center', marginTop: '50px' }}>
    <p style={{ color: 'var(--lumon-text-dim)', fontFamily: "'Share Tech Mono', monospace" }}>
      Connecte-toi avec Twitch pour animer un quiz.
    </p>
    <button className="terminal-btn" onClick={() => startTwitchLogin('/quiz')}>
      Connexion Twitch <FontAwesomeIcon icon={['fab', 'twitch']} color="#6441A4" />
    </button>
  </div>
);

export default TwitchRequired;
```

- [ ] **Step 2: Routage dans `App.tsx`**

Imports :

```ts
import TwitchRequired from './components/twitch-required';
```

Sélecteurs (avec les autres) — `account` et `hasTwitch` re-rendent App quand le compte change :

```ts
	const account = useAuthStore(s => s.account);
	const hasTwitch = useAuthStore(s => s.twitchOauthToken !== undefined);
	const loadAccount = useAuthStore(s => s.loadAccount);
```

Remplacer l'effet de redirection (celui qui commence par `// CGU et confidentialité`) :

```tsx
	useEffect(() => {
		// CGU et confidentialité : lisibles par tous, sans redirection
		if (isPublicPath(location.pathname)) return;
		let cancelled = false;
		// Avec Twitch, on décide tout de suite ; sinon on demande au serveur s'il y a une session Discord/Google
		const ready = useAuthStore.getState().hasTwitch() ? Promise.resolve() : loadAccount();
		ready.then(() => {
			if (cancelled) return;
			const auth = useAuthStore.getState();
			if (!auth.isLoggedIn()) {
				// Page demandée (ex. lien /proposer du bot Discord) : rouverte après la connexion
				rememberReturnPath(location.pathname + location.search);
				setView(<Login />);
				navigate('/');
			} else if (!auth.hasTwitch()) {
				// Compte Discord/Google : pas de réglages de chaîne, accueil sur Contribuer
				if (location.pathname === '/') navigate('/contribute');
			} else if (!isInitialized()) {
				navigate('/settings');
			} else if (location.pathname === '/') {
				setView(<Quiz />);
				navigate('/quiz');
			}
		});
		return () => { cancelled = true; };
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [navigate]);
```

Garder `account` lu pour que `loggedIn` soit recalculé (ligne `const loggedIn = isLoggedIn();` inchangée) ; ajouter juste au-dessus :

```tsx
	// account/hasTwitch : lus pour re-rendre l'en-tête quand la session Discord/Google arrive
	const loggedIn = isLoggedIn() || account !== undefined;
```

(et supprimer l'ancienne ligne `const loggedIn = isLoggedIn();`).

Route `/quiz` :

```tsx
						<Route path="/quiz" element={hasTwitch ? <Quiz /> : <TwitchRequired />} />
```

- [ ] **Step 3: Menu**

`src/components/global-menu.tsx` : avatar de repli pour les comptes Discord/Google.

```tsx
  const twitchAvatar = useAuthStore((state) => state.twitchAvatar);
  const accountAvatar = useAuthStore((state) => state.account?.avatar);
  const avatar = twitchAvatar ?? accountAvatar ?? '/favicon.png';
```

Dans `CustomToggle`, remplacer `src={twitchAvatar}` par `src={avatar}`. Les entrées admin sont déjà masquées (`isAdmin` faux hors Twitch) ; « Settings » mène à la page qui n'affiche que les comptes liés hors Twitch (Step 5).

- [ ] **Step 4: Composant `LinkedAccounts`**

`src/components/linked-accounts.tsx` :

```tsx
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { LINK_TWITCH_KEY, providerLoginUrl, startTwitchLogin, type LoginProvider } from '../helpers';
import { apiLinkStart, apiLinkTwitch, apiUnlink } from '../services/api-auth-service';
import { useAuthStore, type AccountProvider, type LinkedAccount } from './store/auth-store';

const LINK_MESSAGES = new Map([
  ['linked', 'Compte lié.'],
  ['already_linked', 'Ce compte est déjà lié à une autre identité.'],
  ['expired', 'Liaison expirée, recommence.'],
]);

const PROVIDERS: { provider: AccountProvider; label: string; color: string }[] = [
  { provider: 'twitch', label: 'Twitch', color: '#6441A4' },
  { provider: 'discord', label: 'Discord', color: '#5865F2' },
  { provider: 'google', label: 'Google', color: '#EA4335' },
];

/** Paramètres → comptes liés : Twitch, Discord et Google d'une même personne = une identité. */
const LinkedAccounts = () => {
  const account = useAuthStore(s => s.account);
  const loadAccount = useAuthStore(s => s.loadAccount);
  const [message, setMessage] = useState(() => LINK_MESSAGES.get(new URLSearchParams(window.location.search).get('link') ?? '') ?? '');

  useEffect(() => {
    // Retour d'une connexion Twitch lancée depuis cette page : on termine la liaison
    const pending = sessionStorage.getItem(LINK_TWITCH_KEY) !== null && useAuthStore.getState().hasTwitch();
    sessionStorage.removeItem(LINK_TWITCH_KEY);
    const linking = pending
      ? apiLinkTwitch().then(result => setMessage(LINK_MESSAGES.get(result) ?? '')).catch(() => setMessage('Liaison impossible.'))
      : Promise.resolve();
    linking.then(() => loadAccount());
  }, [loadAccount]);

  if (!account) return null;

  const accounts: LinkedAccount[] = account.links.length > 0
    ? account.links
    : [{ providerId: account.providerId, provider: account.provider, name: account.login }];
  const linkedProviders = new Set(accounts.map(a => a.provider));

  const link = async (provider: AccountProvider) => {
    if (provider === 'twitch') {
      sessionStorage.setItem(LINK_TWITCH_KEY, '1');
      startTwitchLogin('/settings');
      return;
    }
    const target: LoginProvider = provider;
    try {
      await apiLinkStart();
      window.location.href = providerLoginUrl(target, '/settings', true);
    } catch {
      setMessage('Liaison impossible.');
    }
  };

  const unlink = async (providerId: string) => {
    const result = await apiUnlink(providerId).catch(() => 'forbidden' as const);
    setMessage(result === 'unlinked' ? 'Compte délié.' : 'Impossible de délier ce compte.');
    loadAccount();
  };

  return (
    <div className="mb-3">
      <h3>Comptes liés</h3>
      {message && <p style={{ color: 'var(--lumon-cyan)' }}>{message}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {accounts.map(a => {
          const meta = PROVIDERS.find(p => p.provider === a.provider);
          const locked = a.providerId === account.userId || a.providerId === account.providerId;
          return (
            <li key={a.providerId} style={{ marginBottom: '0.5rem' }}>
              <FontAwesomeIcon icon={['fab', a.provider]} color={meta?.color} /> {a.name}
              {!locked && (
                <button className="terminal-btn" style={{ marginLeft: '1rem', fontSize: '0.75rem' }} onClick={() => unlink(a.providerId)}>Délier</button>
              )}
            </li>
          );
        })}
      </ul>
      {PROVIDERS.filter(p => !linkedProviders.has(p.provider)).map(p => (
        <button key={p.provider} className="terminal-btn" style={{ marginRight: '0.5rem' }} onClick={() => link(p.provider)}>
          Lier {p.label} <FontAwesomeIcon icon={['fab', p.provider]} color={p.color} />
        </button>
      ))}
    </div>
  );
};

export default LinkedAccounts;
```

Note : `const target: LoginProvider = provider;` ne compile que si TypeScript a éliminé `'twitch'` (c'est le cas après le `return` du `if`). `'forbidden' as const` est une assertion de littéral, autorisée par l'anti-slop.

- [ ] **Step 5: Page Paramètres**

`src/components/settings.tsx` :

```tsx
import LinkedAccounts from './linked-accounts';
import { useAuthStore } from './store/auth-store';
```

Dans le composant :

```tsx
  const hasTwitch = useAuthStore(s => s.twitchOauthToken !== undefined);
```

Dans le `return`, envelopper le `<Form …>…</Form>` existant et ajouter les comptes liés :

```tsx
    <div style={{ width: '600px', margin: 'auto' }} className="mb-3">
      <LinkedAccounts />
      {hasTwitch && (
        <Form noValidate onSubmit={submit}>
          {/* contenu du formulaire inchangé */}
        </Form>
      )}
    </div>
```

(le commentaire ci-dessus désigne le contenu actuel du `<Form>`, à garder tel quel.)

- [ ] **Step 6: Vérifier**

Run: `npx tsc --noEmit -p .` puis `$env:CI='true'; yarn test --watchAll=false` puis `npx oxlint src/components/linked-accounts.tsx src/components/twitch-required.tsx src/helpers.ts src/services/api-auth-service.ts src/components/store/auth-store.ts`
Expected: aucune erreur de type, toutes les suites vertes, aucune alerte oxlint sur ces fichiers (hors avertissement connu `MODULE_TYPELESS_PACKAGE_JSON`).

- [ ] **Step 7: Point de contrôle** — pas de commit.

---

### Task 9: Stats — bloc « Mes parties Discord »

**Files:**
- Modify: `src/services/api-stats-service.ts`, `src/components/stats.tsx`

**Interfaces:**
- Consumes: `GET /api/stats?action=my_discord` (Task 6), `account`, `loadAccount` (Task 7).
- Produces: `type DiscordTotals`, `apiGetMyDiscordStats(): Promise<DiscordTotals>`.

- [ ] **Step 1: Service**

`src/services/api-stats-service.ts`, à la fin :

```ts
export type DiscordTotals = { score: number; games: number; answers: number; firsts: number; bestCombo: number; fastest: number | null };

/** Totaux du bot Discord du compte connecté (ou de son Discord lié), tous serveurs confondus. */
export async function apiGetMyDiscordStats(): Promise<DiscordTotals> {
  const headers: Record<string, string> = {};
  const token = useAuthStore.getState().getTwitchOAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch('/api/stats?action=my_discord', { headers });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.json();
}
```

Ajouter l'import en tête s'il n'existe pas : `import { useAuthStore } from 'components/store/auth-store';`.

- [ ] **Step 2: Bloc dans `stats.tsx`**

Import : ajouter `apiGetMyDiscordStats` et `type DiscordTotals` à l'import existant de `services/api-stats-service`.

Dans le composant `Stats`, avec les autres états :

```tsx
  const account = useAuthStore((state) => state.account);
  const loadAccount = useAuthStore((state) => state.loadAccount);
  const [discordTotals, setDiscordTotals] = useState<DiscordTotals | null>(null);
  const hasDiscord = account?.provider === 'discord' || (account?.links ?? []).some(l => l.provider === 'discord');

  // Un streamer Twitch n'a pas forcément chargé son compte (liaisons) : on le demande ici
  useEffect(() => {
    if (!account) loadAccount();
  }, [account, loadAccount]);

  useEffect(() => {
    if (hasDiscord) apiGetMyDiscordStats().then(setDiscordTotals).catch(() => setDiscordTotals(null));
  }, [hasDiscord]);
```

Juste après le titre de la page (le `<h4>` « Statistiques » et son conteneur), insérer :

```tsx
      {discordTotals && (
        <div className="terminal-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <h6 style={{ color: '#5865F2', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            MES PARTIES DISCORD
          </h6>
          <p style={{ margin: 0 }}>
            {discordTotals.score} points · {discordTotals.games} parties · {discordTotals.answers} bonnes réponses ·{' '}
            {discordTotals.firsts} FIRST · meilleur combo {discordTotals.bestCombo}
            {discordTotals.fastest !== null && <> · plus rapide {(discordTotals.fastest / 1000).toFixed(2)} s</>}
          </p>
        </div>
      )}
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit -p .` puis `$env:CI='true'; yarn test --watchAll=false`
Expected: aucune erreur ; suites vertes.

- [ ] **Step 4: Point de contrôle** — pas de commit.

---

### Task 10: Textes, documentation, vérification finale

**Files:**
- Modify: `bot/src/commands.ts`, `bot/src/commands.test.ts`, `src/components/legal.tsx`, `src/components/changelog.tsx`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-13-multi-login-design.md`

- [ ] **Step 1: Write the failing test (bot)**

`bot/src/commands.test.ts`, dans le test qui vérifie `PROPOSE_MESSAGE`, ajouter :

```ts
  assert.match(PROPOSE_MESSAGE, /Twitch, Discord ou Google/);
```

Run: `cd bot; npm test`
Expected: FAIL sur cette assertion.

- [ ] **Step 2: Texte du bot**

`bot/src/commands.ts` :

```ts
  'Connexion avec ton compte Twitch, Discord ou Google requise. Format, une question par bloc :',
```

Run: `cd bot; npm test`
Expected: PASS.

- [ ] **Step 3: Pages légales** (`src/components/legal.tsx`)

`UPDATED` : date du jour de l'implémentation (format `13 octobre 2026`).

CGU, section Comptes :

```tsx
      La connexion au site se fait avec un compte Twitch, Discord ou Google (Twitch est nécessaire pour animer un quiz) ;
      le bot utilise ton compte Discord. Tu peux lier ces comptes entre eux dans les paramètres. Les conditions de Twitch,
      Discord et Google s'appliquent en plus des présentes.
```

CGU, propositions :

```tsx
      <li>En proposant une question, tu autorises son utilisation gratuite sur le site et le bot. Ton pseudo (Twitch, Discord ou Google) peut être affiché comme auteur.</li>
```

Confidentialité, remplacer l'entrée « Connexion au site (Twitch) » et ajouter les nouvelles :

```tsx
      <li>
        <strong>Connexion au site avec Twitch</strong> : pseudo, identifiant et avatar Twitch. Le token de connexion reste dans ton
        navigateur (stockage local) jusqu'à son expiration fixée par Twitch ; nos serveurs ne font que le vérifier auprès de Twitch.
      </li>
      <li>
        <strong>Connexion au site avec Discord ou Google</strong> : identifiant, pseudo (ou nom) et avatar du compte. Aucune
        adresse e-mail n'est demandée. Un cookie de session strictement nécessaire (30 jours, inaccessible aux scripts) garde
        la connexion ouverte ; il est effacé à la déconnexion.
      </li>
      <li>
        <strong>Comptes liés</strong> : si tu lies tes comptes, leur correspondance est enregistrée pour regrouper tes propositions
        et statistiques sous une seule identité. Tu peux les délier à tout moment dans les paramètres.
      </li>
```

Propositions et signalements :

```tsx
        <strong>Propositions et signalements</strong> : contenu proposé ou signalé, avec le pseudo et l'identifiant du compte
        de son auteur. Pour les streamers, la liste des questions déjà jouées (500 au plus) est conservée pour éviter les répétitions.
```

Dans la liste « Ce que nous ne faisons pas », remplacer la ligne du token :

```tsx
      <li>Le site ne stocke pas ton token Twitch ni tes jetons Discord ou Google sur ses serveurs.</li>
```

Dans la phrase de transfert hors UE (`Twitch et Discord traitent aussi tes…`), remplacer `Twitch et Discord` par `Twitch, Discord et Google`.

- [ ] **Step 4: Changelog** (`src/components/changelog.tsx`), nouvelle entrée en tête, date du jour (format `JJ/MM/AAAA`) :

```tsx
        <h3><u>13/10/2026</u></h3>
        <br />
        <h5 className="h5-with-line">Connexion avec Discord ou Google</h5>
        <br />
        <ul>
          <li>Connexion possible avec <b>Discord</b> ou <b>Google</b> pour proposer des questions, créer des boîtes et voir les stats</li>
          <li>Twitch reste nécessaire pour animer un quiz</li>
          <li>Paramètres : <b>Comptes liés</b> pour regrouper Twitch, Discord et Google sous une seule identité</li>
          <li>Stats : bloc <b>Mes parties Discord</b> avec tes résultats du bot, tous serveurs confondus</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Session Twitch plus fiable</h5>
        <br />
        <ul>
          <li>Le quiz ne se coupe plus du chat après quelques heures sur la page : le jeton est renouvelé automatiquement avant le lancement</li>
        </ul>
        <br />
```

- [ ] **Step 5: Documentation**

`CLAUDE.md`, ligne « Déploiement » :

```md
**Déploiement** : auto à chaque push (Vercel). Variables requises : `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_TWITCH_IDS`, `TWITCH_CLIENT_ID` (sinon toute auth API refusée — fail-closed). Connexion Discord/Google : `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` (absentes → bouton concerné en 503, le reste marche). Limite Hobby : 12 fonctions, d'où `api/auth/[action].ts` unique.
```

Dans la structure `api/`, remplacer `auth/me.ts` s'il apparaît, et ajouter :

```text
├── _auth.ts               # requireUser : Bearer Twitch ou cookie de session Discord/Google
├── _accounts.ts           # account_links : identité principale, liaison, totaux Discord
├── _session.ts            # jetons signés HMAC, cookies, origines autorisées
├── _oauth.ts              # échange OAuth Discord/Google
├── _auth-routes.ts        # routes de api/auth/[action].ts (me, discord, google, logout, link-*, unlink)
```

Spec `docs/superpowers/specs/2026-10-13-multi-login-design.md` : statut « implémenté », et sous « Approche » ajouter le paragraphe :

```md
Écarts d'implémentation : une seule fonction `api/auth/[action].ts` (limite de 12 fonctions du plan Hobby) ; le cookie ne porte que `provider`, `providerId` et `exp`, nom et avatar sont dans `account_links` (colonnes `name`, `avatar`), où chaque compte Discord/Google a sa ligne dès sa première connexion.
```

- [ ] **Step 6: Vérification finale**

Run, dans l'ordre :

```powershell
yarn test:api
$env:CI='true'; yarn test --watchAll=false
npx tsc --noEmit -p .
npx tsc -p api --noEmit
cd bot; npm test; npm run typecheck; cd ..
yarn build
```

Expected: tout vert ; `yarn build` sans erreur.

- [ ] **Step 7: Actions de l'utilisateur** (à lui transmettre, rien à exécuter)

1. Discord Developer Portal → application du bot → OAuth2 : ajouter la redirection `https://trivial.floxail.fr/api/auth/discord` ; copier le Client Secret.
2. Google Cloud Console → API et services → Identifiants → « ID client OAuth », type Application Web ; origine `https://trivial.floxail.fr`, redirection `https://trivial.floxail.fr/api/auth/google`. Écran de consentement : scopes `openid` et `profile` seulement, liens CGU et confidentialité.
3. Vercel → Environment Variables : `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` (générer : `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`), puis redéployer.
4. Recette : connexion Discord puis Google, proposer une question, lier Twitch depuis Paramètres, vérifier que la proposition apparaît sous le Twitch, délier Google, déconnexion.

- [ ] **Step 8: Point de contrôle** — pas de commit.
