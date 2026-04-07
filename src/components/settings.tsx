import { useEffect, useState } from 'react';
import { Button, Alert } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import { useGlobalStore } from './store/global-store';
import { TwitchMode, useSettingsStore } from './store/settings-store';
import { useQuestionsStore } from './store/questions-store';

const Settings = () => {

  const navigate = useNavigate();

  const settingsStore = useSettingsStore();
  const globalStore = useGlobalStore();
  const questionsStore = useQuestionsStore();
  const [chatNotifications, setChatNotifications] = useState<boolean>(settingsStore.chatNotifications);
  const [addEveryUser, setAddEveryUser] = useState<boolean>(settingsStore.addEveryUser);
  const [acceptanceDelay, setAcceptanceDelay] = useState<number>(settingsStore.acceptanceDelay);
  const [questionTimeLimit, setQuestionTimeLimit] = useState<number>(settingsStore.questionTimeLimit);
  const [scoreCommandMode, setScoreCommandMode] = useState<any>(settingsStore.scoreCommandMode);
  const [previewGuessNumber, setPreviewGuessNumber] = useState<boolean>(settingsStore.previewGuessNumber);
  const [gracePeriodMs, setGracePeriodMs] = useState<number>(settingsStore.gracePeriodMs);

  useEffect(() => {
    globalStore.setSubtitle('Settings');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: any) => {
    e.preventDefault();
    e.stopPropagation();

    settingsStore.update({
      addEveryUser: addEveryUser,
      chatNotifications: chatNotifications,
      previewGuessNumber: previewGuessNumber && acceptanceDelay > 0,
      acceptanceDelay: acceptanceDelay,
      questionTimeLimit: questionTimeLimit,
      scoreCommandMode: scoreCommandMode,
      gracePeriodMs: gracePeriodMs,
    });
    navigate('/quiz');
  };

  return (
    <div style={{ width: '600px', margin: 'auto' }} className="mb-3">
      <Form noValidate onSubmit={submit}>

        <h3>Global</h3>

        <Form.Group className="mb-3" controlId="formGroupQuestionTime">
          <Form.Label>Temps de réponse par question</Form.Label>
          <Form.Range onChange={(e) => setQuestionTimeLimit(e.target.valueAsNumber)} value={questionTimeLimit} style={{ width: '100%' }} min={10} max={60} />
          <Form.Label style={{ width: '100%', textAlign: 'center', marginTop: '-10px' }}><i>{questionTimeLimit} seconde{questionTimeLimit > 1 ? 's' : ''}</i></Form.Label>
        </Form.Group>

        <Form.Group className="mb-3" controlId="formGroupAcceptance">
          <Form.Label>Délai d'acceptation de la réponse</Form.Label>
          <Form.Range onChange={(e) => setAcceptanceDelay(e.target.valueAsNumber)} value={acceptanceDelay} style={{ width: '100%' }} min={0} max={20} />
          <Form.Label style={{ width: '100%', textAlign: 'center', marginTop: '-10px' }}><i>{acceptanceDelay} seconde{acceptanceDelay > 1 ? 's' : ''}</i></Form.Label>
        </Form.Group>

        {/* SLIDER DE CLÉMENCE CORRIGÉ */}
        <Form.Group className="mb-3" controlId="formGroupGracePeriod">
          <Form.Label>
            Délai de clémence (FIRST)
            <span style={{ fontSize: '0.8rem', color: 'var(--lumon-text-dim)', display: 'block', fontWeight: 'normal' }}>
              Temps supplémentaire accordé pour partager la place de 1er
            </span>
          </Form.Label>
          <Form.Range 
            onChange={(e) => setGracePeriodMs(e.target.valueAsNumber)} 
            value={gracePeriodMs} 
            style={{ width: '100%' }} 
            min={100} 
            max={2000} 
            step={100} 
          />
          <Form.Label style={{ width: '100%', textAlign: 'center', marginTop: '-10px' }}>
            <i>{(gracePeriodMs / 1000).toFixed(1).replace('.', ',')} seconde{gracePeriodMs >= 2000 ? 's' : ''}</i>
          </Form.Label>
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
              <FontAwesomeIcon icon={['fas', 'trophy']} className="me-2" size="lg" color="#4CAF50" />
              <Form.Label className="mb-0">
                <strong>Scores persistants</strong>
              </Form.Label>
            </div>
            <Form.Check
              type="switch"
              id="cumulativeScoresQuiz"
              label="Cumuler les scores entre les quiz"
              checked={questionsStore.cumulativeScoresInQuizMode}
              onChange={(e) => questionsStore.setCumulativeScoresQuiz(e.target.checked)}
              style={{ fontSize: '16px' }}
            />
            <Alert variant={questionsStore.cumulativeScoresInQuizMode ? 'success' : 'info'} className="mt-2 mb-0">
              {questionsStore.cumulativeScoresInQuizMode ? (
                <>
                  <strong>Mode cumulatif activé</strong><br />
                  Les scores s'additionnent d'un quiz à l'autre. Utilisez le bouton "Terminer la session" sur l'écran Quiz pour afficher le podium final et réinitialiser les scores.
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
                <strong>Questions par défaut</strong>
              </Form.Label>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Form.Control
                type="number"
                min="1"
                max="100"
                value={questionsStore.defaultQuizQuestions}
                onChange={(e) => questionsStore.setDefaultQuizQuestions(parseInt(e.target.value) || 10)}
                style={{ width: '100px' }}
              />
              <span className="text-muted">questions</span>
            </div>
            <Form.Text className="text-muted">
              Nombre de questions par défaut lors du lancement d'un quiz (entre 1 et 100)
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