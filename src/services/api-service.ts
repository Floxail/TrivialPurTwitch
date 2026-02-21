/**
 * Service centralisé pour les appels API CRUD vers Vercel.
 *
 * Auth par ordre de priorité :
 *  1. Token Twitch admin (Bearer) — si l'utilisateur est connecté et admin
 *  2. Clé API admin (x-api-key) — configurée dans les Settings
 * Les deux sont envoyés simultanément ; le serveur accepte l'un ou l'autre.
 */

import { useAuthStore } from 'components/store/auth-store';

function getApiKey(): string {
  return localStorage.getItem('admin_api_key') || '';
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': getApiKey(),
  };
  // Inclure aussi le token Twitch si disponible (auth admin alternative)
  const twitchToken = useAuthStore.getState().getTwitchOAuthToken();
  if (twitchToken) {
    headers['Authorization'] = `Bearer ${twitchToken}`;
  }
  return headers;
}

// ==================== QUESTIONS ====================

export async function apiCreateQuestion(question: any): Promise<boolean> {
  const res = await fetch('/api/questions', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(question),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return true;
}

export async function apiUpdateQuestion(id: string, updates: any): Promise<boolean> {
  const res = await fetch(`/api/questions?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return true;
}

export async function apiDeleteQuestion(id: string): Promise<boolean> {
  const res = await fetch(`/api/questions?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return true;
}

export async function apiBulkAddQuestions(questions: any[]): Promise<{ count: number }> {
  const res = await fetch('/api/questions-bulk', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ questions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export async function apiImportQuestions(data: { boxes?: any[]; questions: any[] }): Promise<{
  boxesInserted: number;
  questionsInserted: number;
}> {
  const res = await fetch('/api/questions-import', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

// ==================== BOXES ====================

export async function apiCreateBox(name: string): Promise<boolean> {
  const res = await fetch('/api/boxes', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return true;
}

export async function apiDeleteBox(name: string): Promise<boolean> {
  const res = await fetch(`/api/boxes?name=${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return true;
}

export async function apiRenameBox(oldName: string, newName: string): Promise<boolean> {
  const res = await fetch('/api/boxes', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ oldName, newName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return true;
}
