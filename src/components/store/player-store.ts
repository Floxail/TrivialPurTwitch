import { getUsers } from 'services/twitch-api';
import { create } from 'zustand';

const localStorageKey: string = 'blind_test_players_v2';

export type PlayerStats = {
  answers: number;
  firsts: number;
  combos: number;
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

  // <--- MODIF : Cette fonction devient obsolète car le calcul se fait dans le store maintenant
  // Mais on la garde pour éviter de casser d'autres fichiers si besoin
  getPoints = () => {
    return 1 + (this.isFirst ? 1 : 0) + (this.isCombo ? 1 : 0);
  };
}

export const EMPTY_PLAYER_STATS: PlayerStats = {
  answers: 0,
  firsts: 0,
  combos: 0,
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

export class Players {
  players: Record<string, Player> = {};
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
}

const recomputeRanks = (players: Record<string, Player>) => {
  const flat = Object.values(players);
  flat.sort((a, b) => b.score - a.score);
  let lastRankGroup = 1;
  for (let i = 0; i < flat.length; i++) {
    if (i === 0 || flat[i].score !== flat[i - 1].score) {
      lastRankGroup = i + 1;
    }
    flat[i].rank = lastRankGroup;
  }
};

let avatarFetchTimeout: NodeJS.Timeout | undefined = undefined;
const avatarFetchTimeoutDuration: number = 2500;

const restoredState: Players = JSON.parse(localStorage.getItem(localStorageKey) || '{}');

export const usePlayerStore = create<Players & Actions>()(
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
        const updated = state.players;
        for (const nick of Object.keys(updated)) {
          if (players[nick]) {
            updated[nick].score = players[nick].score;
            updated[nick].stats = players[nick].stats;
            updated[nick].currentStreak = players[nick].currentStreak || 0; // <--- MODIF
          } else {
            updated[nick].score = 0;
            updated[nick].stats = { ...EMPTY_PLAYER_STATS };
            updated[nick].currentStreak = 0; // <--- MODIF
          }
        }
        return ({ players: updated });
      });
    },
    initPlayer: (nick: string, tid: string) => {
      const downloadAvatar = (current: Record<string, Player>) => {
        const ids = Object.entries(current).filter(([_, value]) => value.tid && !value.avatar).map(([_, value]) => value.tid).slice(0, 100);
        if (ids.length > 0) {
          getUsers(ids).then((response) => {
            set((state) => {
              const updated = state.players;
              for (let u of response.data.data) {
                const nick = u.display_name;
                if(updated[nick]) updated[nick].avatar = u.profile_image_url;
              }
              return ({ players: updated });
            });
          });
        }
      };

      if (!get().players[nick]) {
        set((state) => {
          const updated = state.players;
          // <--- MODIF : Initialisation de currentStreak à 0
          updated[nick] = { tid: tid, rank: -1, score: 0, nick: nick, currentStreak: 0, stats: { ...EMPTY_PLAYER_STATS } };

          if (avatarFetchTimeout === undefined) {
            downloadAvatar(updated);
            avatarFetchTimeout = setTimeout(() => {
              avatarFetchTimeout = undefined;
              downloadAvatar(get().players);
            }, avatarFetchTimeoutDuration);
          }

          recomputeRanks(updated);
          return ({ players: updated });
        });
      }
    },
    addPoints: (nick: string, points: number) => {
      set((state) => {
        const updated = state.players;
        if(updated[nick]) {
            updated[nick].score += points;
            recomputeRanks(updated);
        }
        return ({ players: updated });
      });
    },

    // <--- C'EST ICI QUE TOUT CHANGE
    recordAnswers: (answers: Answer[]) => {
      set((state) => {
        const updated = state.players;

        // 1. Liste des pseudos qui ont répondu juste à ce tour
        const winnerNicks = new Set(answers.map(a => a.nick));

        // 2. On remet à zéro le streak de TOUS ceux qui ne sont pas dans la liste des gagnants
        Object.values(updated).forEach(player => {
            if (!winnerNicks.has(player.nick)) {
                player.currentStreak = 0;
            }
        });

        // 3. On traite les gagnants
        for (const answer of answers) {
          const player = updated[answer.nick];
          if (!player) continue;

          // Augmenter la série
          player.currentStreak = (player.currentStreak || 0) + 1;

          // Calcul des points
          let scoreToAdd = 1; // Point de base pour la bonne réponse

          // Bonus First
          if (answer.isFirst) {
              player.stats.firsts++;
              scoreToAdd += 1;
          }

          // Bonus Combo Progressif
          // Si streak = 2 (2ème bonne réponse d'affilée), bonus = +1
          // Si streak = 5 (5ème bonne réponse d'affilée), bonus = +4
          if (player.currentStreak > 1) {
              player.stats.combos++; // Incrémente le compteur total de combos
              const comboBonus = player.currentStreak - 1; // Le bonus progressif
              scoreToAdd += comboBonus;
          }

          // Mise à jour des stats et du score
          player.stats.answers++;
          player.stats.fastestAnswer = Math.min(player.stats.fastestAnswer, answer.timer);
          player.score += scoreToAdd;
        }

        recomputeRanks(updated);
        return ({ players: updated });
      });
    },
    getPlayers: (nicks: string[]) => {
      const players = get().players;
      return nicks.map((nick: string) => players[nick]).filter(player => player !== undefined);
    },
    getDeepCopy: () => {
      return JSON.parse(JSON.stringify(get().players));
    },
  }),
);