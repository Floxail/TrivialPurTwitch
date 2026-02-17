/**
 * Service client pour soumettre des questions publiques (pending modération)
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

export interface SubmitQuestionPayload {
  question: string;
  answer: string;
  alternativeAnswers?: string[];
  category?: number;
  boxName?: string;
  questionType?: 'free_text' | 'qcm';
  qcmOptions?: string[];
  qcmCorrectIndex?: number;
  qcmCorrectIndexes?: number[];
}

export async function apiSubmitQuestion(
  payload: SubmitQuestionPayload
): Promise<{ success: boolean; id: string; message: string }> {
  const res = await fetch('/api/submit-question', {
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
