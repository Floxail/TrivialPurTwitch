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
