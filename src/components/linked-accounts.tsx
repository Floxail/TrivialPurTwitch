import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { LINK_TWITCH_KEY, providerLoginUrl, startTwitchLogin, type LoginProvider } from '../helpers';
import { apiLinkStart, apiLinkTwitch, apiUnlink } from '../services/api-auth-service';
import { useAuthStore, type AccountProvider, type LinkedAccount } from './store/auth-store';

const LINK_MESSAGES = new Map([
  ['linked', 'Compte lié.'],
  ['already_linked', 'Ce compte est déjà lié à une autre identité.'],
  ['expired', 'Liaison expirée, recommence.'],
  ['failed', 'Liaison annulée ou impossible.'],
]);

const PROVIDERS: { provider: AccountProvider; label: string; color: string }[] = [
  { provider: 'twitch', label: 'Twitch', color: '#6441A4' },
  { provider: 'discord', label: 'Discord', color: '#5865F2' },
  { provider: 'google', label: 'Google', color: '#EA4335' },
];

/** Paramètres → comptes liés : Twitch, Discord et Google d'une même personne = une identité. */
const LinkedAccounts = () => {
  const account = useAuthStore(s => s.account);
  const loadAccount = useAuthStore(s => s.loadAccount);
  const [message, setMessage] = useState(() => LINK_MESSAGES.get(new URLSearchParams(window.location.search).get('link') ?? '') ?? '');

  useEffect(() => {
    // Retour d'une connexion Twitch lancée depuis cette page : on termine la liaison
    const pending = sessionStorage.getItem(LINK_TWITCH_KEY) !== null && useAuthStore.getState().hasTwitch();
    sessionStorage.removeItem(LINK_TWITCH_KEY);
    const linking = pending
      ? apiLinkTwitch().then(result => setMessage(LINK_MESSAGES.get(result) ?? '')).catch(() => setMessage('Liaison impossible.'))
      : Promise.resolve();
    linking.then(() => loadAccount());
  }, [loadAccount]);

  if (!account) return null;

  const accounts: LinkedAccount[] = account.links.length > 0
    ? account.links
    : [{ providerId: account.providerId, provider: account.provider, name: account.login }];
  const linkedProviders = new Set(accounts.map(a => a.provider));

  const link = async (provider: AccountProvider) => {
    if (provider === 'twitch') {
      sessionStorage.setItem(LINK_TWITCH_KEY, '1');
      startTwitchLogin('/settings');
      return;
    }
    const target: LoginProvider = provider;
    try {
      await apiLinkStart();
      window.location.href = providerLoginUrl(target, '/settings', true);
    } catch {
      setMessage('Liaison impossible.');
    }
  };

  const unlink = async (providerId: string) => {
    const result = await apiUnlink(providerId).catch(() => 'forbidden' as const);
    setMessage(result === 'unlinked' ? 'Compte délié.' : 'Impossible de délier ce compte.');
    loadAccount();
  };

  return (
    <div className="mb-3">
      <h3>Comptes liés</h3>
      {message && <p style={{ color: 'var(--lumon-cyan)' }}>{message}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {accounts.map(a => {
          const meta = PROVIDERS.find(p => p.provider === a.provider);
          const locked = a.providerId === account.userId || a.providerId === account.providerId;
          return (
            <li key={a.providerId} style={{ marginBottom: '0.5rem' }}>
              <FontAwesomeIcon icon={['fab', a.provider]} color={meta?.color} /> {a.name}
              {!locked && (
                <button className="terminal-btn" style={{ marginLeft: '1rem', fontSize: '0.75rem' }} onClick={() => unlink(a.providerId)}>Délier</button>
              )}
            </li>
          );
        })}
      </ul>
      {PROVIDERS.filter(p => !linkedProviders.has(p.provider)).map(p => (
        <button key={p.provider} className="terminal-btn" style={{ marginRight: '0.5rem' }} onClick={() => link(p.provider)}>
          Lier {p.label} <FontAwesomeIcon icon={['fab', p.provider]} color={p.color} />
        </button>
      ))}
    </div>
  );
};

export default LinkedAccounts;
