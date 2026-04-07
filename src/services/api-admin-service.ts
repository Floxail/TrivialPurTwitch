/**
 * Service client pour les endpoints admin (modération des questions proposées)
 *
 * Utilise le token Twitch de l'utilisateur connecté comme authentification
 * (vérifié côté serveur via requireAdminAuth + ADMIN_TWITCH_IDS)
 */

import { useAuthStore } from 'components/store/auth-store';

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().getTwitchOAuthToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

// ==================== Types ====================

export type PendingQuestion = {
  id: string;
  question: string;
  answer: string;
  alternativeAnswers?: string[];
  category?: number;
  boxName?: string;
  questionType: string;
  qcmOptions?: string[];
  qcmCorrectIndex?: number;
  qcmCorrectIndexes?: number[];
  submittedBy?: string;
  submittedById?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
};

// ==================== API Calls ====================

/**
 * Récupère la liste des questions en attente de modération
 */
export async function apiGetPendingQuestions(
  status: string = 'pending',
  limit: number = 50
): Promise<{ questions: PendingQuestion[]; total: number }> {
  const res = await fetch(`/api/admin/questions-review?status=${status}&limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Réponse invalide du serveur (non-JSON). L'API est-elle disponible ?`);
  }
}

/**
 * Approuve une question (la déplace dans la table principale)
 */
export async function apiApproveQuestion(
  id: string,
  boxName?: string
): Promise<{ success: boolean; id: string; boxName: string }> {
  const res = await fetch('/api/admin/questions-review', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id, boxName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Réponse invalide du serveur (non-JSON)`);
  }
}

/**
 * Rejette une question
 */
export async function apiRejectQuestion(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/admin/questions-review?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Réponse invalide du serveur (non-JSON)`);
  }
}

/**
 * Modifie une question en attente avant approbation
 */
export async function apiEditPendingQuestion(
  id: string,
  updates: Partial<PendingQuestion>
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/admin/questions-review?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Réponse invalide du serveur (non-JSON)`);
  }
}
