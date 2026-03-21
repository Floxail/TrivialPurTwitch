// ==================== Types ====================

export type GlobalStats = {
  totalSessions: number;
  totalPlayers: number;
  totalQuestionsInDB: number;
  totalQuestionsAnswered: number;
  channels: ChannelStats[];
  hardestQuestions: QuestionStat[];
  easiestQuestions: QuestionStat[];
};

export type ChannelStats = {
  channelName: string;
  channelId: string | null;
  quizCount: number;
  playerCount: number;
  firstQuiz: string;
  lastQuiz: string;
};

export type QuestionStat = {
  questionId: string;
  questionText: string;
  timesAsked: number;
  timesCorrect: number;
  timesWrong: number;
  successRate: number;
};

export type PlayerFullStats = {
  player: {
    nick: string;
    twitchId: string;
    totalScore: number;
    totalAnswers: number;
    totalFirsts: number;
    totalCombos: number;
    bestFastest: number | null;
    bestScore: number;
    avgScore: number;
    sessions: number;
    firstGame: string;
    lastGame: string;
    questionsSubmitted: number;
  };
  bestSession: {
    sessionId: string;
    boxName: string | null;
    score: number;
    answers: number;
    firsts: number;
    combos: number;
    fastest: number | null;
    channelName: string | null;
    createdAt: string;
  } | null;
  byBox: {
    boxName: string;
    games: number;
    totalScore: number;
    totalAnswers: number;
    avgScore: number;
  }[];
  streams: {
    channelName: string;
    channelId: string | null;
    sessions: number;
    totalScore: number;
    firstPlayed: string;
    lastPlayed: string;
  }[];
};

// ==================== API Calls ====================

export async function apiGetGlobalStats(): Promise<GlobalStats> {
  const res = await fetch('/api/stats?action=global');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export async function apiGetPlayerFullStats(nick: string): Promise<PlayerFullStats> {
  const res = await fetch(`/api/stats?action=player&nick=${encodeURIComponent(nick)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}
