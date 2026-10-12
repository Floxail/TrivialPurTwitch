import { isPublicPath, rememberReturnPath, safeReturnPath, takeReturnPath } from './helpers';

describe('safeReturnPath', () => {
  it('accepte un chemin interne avec ses paramètres', () => {
    expect(safeReturnPath('/contribute?mode=bulk')).toBe('/contribute?mode=bulk');
  });

  it('refuse tout ce qui peut sortir du site (redirection ouverte)', () => {
    expect(safeReturnPath('https://evil.example')).toBeNull();
    expect(safeReturnPath('//evil.example/x')).toBeNull();
    expect(safeReturnPath('/\\evil.example')).toBeNull();
    expect(safeReturnPath('javascript:alert(1)')).toBeNull();
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
