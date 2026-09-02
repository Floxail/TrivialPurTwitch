import { useAuthStore } from 'components/store/auth-store';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const twitchToken = useAuthStore.getState().getTwitchOAuthToken();
  if (twitchToken) {
    headers['Authorization'] = `Bearer ${twitchToken}`;
  }
  return headers;
}

// ==================== Types ====================

export type LeaderboardEntry = {
  nick: string;
  twitchId: string;
  totalScore: number;
  totalAnswers: number;
  totalFirsts: number;
  totalCombos: number;
  bestFastest: number | null;
  sessions: number;
};

export type PlayerHistory = {
  sessionId: string;
  boxName: string | null;
  score: number;
  answers: number;
  firsts: number;
  combos: number;
  fastest: number | null;
  createdAt: string;
};

export type SessionSummary = {
  sessionId: string;
  boxName: string | null;
  playerCount: number;
  totalPoints: number;
  startedAt: string;
};

// ==================== API Calls ====================

/**
 * Enregistre les scores d'une session de quiz terminée.
 * Appelé en fin de quiz avec tous les joueurs ayant participé.
 *
 * Le channel (id + nom) n'est pas envoyé : le serveur le dérive du token Twitch
 * validé, pour qu'un compte ne puisse pas enregistrer sur le channel d'un autre.
 */
export async function apiRecordScores(
  players: Array<{
    tid: string;
    nick: string;
    score: number;
    stats: { answers: number; firsts: number; combos: number; fastestAnswer: number };
  }>,
  sessionId: string,
  boxName?: string
): Promise<{ inserted: number }> {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ players, sessionId, boxName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

/**
 * Récupère le classement all-time (top joueurs).
 */
export async function apiGetLeaderboard(limit: number = 50): Promise<{ leaderboard: LeaderboardEntry[] }> {
  const res = await fetch(`/api/scores?action=leaderboard&limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

/**
 * Récupère les stats et l'historique d'un joueur.
 */
export async function apiGetPlayerStats(nick: string): Promise<{
  player: LeaderboardEntry;
  history: PlayerHistory[];
}> {
  const res = await fetch(`/api/scores?action=player&nick=${encodeURIComponent(nick)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

/**
 * Récupère la liste des sessions récentes.
 */
export async function apiGetSessions(limit: number = 20): Promise<{ sessions: SessionSummary[] }> {
  const res = await fetch(`/api/scores?action=sessions&limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}
