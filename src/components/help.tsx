import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Modal } from 'react-bootstrap';
import { useSettingsStore } from './store/settings-store';

const Help = ({ show, onClose }: any) => {

  const settings = useSettingsStore();

  return (
    <Modal show={show} centered size="lg" dialogClassName="help-modal">
      <Modal.Body>
        <strong>TrivialPurTwitch</strong> is made by <strong>Floxail</strong> (<a href="https://bsky.app/profile/floxail.bsky.social" target="_blank">@floxail.bsky.social</a>) and is <strong><a href="https://github.com/Floxail/TrivialPurTwitch" target="_blank">open-source</a></strong>
        <br />
        is base on <strong><a href="https://github.com/s-vivien/BlindTesTwitch" target="_blank">BlindTesTwitch</a></strong> From <strong>Neumann</strong>
        <br />
        <h2>Comment Joué </h2>
        <ul>
          <li><b>Aucune inscription/condition préalable requise</b> : il suffit de taper dans le chat pour jouer ! Vous serez automatiquement ajouté au classement.</li>
          <li>Il existe une (petite) <b>tolérance aux fautes de frappe</b>, n'hésitez pas à taper rapidement 😃</li>
            </ul>
        <h2>Scoring</h2>
        <ul>
          {
            <>
              <li><b>2 points</b> est attribué chaque fois qu'une personne est <i>la première</i> à trouver la bonne reponse</li>
              <li>Tous les autres joueurs qui trouvent la même réponse dans les {settings.acceptanceDelay} secondes recevront <b>1 point</b></li>
            </>
          }
          <li>Chaque joueur qui répond correctement plus d'une fois recevera <b>+1 point bonus</b> par<br/>reponse consecutive <i>avec une limite a 5points bonus</i></li>
        </ul>
      </Modal.Body>
      <Modal.Footer>
        <Button size="sm" style={{ color: 'white', width: '60px' }} onClick={() => onClose()}>
          <b>Ok</b>
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default Help;
