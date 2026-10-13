/**
 * Liaison de comptes (Twitch, Discord, Google). Le cookie de session part tout seul
 * (même origine) ; le jeton Twitch est ajouté quand il existe.
 */
import { useAuthStore } from 'components/store/auth-store';

function authHeaders(): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const token = useAuthStore.getState().getTwitchOAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function post(action: string, body?: { providerId: string }): Promise<Response> {
  return fetch(`/api/auth/${action}`, { method: 'POST', headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
}

export async function apiLinkStart(): Promise<void> {
  const res = await post('link-start');
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
}

export async function apiLinkTwitch(): Promise<'linked' | 'already_linked'> {
  const res = await post('link-twitch');
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const body: { result: 'linked' | 'already_linked' } = await res.json();
  return body.result;
}

export async function apiUnlink(providerId: string): Promise<'unlinked' | 'forbidden'> {
  const res = await post('unlink', { providerId });
  if (res.status === 403) return 'forbidden';
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return 'unlinked';
}
