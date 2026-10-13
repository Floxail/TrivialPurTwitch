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

  it('erreur passagère (429, 500) : la session connue est gardée', async () => {
    respond(200, discordAccount);
    await useAuthStore.getState().loadAccount();
    respond(500, { error: 'Internal server error' });
    await useAuthStore.getState().loadAccount();
    expect(useAuthStore.getState().account?.login).toBe('Flo');
  });

  it('pas de session : non connecté', async () => {
    respond(401, { error: 'Unauthorized' });
    await useAuthStore.getState().loadAccount();
    expect(useAuthStore.getState().isLoggedIn()).toBe(false);
  });
});

describe('logout', () => {
  it('attend la réponse du serveur avant de vider le compte (sinon /me rouvre la session)', async () => {
    useAuthStore.setState({ account: { ...discordAccount, provider: 'discord', links: [] } });
    let release = () => {};
    const calls: string[] = [];
    Object.assign(global, { fetch: (url: string) => { calls.push(url); return new Promise(resolve => { release = () => resolve({ ok: true, status: 200 }); }); } });
    const done = useAuthStore.getState().logout();
    expect(calls).toEqual(['/api/auth/logout']);
    release();
    await done;
    expect(useAuthStore.getState().account).toBeUndefined();
  });
});
