import { useAuthStore } from 'components/store/auth-store';

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().getTwitchOAuthToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

/** Récupère l'historique de questions jouées depuis Turso */
export async function fetchHistory(): Promise<string[]> {
  const res = await fetch('/api/history', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
  const data = await res.json();
  return data.ids as string[];
}

/** Enregistre des questions jouées en Turso */
export async function recordHistory(questionIds: string[], boxName?: string): Promise<void> {
  if (questionIds.length === 0) return;
  await fetch('/api/history', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ questionIds, boxName }),
  });
}

/** Réinitialise l'historique (tout ou par boîte) */
export async function resetHistory(boxName?: string): Promise<void> {
  const url = boxName ? `/api/history?box=${encodeURIComponent(boxName)}` : '/api/history';
  await fetch(url, { method: 'DELETE', headers: getAuthHeaders() });
}
