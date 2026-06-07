import { getUsers, setDefaultAuth, validateToken } from 'services/twitch-api';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Simple XOR-based obfuscation for token storage
// Note: This is obfuscation, not encryption. For true security,
// consider server-side token storage or Web Crypto API
const OBFUSCATION_KEY = 'TrvlPrTwtch2024!';

const obfuscateToken = (token: string): string => {
  let result = '';
  for (let i = 0; i < token.length; i++) {
    result += String.fromCharCode(
      token.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
    );
  }
  return btoa(result); // Base64 encode
};

const deobfuscateToken = (obfuscated: string): string => {
  try {
    const decoded = atob(obfuscated);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
      );
    }
    return result;
  } catch {
    return '';
  }
};

/**
 * Detect if a token is in the old format (plain text) vs new format (obfuscated)
 * Old tokens from Twitch start with alphanumeric characters
 * New obfuscated tokens are Base64 encoded (may contain +, /, =)
 */
const isLegacyToken = (token: string): boolean => {
  // Old Twitch tokens are alphanumeric only, typically 30 chars
  // New obfuscated tokens are Base64 and often contain non-alphanumeric chars after decoding

  // Try to decode as Base64 - if it fails or produces garbage, it's likely a legacy token
  try {
    const decoded = atob(token);
    // If decoded string has control characters or is mostly non-printable, it's obfuscated
    // eslint-disable-next-line no-control-regex
    const hasBinaryChars = /[\x00-\x1F]/.test(decoded);
    if (hasBinaryChars) {
      // This is likely an obfuscated token (XOR produces binary chars)
      return false;
    }
    // If it decodes cleanly to printable chars, check if original looks like a Twitch token
    // Twitch tokens are alphanumeric, ~30 chars
    if (/^[a-z0-9]{20,50}$/i.test(token)) {
      return true; // Legacy plain text token
    }
    return false;
  } catch {
    // If atob fails, check if it's a plain alphanumeric token
    return /^[a-z0-9]{20,50}$/i.test(token);
  }
};

/**
 * Migrate legacy tokens to new obfuscated format
 * Called once on store initialization
 */
const migrateLegacyToken = (): void => {
  try {
    const stored = localStorage.getItem('auth_data');
    if (!stored) return;

    const data = JSON.parse(stored);
    if (!data.state?.twitchOauthToken) return;

    const token = data.state.twitchOauthToken;

    if (isLegacyToken(token)) {
      console.log('[Auth] Migrating legacy token to secure format...');
      // Re-save with obfuscated token
      data.state.twitchOauthToken = obfuscateToken(token);
      // Legacy tokens don't have expiration, set a default (4 hours from now)
      data.state.tokenExpiresAt = Date.now() + (4 * 60 * 60 * 1000);
      localStorage.setItem('auth_data', JSON.stringify(data));
      console.log('[Auth] Token migration complete');
    }
  } catch (e) {
    console.error('[Auth] Token migration failed:', e);
    // If migration fails, clear the corrupted data
    localStorage.removeItem('auth_data');
  }
};

// Run migration on module load (before store initialization)
migrateLegacyToken();

export type AuthData = {
  twitchOauthToken?: string,        // Now stores obfuscated token
  tokenExpiresAt?: number,          // Timestamp when token expires
  twitchNick?: string,
  twitchAvatar?: string,
  twitchUserId?: string,            // Twitch user ID (pour vérification admin)
  isAdmin?: boolean,                // true si l'utilisateur est dans ADMIN_TWITCH_IDS
}

type Actions = {
  clear: () => void;
  deleteTwitchOAuthToken: () => void;
  setTwitchOAuthToken: (token: string, expiresIn?: number) => void;
  getTwitchOAuthToken: () => string | undefined;  // Returns deobfuscated token
  validateTwitchOAuthToken: () => void;
  setTwitchNickAndAvatar: (nick: string, avatar: string) => void;
  isLoggedIn: () => boolean;
  isTokenExpired: () => boolean;
  checkIsAdmin: () => Promise<void>;  // Vérifie le rôle admin via l'API
}

export const useAuthStore = create<AuthData & Actions>()(
  persist(
    (set, get) => ({
      clear: () => {
        set({
          twitchOauthToken: undefined,
          tokenExpiresAt: undefined,
          twitchUserId: undefined,
          isAdmin: undefined,
        });
        // Explicitly clear localStorage
        localStorage.removeItem('auth_data');
        sessionStorage.clear();
      },
      deleteTwitchOAuthToken: () => {
        set(() => ({ twitchOauthToken: undefined, tokenExpiresAt: undefined }));
        localStorage.removeItem('auth_data');
      },
      setTwitchOAuthToken: (token: string, expiresIn?: number) => {
        const obfuscated = obfuscateToken(token);
        const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : undefined;
        set(() => ({ twitchOauthToken: obfuscated, tokenExpiresAt: expiresAt }));
      },
      getTwitchOAuthToken: (): string | undefined => {
        const current = get();
        if (!current.twitchOauthToken) return undefined;

        // Check if token is expired
        if (current.tokenExpiresAt && Date.now() > current.tokenExpiresAt) {
          current.deleteTwitchOAuthToken();
          return undefined;
        }

        return deobfuscateToken(current.twitchOauthToken);
      },
      isTokenExpired: (): boolean => {
        const current = get();
        if (!current.tokenExpiresAt) return false;
        return Date.now() > current.tokenExpiresAt;
      },
      validateTwitchOAuthToken: () => {
        const current = get();
        const token = current.getTwitchOAuthToken(); // Get deobfuscated token

        if (token) {
          // Check expiration first
          if (current.isTokenExpired()) {
            current.deleteTwitchOAuthToken();
            return;
          }

          validateToken(token).then(response => {
            if (response.status !== 200) {
              current.deleteTwitchOAuthToken();
            } else {
              setDefaultAuth(token);
              response.json().then(body => {
                const userId = body['user_id'] as string;
                getUsers([userId]).then(response => {
                  set(() => ({
                    twitchNick: body['login'],
                    twitchAvatar: response.data.data[0].profile_image_url,
                    twitchUserId: userId,
                  }));
                  // Vérifier le statut admin après avoir récupéré l'userId
                  get().checkIsAdmin();
                });
              });
            }
          });
        }
      },
      setTwitchNickAndAvatar: (nick: string, avatar: string) => {
        set(() => ({ twitchNick: nick, twitchAvatar: avatar }));
      },
      checkIsAdmin: async () => {
        const token = get().getTwitchOAuthToken();
        if (!token) {
          set({ isAdmin: false });
          return;
        }
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            set({ isAdmin: data.isAdmin === true, twitchUserId: data.userId });
          } else if (res.status === 401) {
            set({ isAdmin: false });
          }
          // Erreur réseau / 500 : on ne change pas isAdmin
        } catch {
          // Erreur réseau : on ne change pas le statut
        }
      },
      isLoggedIn: (): boolean => {
        const current = get();
        return current.twitchOauthToken !== undefined;
      },
    }),
    {
      name: 'auth_data',
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => !['twitchNick'].includes(key)),
        ),
    },
  ),
);