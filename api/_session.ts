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
  // Le navigateur retire tabulations et sauts de ligne d'une URL : « /\t/hôte » deviendrait « //hôte »
  if ([...path].some(char => char <= ' ' || char === '\\')) return null;
  if (path === '/' || path.startsWith('/callback')) return null;
  return path;
}
