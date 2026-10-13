import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { startProviderLogin, startTwitchLogin } from '../helpers';
import { useAuthStore } from './store/auth-store';
import { useGlobalStore } from './store/global-store';

const Login = () => {

  const setSubtitle = useGlobalStore(s => s.setSubtitle);
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);

  useEffect(() => {
    setSubtitle('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const twitchLogin = async () => startTwitchLogin();

  const twitchIcon = <FontAwesomeIcon icon={['fab', 'twitch']} color="#6441A4" />;
  const discordIcon = <FontAwesomeIcon icon={['fab', 'discord']} color="#5865F2" />;
  const googleIcon = <FontAwesomeIcon icon={['fab', 'google']} color="#EA4335" />;
  // Seules les valeurs connues sont affichées : le paramètre vient de l'URL
  const failedProvider = ['discord', 'google'].find(p => p === new URLSearchParams(window.location.search).get('login_error'));

  type LoginButtonProps = {
    loggedIn: boolean;
    appName: string;
    onClick: () => Promise<void>;
    icon: React.JSX.Element;
  };

  const LoginButton = (props: LoginButtonProps) => {
    return (
      <button
        id={props.appName + 'LoginButton'}
        disabled={props.loggedIn}
        className={`terminal-btn ${props.loggedIn ? 'terminal-btn-success' : ''}`}
        style={{ display: 'block', margin: '5px auto', width: '20rem', fontSize: '0.9rem', padding: '0.75rem 1.5rem' }}
        onClick={() => props.onClick()}
      >
        {!props.loggedIn && <>Log in {props.appName}</>}
        {props.loggedIn && <><FontAwesomeIcon icon={['far', 'check-circle']} /> Logged in {props.appName}</>}
        &nbsp;{props.icon}
      </button>
    );
  };

  return (
    <>
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2 className="text-glow-cyan" style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.15em' }}>QUIZTWITCH</h2>
        <p style={{ color: 'var(--lumon-text-dim)', fontFamily: "'Share Tech Mono', monospace", marginTop: '1rem' }}>Connecte-toi pour commencer</p>
      </div>
      {failedProvider && (
        <p className="text-glow-danger" style={{ textAlign: 'center' }}>Connexion {failedProvider} impossible. Réessaie.</p>
      )}
      <LoginButton loggedIn={isLoggedIn()} appName="Twitch" onClick={twitchLogin} icon={twitchIcon} />
      <p style={{ textAlign: 'center', color: 'var(--lumon-text-dim)', fontSize: '0.8rem', margin: '0 0 1rem' }}>
        Twitch est requis pour animer un quiz.
      </p>
      <LoginButton loggedIn={false} appName="Discord" onClick={async () => startProviderLogin('discord')} icon={discordIcon} />
      <LoginButton loggedIn={false} appName="Google" onClick={async () => startProviderLogin('google')} icon={googleIcon} />
      <p className="legal-footer" style={{ textAlign: 'center', borderTop: 'none' }}>
        <Link to="/cgu">Conditions d'utilisation</Link> · <Link to="/confidentialite">Politique de confidentialité</Link>
      </p>
    </>
  );
};

export default Login;