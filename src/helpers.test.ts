import { isPublicPath, providerLoginUrl, rememberReturnPath, safeReturnPath, takeReturnPath, tokenNeedsRefresh } from './helpers';

describe('tokenNeedsRefresh', () => {
  const now = 1_000_000_000;
  const minutes = (n: number) => n * 60 * 1000;

  it('renouvelle un jeton expiré ou qui expire pendant le quiz (< 30 min)', () => {
    expect(tokenNeedsRefresh(now - 1, now)).toBe(true);
    expect(tokenNeedsRefresh(now + minutes(29), now)).toBe(true);
  });

  it('garde un jeton encore valable longtemps ou sans expiration connue', () => {
    expect(tokenNeedsRefresh(now + minutes(31), now)).toBe(false);
    expect(tokenNeedsRefresh(undefined, now)).toBe(false);
  });
});

describe('safeReturnPath', () => {
  it('accepte un chemin interne avec ses paramètres', () => {
    expect(safeReturnPath('/contribute?mode=bulk')).toBe('/contribute?mode=bulk');
  });

  it('refuse tout ce qui peut sortir du site (redirection ouverte)', () => {
    expect(safeReturnPath('https://evil.example')).toBeNull();
    expect(safeReturnPath('//evil.example/x')).toBeNull();
    expect(safeReturnPath('/\\evil.example')).toBeNull();
    expect(safeReturnPath('javascript:alert(1)')).toBeNull();
    expect(safeReturnPath('/\t/evil.example')).toBeNull();
    expect(safeReturnPath('/\n/evil.example')).toBeNull();
  });

  it('ignore l\'accueil, le callback OAuth et l\'absence de valeur', () => {
    expect(safeReturnPath('/')).toBeNull();
    expect(safeReturnPath('/callback#access_token=x')).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
  });
});

describe('rememberReturnPath / takeReturnPath', () => {
  beforeEach(() => sessionStorage.clear());

  it('revient sur la page demandée avant la connexion, une seule fois', () => {
    rememberReturnPath('/contribute?mode=bulk');
    expect(takeReturnPath()).toBe('/contribute?mode=bulk');
    expect(takeReturnPath()).toBe('/');
  });

  it('ne mémorise pas un chemin refusé', () => {
    rememberReturnPath('//evil.example');
    expect(takeReturnPath()).toBe('/');
  });
});

describe('isPublicPath', () => {
  it('CGU et confidentialité lisibles sans connexion (exigé par Discord)', () => {
    expect(isPublicPath('/cgu')).toBe(true);
    expect(isPublicPath('/confidentialite')).toBe(true);
  });

  it('le reste du site demande toujours la connexion', () => {
    expect(isPublicPath('/contribute')).toBe(false);
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/cgu-pirate')).toBe(false);
  });
});

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
