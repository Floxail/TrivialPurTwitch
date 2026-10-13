import type { VercelRequest } from '@vercel/node';
import type { Client } from '@libsql/client';
import { requireAnyTwitchAuth } from './_utils.js';
import { SESSION_COOKIE, isAllowedOrigin, readCookie, verifySession, type Provider } from './_session.js';
import { findAccount, resolvePrimary } from './_accounts.js';
import { getDb } from './_db.js';

export type AuthRequest = Pick<VercelRequest, 'method' | 'headers' | 'query' | 'body' | 'url'>;
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
