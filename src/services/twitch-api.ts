import axios from 'axios';

const instance = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setDefaultAuth = (accessToken: string) => {
  instance.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  instance.defaults.headers.common['Client-Id'] = process.env.REACT_APP_TWITCH_CLIENT_ID || '';
};

export const validateToken = (token: string) => {
  const headers = { 'Authorization': `Bearer ${token}` };
  return fetch('https://id.twitch.tv/oauth2/validate', { headers });
};

export const getUsers = (ids: string[]) => {
  return instance.get(`https://api.twitch.tv/helix/users?${ids.map(id => `id=${id}`).join('&')}`);
};

/**
 * Récupère les VODs (archives) d'une chaîne Twitch.
 * Retourne les 20 VODs les plus récentes.
 */
export const getChannelVideos = (channelId: string) => {
  return instance.get(`https://api.twitch.tv/helix/videos?user_id=${channelId}&type=archive&first=20`);
};

/**
 * Trouve l'URL de la VOD qui correspond à une date de quiz donnée.
 * Compare created_at du quiz avec la période de chaque VOD (start → start + duration).
 */
export function findVodForDate(videos: TwitchVideo[], quizDate: string): string | null {
  // SQLite datetime('now') retourne "YYYY-MM-DD HH:MM:SS" en UTC mais sans suffixe Z
  // On ajoute le Z si absent pour que JS le parse correctement en UTC
  const normalizedDate = quizDate.includes('T') || quizDate.includes('Z') ? quizDate : quizDate + 'Z';
  const quizTime = new Date(normalizedDate).getTime();
  if (isNaN(quizTime)) return null;

  for (const vod of videos) {
    const vodStart = new Date(vod.created_at).getTime();
    const vodEnd = vodStart + parseDuration(vod.duration);
    // Marge de 30min avant/après pour les imprécisions
    if (quizTime >= vodStart - 30 * 60000 && quizTime <= vodEnd + 30 * 60000) {
      // Calculer le timestamp dans la VOD
      const offsetSeconds = Math.max(0, Math.floor((quizTime - vodStart) / 1000));
      const h = Math.floor(offsetSeconds / 3600);
      const m = Math.floor((offsetSeconds % 3600) / 60);
      const s = offsetSeconds % 60;
      return `https://www.twitch.tv/videos/${vod.id}?t=${h}h${m}m${s}s`;
    }
  }
  return null;
}

export type TwitchVideo = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  duration: string; // format: "3h24m15s"
  url: string;
};

/** Parse une durée Twitch "3h24m15s" en millisecondes */
function parseDuration(duration: string): number {
  const match = duration.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return (h * 3600 + m * 60 + s) * 1000;
}