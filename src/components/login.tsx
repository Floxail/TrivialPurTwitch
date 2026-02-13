import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { getAppHomeURL } from '../helpers';
import { useAuthStore } from './store/auth-store';
import { useGlobalStore } from './store/global-store';

const Login = () => {

  const globalStore = useGlobalStore();
  const authStore = useAuthStore();

  useEffect(() => {
    globalStore.setSubtitle('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const twitchLogin = async () => {
    // Store state for CSRF protection
    const state = crypto.randomUUID();
    sessionStorage.setItem('oauth_state', state);

    // Implicit Flow - supported by Twitch for client-side apps
    // Note: Authorization Code Flow with PKCE requires a backend with client_secret
    window.location.href = 'https://id.twitch.tv/oauth2/authorize' +
      '?client_id=' + process.env.REACT_APP_TWITCH_CLIENT_ID +
      '&redirect_uri=' + encodeURIComponent(getAppHomeURL() + '/callback') +
      '&scope=chat:read+chat:edit+whispers:edit' +
      '&force_verify=true' +
      '&response_type=token' +  // Implicit Flow (client-side)
      '&state=' + state;
  };

  const twitchIcon = <FontAwesomeIcon icon={['fab', 'twitch']} color="#6441A4" />;

  type LoginButtonProps = {
    loggedIn: boolean;
    appName: string;
    onClick: () => Promise<void>;
    icon: React.JSX.Element;
  };

  const LoginButton = (props: LoginButtonProps) => {
    return (
      <Button 
        id={props.appName + 'LoginButton'} 
        disabled={props.loggedIn} 
        style={{ display: 'block', margin: '5px auto', width: '20rem' }} 
        variant={props.loggedIn ? 'outline-success' : 'secondary'} 
        size="lg" 
        onClick={props.onClick}
      >
        <>
          {!props.loggedIn && <>Log in {props.appName}</>}
          {props.loggedIn && <><FontAwesomeIcon icon={['far', 'check-circle']} /> Logged in {props.appName}</>}
          &nbsp;{props.icon}
        </>
      </Button>
    );
  };

  return (
    <>
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>🎲 QuizTwitch</h2>
        <p className="text-muted">Connectez-vous avec Twitch pour commencer</p>
      </div>
      <LoginButton 
        loggedIn={authStore.isLoggedIn()} 
        appName="Twitch" 
        onClick={twitchLogin} 
        icon={twitchIcon}
      />
    </>
  );
};

export default Login;