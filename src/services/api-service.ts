/**
 * Service centralisé pour les appels API CRUD vers Vercel.
 *
 * Toutes les opérations d'écriture envoient le header x-api-key
 * stocké dans localStorage (configuré par le streamer dans les Settings).
 */

function getApiKey(): string {
  return localStorage.getItem('admin_api_key') || '';
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': getApiKey(),
  };
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
