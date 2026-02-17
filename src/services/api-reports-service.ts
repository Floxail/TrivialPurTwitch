/**
 * Service client pour les signalements de questions
 * Utilise le token Twitch de l'utilisateur connecté
 */

import { useAuthStore } from 'components/store/auth-store';

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().getTwitchOAuthToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

function getAdminHeaders(): Record<string, string> {
  const token = useAuthStore.getState().getTwitchOAuthToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

export type ReportReason =
  | 'question_incorrecte'
  | 'reponse_non_accpeter'
  | 'categorie_incorrecte'
  | 'question_obsolete';

export interface QuestionReport {
  id: string;
  questionId: string;
  questionText: string;
  reason: ReportReason;
  reportedBy: string;
  reportedById: string;
  status: 'pending' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
}

/** Créer un signalement (utilisateur connecté) */
export async function apiCreateReport(payload: {
  questionId: string;
  questionText: string;
  reason: ReportReason;
}): Promise<{ success: boolean; id: string }> {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

/** Lister les signalements (admin) */
export async function apiGetReports(
  status: 'pending' | 'resolved' = 'pending'
): Promise<QuestionReport[]> {
  const res = await fetch(`/api/reports?status=${status}`, {
    headers: getAdminHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

/** Marquer un signalement comme traité (admin) */
export async function apiResolveReport(reportId: string): Promise<{ success: boolean }> {
  const res = await fetch('/api/reports', {
    method: 'PUT',
    headers: getAdminHeaders(),
    body: JSON.stringify({ reportId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

/** Supprimer un signalement (admin) */
export async function apiDeleteReport(reportId: string): Promise<{ success: boolean }> {
  const res = await fetch('/api/reports', {
    method: 'DELETE',
    headers: getAdminHeaders(),
    body: JSON.stringify({ reportId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}
