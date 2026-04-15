import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { Form, Modal } from 'react-bootstrap';

const STORAGE_KEY = 'quiz_welcome_hidden_v1';

export const shouldShowWelcome = () => {
  return localStorage.getItem(STORAGE_KEY) !== '1';
};

const Welcome = ({ show, onClose }: { show: boolean; onClose: () => void }) => {
  const [dontShow, setDontShow] = useState(false);

  const handleClose = () => {
    if (dontShow) {
      localStorage.setItem(STORAGE_KEY, '1');
    }
    onClose();
  };

  return (
    <Modal show={show} centered size="lg" onHide={handleClose}>
      <Modal.Body style={{ fontFamily: "'Share Tech Mono', monospace" }}>
        <h3 className="text-glow-cyan" style={{ fontFamily: "'Orbitron', sans-serif", textAlign: 'center', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>
          <FontAwesomeIcon icon={['fas', 'gamepad']} className="me-2" />
          Bienvenue sur TrivialPurTwitch
        </h3>

        <ul style={{ lineHeight: '1.8', fontSize: '0.95rem' }}>
          <li>
            <FontAwesomeIcon icon={['fas', 'comment-dots']} className="me-2" style={{ color: 'var(--lumon-cyan)' }} />
            <strong>Tape dans le tchat Twitch</strong> pour jouer — streamer.euse inclus(e) !
          </li>
          <li>
            <FontAwesomeIcon icon={['fas', 'box']} className="me-2" style={{ color: 'var(--lumon-cyan)' }} />
            Choisis <strong>une ou plusieurs boîtes</strong> en cliquant dessus pour les sélectionner.
          </li>
          <li>
            <FontAwesomeIcon icon={['fas', 'chevron-right']} className="me-2" style={{ color: 'var(--lumon-cyan)' }} />
            Les boîtes avec un <strong>▶</strong> contiennent des sous-catégories — déplie-les pour en choisir une ou plusieurs.
          </li>
          <li>
            <FontAwesomeIcon icon={['fas', 'circle-info']} className="me-2" style={{ color: 'var(--lumon-cyan)' }} />
            Le <strong>contenu de ta sélection</strong> (nombre de questions, QCM / Libre) s'affiche juste sous le bouton <em>Lancer un Quiz</em>.
          </li>
          <li>
            <FontAwesomeIcon icon={['fas', 'pen']} className="me-2" style={{ color: 'var(--lumon-cyan)' }} />
            Envie de <strong>proposer tes propres questions</strong> ? Menu en haut à droite → <em>Proposer</em>.
          </li>
        </ul>

        <div className="mt-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <Form.Check
            type="checkbox"
            id="welcome-dont-show"
            label="Ne plus afficher ce message"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
          />
          <button className="terminal-btn terminal-btn-success" onClick={handleClose}>
            <FontAwesomeIcon icon={['fas', 'check']} className="me-2" />
            J'ai compris
          </button>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default Welcome;
