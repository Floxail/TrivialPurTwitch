import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const themeNames = ['dark', 'light'];

export enum TwitchMode {
  Disabled = 0,
  Channel = 1,
  Whisper = 2
}

type SettingsData = {
  addEveryUser: boolean;
  chatNotifications: boolean;
  previewGuessNumber: boolean;
  acceptanceDelay: number;
  questionTimeLimit: number;
  scoreCommandMode: TwitchMode;
}

type ExtraSettingsData = {
  theme: number;
}

type Actions = {
  isInitialized: () => boolean;
  reset: () => void;
  update: (data: SettingsData) => void;
  toggleTheme: () => void;
}

const initialState: SettingsData & ExtraSettingsData = {
  addEveryUser: true,
  chatNotifications: true,
  previewGuessNumber: false,
  acceptanceDelay: 5,
  questionTimeLimit: 30,
  scoreCommandMode: TwitchMode.Channel,
  theme: 0,
};

const setTheme = (theme: number) => {
  document.documentElement.setAttribute('data-bs-theme', themeNames[theme]);
};

export const useSettingsStore = create<SettingsData & ExtraSettingsData & Actions>()(
  persist(
    (set, get) => ({
      ...initialState,
      isInitialized: () => { return true; },
      reset: () => set(initialState),
      update: (data: SettingsData) => set(data),
      toggleTheme: () => {
        set((state) => {
          const newTheme = 1 - state.theme;
          setTheme(newTheme);
          return ({ theme: newTheme });
        });
      },
    }),
    {
      name: 'settings_storage',
      onRehydrateStorage: () => {
        return (state, error) => {
          if (!error && state) {
            setTheme(state.theme);
          }
        };
      },
    },
  ),
);
