import { useEffect, useState } from 'react';
import { Button, Alert } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import { useGlobalStore } from './store/global-store';
import { TwitchMode, useSettingsStore } from './store/settings-store';
import { useQuizStore } from './store/quiz-store-v2';

const Settings = () => {

  const navigate = useNavigate();

  const settingsStore = useSettingsStore();
  const globalStore = useGlobalStore();
  const quizStore = useQuizStore();

  const [validated, setValidated] = useState(false);
  const [chatNotifications, setChatNotifications] = useState<boolean>(settingsStore.chatNotifications);
  const [addEveryUser, setAddEveryUser] = useState<boolean>(settingsStore.addEveryUser);
  const [acceptanceDelay, setAcceptanceDelay] = useState<number>(settingsStore.acceptanceDelay);
  const [scoreCommandMode, setScoreCommandMode] = useState<any>(settingsStore.scoreCommandMode);
  const [previewGuessNumber, setPreviewGuessNumber] = useState<boolean>(settingsStore.previewGuessNumber);

  useEffect(() => {
    globalStore.setSubtitle('Settings');
  }, []);

  const submit = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    settingsStore.update({
      addEveryUser: addEveryUser,
      chatNotifications: chatNotifications,
      previewGuessNumber: previewGuessNumber && acceptanceDelay > 0,
      acceptanceDelay: acceptanceDelay,
      scoreCommandMode: scoreCommandMode,
    });
    navigate('/quiz');
  };

  return (
    <div style={{ width: '600px', margin: 'auto' }} className="mb-3">
      <Form noValidate validated={validated} onSubmit={submit}>

        <h3>Global</h3>

        <Form.Group className="mb-3" controlId="formGroupAcceptance">
          <Form.Label>Délai d'acceptation de la réponse</Form.Label>
          <Form.Range onChange={(e) => setAcceptanceDelay(e.target.valueAsNumber)} value={acceptanceDelay} style={{ width: '100%' }} min={0} max={20} />
          <Form.Label style={{ width: '100%', textAlign: 'center', marginTop: '-10px' }}><i>{acceptanceDelay} seconde{acceptanceDelay > 1 ? 's' : ''}</i></Form.Label>
        </Form.Group>
        <Form.Group className="mb-3" controlId="formPreviewGuessNumber">
          <Form.Check disabled={acceptanceDelay === 0} type="checkbox" checked={previewGuessNumber && acceptanceDelay > 0} label="Prévisualiser le nombre de tentatives pendant le délai d'acceptation" onChange={(e) => { setPreviewGuessNumber(e.target.checked); }} />
        </Form.Group>
        <Form.Group className="mb-3" controlId="formGroupAddEveryUser">
          <Form.Check type="checkbox" checked={addEveryUser} label=" Ajouter tous les spectateurs qui s'expriment dans le classement (peut avoir un impact sur les performances avec un public très large)" onChange={(e) => { setAddEveryUser(e.target.checked); }} />
        </Form.Group>

        <br></br>
        <h3>Twitch integration</h3>

        <Form.Group className="mb-3" controlId="formGroupScoreCommandMode">
          <Form.Label>Score command mode (<i>!score</i>)</Form.Label>
          <Form.Select required className="form-control" value={scoreCommandMode} onChange={(e) => { setScoreCommandMode(+(e.target.value)); }}>
            <option value={TwitchMode.Disabled}>Désactivé</option>
            <option value={TwitchMode.Channel}>Le bot doit repondre dans le tchat</option>
            <option value={TwitchMode.Whisper}>Le bot doit repondre dans les DM</option>
          </Form.Select>
        </Form.Group>
        <Form.Group className="mb-3" controlId="formGroupChatNotifications">
          <Form.Check type="checkbox" checked={chatNotifications} label="Channel notifications (display guesses in the chat)" onChange={(e) => { setChatNotifications(e.target.checked); }} />
        </Form.Group>

        <br />
        <h3>
          <FontAwesomeIcon icon={['fas', 'dice']} className="me-2" />
          Options de quiz
        </h3>

        <div className="card p-3 mb-3">
          <Form.Group className="mb-3">
            <div className="d-flex align-items-center mb-2">
              <FontAwesomeIcon icon={['fas', 'trophy']} className="me-2" size="lg" color="#FFD700" />
              <Form.Label className="mb-0">
                <strong>Scores en mode CARTE</strong>
              </Form.Label>
            </div>
            <Form.Check
              type="switch"
              id="cumulativeScores"
              label="Cumuler les scores entre les cartes"
              checked={quizStore.cumulativeScoresInCardMode}
              onChange={(e) => quizStore.setCumulativeScores(e.target.checked)}
              style={{ fontSize: '16px' }}
            />
            <Alert variant={quizStore.cumulativeScoresInCardMode ? 'success' : 'info'} className="mt-2 mb-0">
              {quizStore.cumulativeScoresInCardMode ? (
                <>
                  <strong>Mode cumulatif activé</strong><br />
                  Les scores s'additionnent d'une carte à l'autre. Parfait pour une longue session avec plusieurs cartes !
                </>
              ) : (
                <>
                  <strong>Mode reset activé</strong><br />
                  Les scores sont réinitialisés à chaque nouvelle carte. Parfait pour des parties courtes et indépendantes !
                </>
              )}
            </Alert>
          </Form.Group>

          <Form.Group className="mb-3">
            <div className="d-flex align-items-center mb-2">
              <FontAwesomeIcon icon={['fas', 'trophy']} className="me-2" size="lg" color="#4CAF50" />
              <Form.Label className="mb-0">
                <strong>Scores en mode QUIZ</strong>
              </Form.Label>
            </div>
            <Form.Check
              type="switch"
              id="cumulativeScoresQuiz"
              label="Cumuler les scores entre les quiz"
              checked={quizStore.cumulativeScoresInQuizMode}
              onChange={(e) => quizStore.setCumulativeScoresQuiz(e.target.checked)}
              style={{ fontSize: '16px' }}
            />
            <Alert variant={quizStore.cumulativeScoresInQuizMode ? 'success' : 'info'} className="mt-2 mb-0">
              {quizStore.cumulativeScoresInQuizMode ? (
                <>
                  <strong>Mode cumulatif activé</strong><br />
                  Les scores s'additionnent d'un quiz à l'autre. Parfait pour une longue session avec plusieurs quiz !
                </>
              ) : (
                <>
                  <strong>Mode reset activé</strong><br />
                  Les scores sont réinitialisés à chaque nouveau quiz. Parfait pour des parties courtes et indépendantes !
                </>
              )}
            </Alert>
          </Form.Group>

          <Form.Group className="mb-0">
            <div className="d-flex align-items-center mb-2">
              <FontAwesomeIcon icon={['fas', 'list-ol']} className="me-2" size="lg" color="#4A90E2" />
              <Form.Label className="mb-0">
                <strong>Questions par défaut en mode QUIZ</strong>
              </Form.Label>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Form.Control
                type="number"
                min="1"
                max="100"
                value={quizStore.defaultQuizQuestions}
                onChange={(e) => quizStore.setDefaultQuizQuestions(parseInt(e.target.value) || 10)}
                style={{ width: '100px' }}
              />
              <span className="text-muted">questions</span>
            </div>
            <Form.Text className="text-muted">
              Utilisé quand le mode QUIZ est lancé sans préciser de nombre (entre 1 et 100)
            </Form.Text>
          </Form.Group>
        </div>

        <Button style={{ width: '80px' }} size="sm" className="mr-2" variant="primary" type="submit">
          <b>Save</b>
        </Button>
        <Button disabled={!settingsStore.isInitialized()} style={{ width: '80px' }} size="sm" className="mx-2" variant="secondary" onClick={() => navigate('/quiz')}>
          <b>Cancel</b>
        </Button>
      </Form>
    </div>
  );
};

export default Settings;