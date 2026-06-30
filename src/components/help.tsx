import { Button, Modal, Table } from 'react-bootstrap';
import { useSettingsStore } from './store/settings-store';
import { WelcomeContent } from './welcome';

const Help = ({ show, onClose }: any) => {

  const gracePeriodMs = useSettingsStore(s => s.gracePeriodMs);

  return (
    <Modal show={show} centered size="lg" dialogClassName="help-modal">
      <Modal.Body>
        <WelcomeContent showHelpHint={false} />
        <hr />
        <strong>TrivialPurTwitch</strong> is made by <strong>Floxail</strong> (<a href="https://bsky.app/profile/floxail.bsky.social" target="_blank" rel="noreferrer">@floxail.bsky.social</a>) and is <strong><a href="https://github.com/Floxail/TrivialPurTwitch" target="_blank" rel="noreferrer">open-source</a></strong>
        <br />
        is a fork of <strong><a href="https://github.com/s-vivien/BlindTesTwitch" target="_blank" rel="noreferrer">BlindTesTwitch</a></strong> From <strong>Neumann</strong>
        <br />
        <br />

        <h2>Comment Jouer</h2>
        <ul>
          <li><b>Aucune inscription ou condition préalable requise</b> : il suffit de taper dans le chat pour jouer ! Vous serez automatiquement ajouté au classement.</li>
          <li>Il existe une (petite) <b>tolérance aux fautes de frappe</b>, n'hésitez pas à taper rapidement</li>
        </ul>
        <h2>Scoring</h2>
        <ul>
          <li><b>1 point</b> pour chaque bonne réponse</li>
          <li><b>+2 points FIRST</b> pour le premier joueur à trouver la bonne réponse (fenêtre de clémence : {gracePeriodMs}ms)</li>
          <li><b>+1 point SEUL</b> si vous êtes le <i>seul joueur</i> à avoir trouvé la bonne réponse</li>
          <li><b>+1 à +3 points COMBO</b> par bonne réponse consécutive (max +3)</li>
        </ul>
        <p className="text-muted small">Score max par question : 1 (base) + 2 (first) + 1 (seul) + 3 (combo) = <b>7 points</b></p>

        <div style={{ marginTop: '20px' }}>
          <h5>Exemple de progression (Streak)</h5>
          <Table striped bordered hover size="sm" responsive className="text-center" style={{ fontSize: '0.9em' }}>
            <thead>
              <tr>
                <th>Question</th>
                <th>Résultat</th>
                <th>Base</th>
                <th>First</th>
                <th>Seul</th>
                <th>Combo</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Q1</td>
                <td>1er, seul à répondre</td>
                <td>1</td>
                <td>+2</td>
                <td>+1</td>
                <td>0</td>
                <td><strong>4 pts</strong></td>
              </tr>
              <tr>
                <td>Q2</td>
                <td>Bonne réponse</td>
                <td>1</td>
                <td>-</td>
                <td>-</td>
                <td>+1</td>
                <td><strong>2 pts</strong></td>
              </tr>
              <tr>
                <td>Q3</td>
                <td>1er</td>
                <td>1</td>
                <td>+2</td>
                <td>-</td>
                <td>+2</td>
                <td><strong>5 pts</strong></td>
              </tr>
              <tr style={{ opacity: 0.6 }}>
                <td>Q4</td>
                <td>Mauvaise réponse</td>
                <td>0</td>
                <td>-</td>
                <td>-</td>
                <td style={{ color: 'red', fontWeight: 'bold' }}>Reset</td>
                <td>0 pt</td>
              </tr>
              <tr>
                <td>Q5</td>
                <td>1er, seul à répondre</td>
                <td>1</td>
                <td>+2</td>
                <td>+1</td>
                <td>0</td>
                <td><strong>4 pts</strong></td>
              </tr>
              <tr>
                <td colSpan={7}>... <i>Suite de bonnes réponses</i> ...</td>
              </tr>
              <tr>
                <td>Q9</td>
                <td>1er, seul à répondre</td>
                <td>1</td>
                <td>+2</td>
                <td>+1</td>
                <td style={{ color: 'green', fontWeight: 'bold' }}>+3 (Max)</td>
                <td><strong>7 pts</strong></td>
              </tr>
            </tbody>
          </Table>
        </div>

         <div className="help-section mb-4">
        <h2 className="text-primary"><i className="bi bi-lightbulb-fill me-2"></i>Comment proposer des questions ?</h2>
  <p className="text-muted small">
    Vous pouvez enrichir la base de données commune pour que vos questions apparaissent en jeu (chez vous et chez les autres streamers).</p><ul><li>
      <strong>Accès :</strong> Cliquez sur le bouton <strong>"Contribuer"</strong> dans le menu global.</li>
    <li><strong>Format :</strong> Question libre : Indiquez une question claire, la bonne réponse ; si c'est un QCM Indiquer la ou les bonne reponse + des Mauvaise</li>
    <li><strong>Validation :</strong> Une fois envoyée, votre question est placée en file d'attente. Elle sera relue par un modérateur avant d'être injectée dans la base de données.</li>
  </ul>
</div>

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