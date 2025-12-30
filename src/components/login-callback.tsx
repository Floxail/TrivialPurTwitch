import { getHashParam } from 'helpers';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/auth-store';

const LoginCallback = () => {

  const authStore = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const twitchToken = getHashParam('access_token');

    if (twitchToken) { 
      // Twitch logging callback
      authStore.setTwitchOAuthToken(twitchToken);
    }
    
    navigate('/');
  }, [navigate]);

  return (
    <div className="spinner"></div>
  );
};

export default LoginCallback;