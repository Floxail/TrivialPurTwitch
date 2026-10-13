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
    // Repli sur le chemin si la route dynamique ne remplit pas query.action
    const action = queryText(req.query.action) || (new URL(req.url ?? '/', 'http://x').pathname.split('/').pop() ?? '');
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
  // Retours vus par l'utilisateur (navigation de page) : jamais de page JSON brute
  const failed = `/?login_error=${provider}`;
  if (!config || !deps.secret) return reply.redirect(302, failed);
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
    return reply.redirect(302, failed);
  }
  const cookies = [clearCookie(STATE_COOKIE)];
  const profile = refused ? null : await exchangeCode(provider, config, redirectUri, code, deps.fetchFn);
  if (!profile) {
    if (saved.link) cookies.push(clearCookie(LINK_COOKIE));
    reply.setHeader('Set-Cookie', cookies);
    return reply.redirect(302, saved.link ? '/settings?link=failed' : failed);
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
