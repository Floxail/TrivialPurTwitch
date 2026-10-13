import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { startTwitchLogin } from '../helpers';

/** /quiz pour un compte Discord/Google : le quiz parle dans le chat avec le jeton du streamer. */
const TwitchRequired = () => (
  <div style={{ textAlign: 'center', marginTop: '50px' }}>
    <p style={{ color: 'var(--lumon-text-dim)', fontFamily: "'Share Tech Mono', monospace" }}>
      Connecte-toi avec Twitch pour animer un quiz.
    </p>
    <button className="terminal-btn" onClick={() => startTwitchLogin('/quiz')}>
      Connexion Twitch <FontAwesomeIcon icon={['fab', 'twitch']} color="#6441A4" />
    </button>
  </div>
);

export default TwitchRequired;
