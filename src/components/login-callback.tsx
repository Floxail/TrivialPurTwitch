import { getHashParam, getQueryParam } from 'helpers';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/auth-store';

const LoginCallback = () => {

  const authStore = useAuthStore();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Implicit Flow: token comes in URL hash fragment
      const accessToken = getHashParam('access_token');
      const state = getHashParam('state');
      const errorParam = getQueryParam('error') || getHashParam('error');

      // Check for OAuth errors
      if (errorParam) {
        setError(`Erreur d'authentification: ${errorParam}`);
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      // Verify state to prevent CSRF attacks
      const savedState = sessionStorage.getItem('oauth_state');
      if (state !== savedState) {
        setError('Erreur de sécurité: état invalide');
        sessionStorage.removeItem('oauth_state');
        setTimeout(() => navigate('/'), 3000);
        return;
      }
      sessionStorage.removeItem('oauth_state');

      if (accessToken) {
        // Store token with obfuscation (handled by auth-store)
        // Twitch implicit flow tokens expire in ~4 hours
        authStore.setTwitchOAuthToken(accessToken, 4 * 60 * 60);
      }

      navigate('/');
    };

    handleCallback();
  }, [navigate, authStore]);

  if (error) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', color: '#ff6b6b' }}>
        <p>{error}</p>
        <p>Redirection...</p>
      </div>
    );
  }

  return (
    <div className="spinner"></div>
  );
};

export default LoginCallback;