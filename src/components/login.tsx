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
  }, []);

  const twitchLogin = async () => {
    window.location.href = 'https://id.twitch.tv/oauth2/authorize' +
      '?client_id=' + process.env.REACT_APP_TWITCH_CLIENT_ID +
      '&redirect_uri=' + getAppHomeURL() + '/callback' +
      '&scope=chat:read+chat:edit+whispers:edit' +
      '&force_verify=true' +
      '&response_type=token';
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
        loggedIn={authStore.twitchOauthToken !== undefined} 
        appName="Twitch" 
        onClick={twitchLogin} 
        icon={twitchIcon}
      />
    </>
  );
};

export default Login;