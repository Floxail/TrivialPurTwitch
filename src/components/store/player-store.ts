import { apiRecordScores } from 'services/api-scores-service';
import { getUsers } from 'services/twitch-api';
import { create } from 'zustand';

const localStorageKey: string = 'blind_test_players_v2';

export type PlayerStats = {
  answers: number;
  firsts: number;
  combos: number;
  maxCombo: number;
  fastestAnswer: number;
}

export class Answer {
  nick: string;
  isFirst: boolean;
  isCombo: boolean;
  timer: number;

  constructor(nick: string, isFirst: boolean, isCombo: boolean, timer: number) {
    this.nick = nick;
    this.isFirst = isFirst;
    this.isCombo = isCombo;
    this.timer = timer;
  }
}

export const EMPTY_PLAYER_STATS: PlayerStats = {
  answers: 0,
  firsts: 0,
  combos: 0,
  maxCombo: 0,
  fastestAnswer: Infinity,
};

export type Player = {
  tid: string;
  nick: string;
  score: number;
  rank: number;
  currentStreak: number; // <--- MODIF : Ajout du suivi de la série
  stats: PlayerStats;
  avatar?: string;
}

type PlayersState = {
  players: Record<string, Player>;
}

type Actions = {
  backup: () => void;
  clear: () => void;
  restorePlayers: (players: Record<string, Player>) => void;
  initPlayer: (nick: string, tid: string) => void;
  addPoints: (nick: string, points: number) => void;
  recordAnswers: (answers: Answer[]) => void;
  getPlayers: (nicks: string[]) => Player[];
  getDeepCopy: () => Record<string, Player>;
  syncScoresToAPI: (sessionId: string, boxName?: string, channelName?: string, channelId?: string) => Promise<void>;
}

const recomputeRanks = (players: Record<string, Player>): Record<string, Player> => {
  const flat = Object.values(players).slice().sort((a, b) => b.score - a.score);
  const result: Record<string, Player> = {};
  let lastRankGroup = 1;
  for (let i = 0; i < flat.length; i++) {
    if (i === 0 || flat[i].score !== flat[i - 1].score) {
      lastRankGroup = i + 1;
    }
    result[flat[i].nick] = { ...flat[i], rank: lastRankGroup };
  }
  return result;
};

let avatarFetchTimeout: NodeJS.Timeout | undefined = undefined;
const avatarFetchTimeoutDuration: number = 2500;

const restoredState: PlayersState = (() => {
  try {
    return JSON.parse(localStorage.getItem(localStorageKey) || '{}');
  } catch {
    return {};
  }
})();

export const usePlayerStore = create<PlayersState & Actions>()(
  (set, get) => ({
    players: restoredState.players || {},
    backup: () => {
      const current = get();
      const backedUp = {
        players: current.players,
      };
      localStorage.setItem(localStorageKey, JSON.stringify(backedUp));
    },
    clear: () => {
      localStorage.removeItem(localStorageKey);
      set({ players: {} });
    },
    restorePlayers: (players: Record<string, Player>) => {
      set((state) => {
        const updated: Record<string, Player> = {};
        for (const nick of Object.keys(state.players)) {
          const base = state.players[nick];
          if (players[nick]) {
            updated[nick] = {
              ...base,
              score: players[nick].score,
              stats: players[nick].stats,
              currentStreak: players[nick].currentStreak || 0,
            };
          } else {
            updated[nick] = {
              ...base,
              score: 0,
              stats: { ...EMPTY_PLAYER_STATS },
              currentStreak: 0,
            };
          }
        }
        return { players: updated };
      });
    },
    initPlayer: (nick: string, tid: string) => {
      const downloadAvatar = (current: Record<string, Player>) => {
        const ids = Object.entries(current).filter(([_, value]) => value.tid && !value.avatar).map(([_, value]) => value.tid).slice(0, 100);
        if (ids.length > 0) {
          getUsers(ids).then((response) => {
            set((state) => {
              const updated = { ...state.players };
              for (let u of response.data.data) {
                const nick = u.display_name;
                if (updated[nick]) {
                  updated[nick] = { ...updated[nick], avatar: u.profile_image_url };
                }
              }
              return { players: updated };
            });
          });
        }
      };

      if (!get().players[nick]) {
        set((state) => {
          const updated = {
            ...state.players,
            [nick]: { tid, rank: -1, score: 0, nick, currentStreak: 0, stats: { ...EMPTY_PLAYER_STATS } },
          };

          if (avatarFetchTimeout === undefined) {
            downloadAvatar(updated);
            avatarFetchTimeout = setTimeout(() => {
              avatarFetchTimeout = undefined;
              downloadAvatar(get().players);
            }, avatarFetchTimeoutDuration);
          }

          return { players: recomputeRanks(updated) };
        });
      }
    },
    addPoints: (nick: string, points: number) => {
      set((state) => {
        if (!state.players[nick]) return state;
        const updated = {
          ...state.players,
          [nick]: { ...state.players[nick], score: state.players[nick].score + points },
        };
        return { players: recomputeRanks(updated) };
      });
    },

    // COMBO PLAFONNÉ À +5
    recordAnswers: (answers: Answer[]) => {
      set((state) => {
        const winnerNicks = new Set(answers.map(a => a.nick));
        const updated: Record<string, Player> = {};

        // 1+2. Spread tous les joueurs, reset streak des non-gagnants
        for (const nick of Object.keys(state.players)) {
          const p = state.players[nick];
          updated[nick] = winnerNicks.has(nick)
            ? { ...p, stats: { ...p.stats } }
            : { ...p, currentStreak: 0, stats: { ...p.stats } };
        }

        // 3. Traiter gagnants (sur copies)
        for (const answer of answers) {
          const player = updated[answer.nick];
          if (!player) continue;

          player.currentStreak = (player.currentStreak || 0) + 1;
          let scoreToAdd = 1;

          if (answer.isFirst) {
            player.stats.firsts++;
            scoreToAdd += 2;
          }

          if (answers.length === 1) scoreToAdd += 1;

          if (player.currentStreak > 1) {
            player.stats.combos++;
            player.stats.maxCombo = Math.max(player.stats.maxCombo || 0, player.currentStreak);
            const comboBonus = Math.min(player.currentStreak - 1, 3);
            scoreToAdd += comboBonus;
          }

          player.stats.answers++;
          player.stats.fastestAnswer = Math.min(player.stats.fastestAnswer, answer.timer);
          player.score += scoreToAdd;
        }

        return { players: recomputeRanks(updated) };
      });
    },
    getPlayers: (nicks: string[]) => {
      const players = get().players;
      return nicks.map((nick: string) => players[nick]).filter(player => player !== undefined);
    },
    getDeepCopy: () => {
      return JSON.parse(JSON.stringify(get().players));
    },
    syncScoresToAPI: async (sessionId: string, boxName?: string, channelName?: string, channelId?: string) => {
      const players = get().players;
      const activePlayers = Object.values(players).filter(p => p.score > 0 || p.stats.answers > 0);

      if (activePlayers.length === 0) {
        console.log('⚠️ Aucun joueur actif à synchroniser');
        return;
      }

      try {
        const result = await apiRecordScores(activePlayers, sessionId, boxName, channelName, channelId);
        console.log(`✅ Scores synchronisés : ${result.inserted} joueurs envoyés (session: ${sessionId})`);
      } catch (err) {
        console.warn('⚠️ Échec sync scores API, scores conservés localement', err);
      }
    },
  }),
);