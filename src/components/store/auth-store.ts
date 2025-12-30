import { getUsers, setDefaultAuth, validateToken } from 'services/twitch-api';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthData = {
  twitchOauthToken?: string,
  twitchNick?: string,
  twitchAvatar?: string
}

type Actions = {
  clear: () => void;
  deleteTwitchOAuthToken: () => void;
  setTwitchOAuthToken: (token: string) => void;
  validateTwitchOAuthToken: () => void;
  setTwitchNickAndAvatar: (nick: string, avatar: string) => void;
  isLoggedIn: () => boolean;
}

export const useAuthStore = create<AuthData & Actions>()(
  persist(
    (set, get) => ({
      clear: () => {
        set({
          twitchOauthToken: undefined,
        });
      },
      deleteTwitchOAuthToken: () => {
        set(() => ({ twitchOauthToken: undefined }));
      },
      setTwitchOAuthToken: (token: string) => {
        set(() => ({ twitchOauthToken: token }));
      },
      validateTwitchOAuthToken: () => {
        const current = get();
        if (current.twitchOauthToken) {
          validateToken(current.twitchOauthToken).then(response => {
            if (response.status !== 200) {
              current.deleteTwitchOAuthToken();
            } else {
              setDefaultAuth(current.twitchOauthToken || '');
              response.json().then(body => {
                getUsers([body['user_id']]).then(response => {
                  set(() => ({ twitchNick: body['login'], twitchAvatar: response.data.data[0].profile_image_url }));
                });
              });
            }
          });
        }
      },
      setTwitchNickAndAvatar: (nick: string, avatar: string) => {
        set(() => ({ twitchNick: nick, twitchAvatar: avatar }));
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