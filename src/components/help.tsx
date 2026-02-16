import { Button, Modal, Table } from 'react-bootstrap';
import { useSettingsStore } from './store/settings-store';

const Help = ({ show, onClose }: any) => {

  const settings = useSettingsStore();

  return (
    <Modal show={show} centered size="lg" dialogClassName="help-modal">
      <Modal.Body>
        <strong>TrivialPurTwitch</strong> is made by <strong>Floxail</strong> (<a href="https://bsky.app/profile/floxail.bsky.social" target="_blank" rel="noreferrer">@floxail.bsky.social</a>) and is <strong><a href="https://github.com/Floxail/TrivialPurTwitch" target="_blank" rel="noreferrer">open-source</a></strong>
        <br />
        is a fork of <strong><a href="https://github.com/s-vivien/BlindTesTwitch" target="_blank" rel="noreferrer">BlindTesTwitch</a></strong> From <strong>Neumann</strong>
        <br />
        <br />
        <h2>Points de chaîne (pour le streamer)</h2>
        <ul>
          <li>Ajouter un <strong>points de chaine</strong> personalisés.</li>
          <li>Nommer et décrire le point de chaîne a votre guise.</li>
          <li>Mettre un prix qui vous semble correct.</li>
          <li>Ajouter la demande de saisie de texte pour que les viewers puissent entrer le nombre de questions.</li>
          <li>Une fois configurer les vieweurs peuvent reclamer un quiz en demandant.</li>
        </ul>
        <h2>Comment Jouer</h2>
        <ul>
          <li><b>Aucune inscription ou condition préalable requise</b> : il suffit de taper dans le chat pour jouer ! Vous serez automatiquement ajouté au classement.</li>
          <li>Il existe une (petite) <b>tolérance aux fautes de frappe</b>, n'hésitez pas à taper rapidement</li>
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

        {/* --- DÉBUT DU TABLEAU AJOUTÉ --- */}
        <div style={{ marginTop: '20px' }}>
          <h5>Exemple de progression (Streak)</h5>
          <Table striped bordered hover size="sm" responsive className="text-center" style={{ fontSize: '0.9em' }}>
            <thead>
              <tr>
                <th>Question</th>
                <th>Résultat</th>
                <th>Base</th>
                <th>Bonus Série</th>
                <th>Points Gagnés</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Q1</td>
                <td>1er (Correct)</td>
                <td>2 pts</td>
                <td>0</td>
                <td><strong>2 pts</strong></td>
              </tr>
              <tr>
                <td>Q2</td>
                <td>Bonne réponse</td>
                <td>1 pt</td>
                <td>+ 1</td>
                <td><strong>2 pts</strong></td>
              </tr>
              <tr>
                <td>Q3</td>
                <td>Bonne réponse</td>
                <td>1 pt</td>
                <td>+ 2</td>
                <td><strong>3 pts</strong></td>
              </tr>
              <tr style={{ opacity: 0.6 }}> {/* Grisé pour montrer l'échec */}
                <td>Q4</td>
                <td>Mauvaise réponse</td>
                <td>0 pt</td>
                <td style={{ color: 'red', fontWeight: 'bold' }}>0 (Reset)</td>
                <td>0 pt</td>
              </tr>
              <tr>
                <td>Q5</td>
                <td>1er (Correct)</td>
                <td>2 pts</td>
                <td>0</td>
                <td><strong>2 pts</strong></td>
              </tr>
              <tr>
                <td colSpan={5}>... <i>Suite de bonnes réponses</i> ...</td>
              </tr>
              <tr>
                <td>Q10</td>
                <td>1er (Correct)</td>
                <td>2 pts</td>
                <td style={{ color: 'green', fontWeight: 'bold' }}>+ 5 (Max)</td>
                <td><strong>7 pts</strong></td>
              </tr>
              <tr>
                <td>Q11</td>
                <td>Bonne réponse</td>
                <td>1 pt</td>
                <td style={{ color: 'green', fontWeight: 'bold' }}>+ 5 (Max)</td>
                <td><strong>6 pts</strong></td>
              </tr>
            </tbody>
          </Table>
        </div>
        {/* --- FIN DU TABLEAU AJOUTÉ --- */}

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