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
        is a fork of <strong><a href="https://github.com/s-vivien/BlindTesTwitch" target="_blank">BlindTesTwitch</a></strong> From <strong>Neumann</strong>
        <br />
        <br />
        <h2>Points de chaîne (pour le streamer)</h2>
        <ul>
          <li>Ajouter un ou plusieurs <strong>points de chaine</strong> personalisés.</li>
          <li>Nommer et décrire le point de chaîne a votre guise.</li>
          <li>Mettre un prix qui vous semble correct.</li>
          <li>Ajouter la demande de saisie de texte pour que les viewers puissent entrer le nombre de questions.</li>
        </ul>
        <h2>Comment Jouer</h2>
        <ul>
          <li><b>Aucune inscription ou condition préalable requise</b> : il suffit de taper dans le chat pour jouer ! Vous serez automatiquement ajouté au classement.</li>
          <li>Il existe une (petite) <b>tolérance aux fautes de frappe</b>, n'hésitez pas à taper rapidement 😃</li>
            </ul>
        <h2>Scoring</h2>
        <ul>
          {
            <>
              <li><b>2 points</b> sont attribué chaque fois qu'une personne est <i>la première</i> à trouver la bonne réponse</li>
              <li>Tous les autres joueurs qui trouvent la même réponse dans les {settings.acceptanceDelay} secondes recevront <b>1 point</b></li>
            </>
          }
          <li>Chaque joueur qui répond correctement plus d'une fois recevera <b>+1 point bonus</b> par réponse consécutive <i>avec une limite à 5 points bonus</i></li>
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
