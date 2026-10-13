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
    // SAFETY: champs tous optionnels et vérifiés avant usage ; une réponse inattendue donne null.
    const token = (await tokenRes.json()) as TokenResponse;
    if (!token.access_token) return null;
    const profileRes = await fetchFn(endpoints.profile, { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!profileRes.ok) return null;
    // SAFETY: idem, discordProfile/googleProfile exigent l'identifiant et retombent sur des valeurs par défaut.
    const profile = (await profileRes.json()) as DiscordUser & GoogleUser;
    return provider === 'discord' ? discordProfile(profile) : googleProfile(profile);
  } catch (err) {
    console.error(`Échange OAuth ${provider} impossible:`, err);
    return null;
  }
}
