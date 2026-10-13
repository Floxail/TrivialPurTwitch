/**
 * Bac des questions sans boîte assignée.
 *
 * Doit rester aligné avec DEFAULT_BOX_NAME dans api/_utils.ts : c'est le
 * serveur qui tranche la boîte de destination, cette constante ne sert qu'à
 * proposer le bon choix dans l'UI.
 */
export const DEFAULT_BOX_NAME = 'Sans boîte';

export const getAppHomeURL = () => {
  return new URL(window.location.href).origin + process.env.PUBLIC_URL;
};

export const getQueryParam = (name: string) => {
  return getParam(name, window.location.search);
};

export const getHashParam = (name: string) => {
  return getParam(name, window.location.hash);
};

/** Pages lisibles sans connexion : Discord exige que les CGU et la politique de confidentialité soient publiques. */
const PUBLIC_PATHS = new Set(['/cgu', '/confidentialite']);

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.has(path);
}

const RETURN_PATH_KEY = 'login_return_path';

/**
 * Chemin interne vers lequel revenir après la connexion, ou null.
 * Seuls les chemins du site sont acceptés : « //hôte », « /\hôte » ou une URL complète
 * feraient sortir du site (redirection ouverte).
 */
export function safeReturnPath(path: string | null): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  // Le navigateur retire tabulations et sauts de ligne d'une URL : « /\t/hôte » deviendrait « //hôte »
  if (Array.from(path).some(char => char <= ' ' || char === '\\')) return null;
  if (path === '/' || path.startsWith('/callback')) return null;
  return path;
}

/** À appeler quand un visiteur non connecté est renvoyé vers la page de connexion. */
export function rememberReturnPath(path: string): void {
  const safe = safeReturnPath(path);
  if (safe) sessionStorage.setItem(RETURN_PATH_KEY, safe);
}

/** Page à rouvrir après la connexion (une seule fois), « / » par défaut. */
export function takeReturnPath(): string {
  const path = safeReturnPath(sessionStorage.getItem(RETURN_PATH_KEY));
  sessionStorage.removeItem(RETURN_PATH_KEY);
  return path ?? '/';
}

/** Marge avant expiration : un quiz lancé maintenant ne doit pas perdre le chat en cours de route. */
const TOKEN_REFRESH_MARGIN_MS = 30 * 60 * 1000;

export function tokenNeedsRefresh(expiresAt: number | undefined, now: number): boolean {
  return expiresAt !== undefined && expiresAt - now < TOKEN_REFRESH_MARGIN_MS;
}

/**
 * Redirige vers Twitch pour obtenir un jeton, puis revient sur `returnPath`.
 * Si l'utilisateur a déjà autorisé l'app et est connecté à Twitch, Twitch renvoie
 * directement sans rien demander (force_verify=false) : simple aller-retour.
 */
export function startTwitchLogin(returnPath?: string): void {
  if (returnPath) rememberReturnPath(returnPath);
  const state = crypto.randomUUID();
  sessionStorage.setItem('oauth_state', state);
  // Implicit Flow : le flux avec code exige un client_secret côté serveur
  window.location.href = 'https://id.twitch.tv/oauth2/authorize' +
    '?client_id=' + process.env.REACT_APP_TWITCH_CLIENT_ID +
    '&redirect_uri=' + encodeURIComponent(getAppHomeURL() + '/callback') +
    '&scope=chat:read+chat:edit+whispers:edit' +
    '&force_verify=false' +
    '&response_type=token' +
    '&state=' + state;
}

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

const getParam = (name: string, value: string) => {
  name = name.replace(/[[]/, '\\[').replace(/[\]]/, '\\]');
  var regex = new RegExp('[\\?&#]' + name + '=([^&#]*)'),
    results = regex.exec(value);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

export const colors: string[] = ['#D23F9A', '#7FBB61', '#2C75C2', '#F2A83A', '#6456F1', '#19E3B2', '#FA6B4D', '#8C84D4', '#D3F721', '#4A4A47'];

// lower-case + remove diacritic + remove some special characters
export const cleanValueLight = (value: string) => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[!?]+$/g, '')
    .replaceAll(/^[!?]+/g, '')
    .replaceAll(/ [!?]+/g, ' ')
    .replaceAll(/[!?]+ /g, ' ')
    .replaceAll(/[¿¡*,.'':_/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replaceAll('œ', 'oe')
    .replaceAll(/[$]/g, 's')
    .replaceAll(/[ø]/g, 'o')
    .trim();
};

// Remove articles (le, la, les, un, une, des, l', the, a, an) for more permissive matching
export const removeArticles = (value: string) => {
  return value
    .replace(/^le /i, '')
    .replace(/^la /i, '')
    .replace(/^les /i, '')
    .replace(/^un /i, '')
    .replace(/^une /i, '')
    .replace(/^des /i, '')
    .replace(/^l'/i, '')
    .replace(/^l /i, '')
    .replace(/^d /i, '')
    .replace(/^the /i, '')
    .replace(/^a /i, '')
    .replace(/^an /i, '')
    .trim();
};

// ref, input
export const sorensenDiceScore = (first: string, second: string) => {
  first = first.replace(/\s+/g, '');
  second = second.replace(/\s+/g, '');

  if (first === second) return 1;
  if ((first.length < 2 && second.length >= 2) || second.length > 100) return 0;

  let firstBigrams = new Map();
  let firstReverseBigrams = new Map();
  let firstAltBigrams = new Map();
  for (let i = 0; i < first.length - 1; i++) {
    const bigram = first[i] + first[i + 1];
    const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) + 1 : 1;
    firstBigrams.set(bigram, count);

    const reverseBigram = first[i + 1] + first[i];
    const reverseCount = firstReverseBigrams.has(reverseBigram) ? firstReverseBigrams.get(reverseBigram) + 1 : 1;
    firstReverseBigrams.set(reverseBigram, reverseCount);

    if (i + 2 < first.length) {
      const altBigram = first[i] + first[i + 2];
      const altCount = firstAltBigrams.has(altBigram) ? firstAltBigrams.get(altBigram) + 1 : 1;
      firstAltBigrams.set(altBigram, altCount);
    }
  }


  let intersectionSize = 0;
  const altRatio = Math.max(0.2, 1.0 - 0.05 * first.length);

  for (let i = 0; i < second.length - 1; i++) {
    const bigram = second[i] + second[i + 1];

    if (firstBigrams.has(bigram)) {
      const count = firstBigrams.get(bigram);
      if (count > 0) {
        firstBigrams.set(bigram, count - 1);
        intersectionSize++;
        continue;
      }
    }
    if (firstReverseBigrams.has(bigram)) {
      const count = firstReverseBigrams.get(bigram);
      if (count > 0) {
        firstReverseBigrams.set(bigram, count - 1);
        intersectionSize += altRatio;
        continue;
      }
    }
    if (firstAltBigrams.has(bigram)) {
      const count = firstAltBigrams.get(bigram);
      if (count > 0) {
        firstAltBigrams.set(bigram, count - 1);
        intersectionSize += altRatio;
      }
    }
  }

  return (2.0 * intersectionSize) / (first.length + second.length - 2);
};