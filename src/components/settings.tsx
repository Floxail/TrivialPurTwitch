import { useEffect, useState, useRef } from 'react';
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
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const [validated] = useState(false);
  const [chatNotifications, setChatNotifications] = useState<boolean>(settingsStore.chatNotifications);
  const [addEveryUser, setAddEveryUser] = useState<boolean>(settingsStore.addEveryUser);
  const [acceptanceDelay, setAcceptanceDelay] = useState<number>(settingsStore.acceptanceDelay);
  const [questionTimeLimit, setQuestionTimeLimit] = useState<number>(settingsStore.questionTimeLimit);
  const [scoreCommandMode, setScoreCommandMode] = useState<any>(settingsStore.scoreCommandMode);
  const [previewGuessNumber, setPreviewGuessNumber] = useState<boolean>(settingsStore.previewGuessNumber);
  const [backupMessage, setBackupMessage] = useState<string>('');
  const [backupError, setBackupError] = useState<string>('');

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
    });
    navigate('/quiz');
  };

  // Export backup complet
  const handleExportFullBackup = () => {
    const backupData = questionsStore.exportFullBackup();

    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `trivialpurtwitch-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setBackupMessage('✅ Backup complet exporté !');
    setTimeout(() => setBackupMessage(''), 3000);
  };

  // Import backup complet
  const handleImportFullBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      const backupData = JSON.parse(content);

      const message = `⚠️ ATTENTION : Cette opération va remplacer TOUTES vos données actuelles :\n\n` +
                      `- Questions (${questionsStore.questions.length} actuelles → ${backupData.quiz?.questions?.length || 0} dans le backup)\n` +
                      `- Boîtes (${questionsStore.boxes.length} actuelles)\n` +
                      `- Scores des joueurs\n` +
                      `- Paramètres\n\n` +
                      `Voulez-vous continuer ?`;

      if (!window.confirm(message)) {
        return;
      }

      const success = questionsStore.importFullBackup(backupData);

      if (success) {
        setBackupMessage('✅ Backup complet restauré ! Rechargement recommandé.');
        setTimeout(() => {
          if (window.confirm('Voulez-vous recharger la page pour appliquer tous les changements ?')) {
            window.location.reload();
          }
        }, 1000);
      } else {
        setBackupError('❌ Erreur lors de la restauration du backup');
        setTimeout(() => setBackupError(''), 5000);
      }
    } catch (error) {
      setBackupError('❌ Fichier de backup invalide');
      setTimeout(() => setBackupError(''), 5000);
    }

    // Reset input
    event.target.value = '';
  };

  return (
    <div style={{ width: '600px', margin: 'auto' }} className="mb-3">
      <Form noValidate validated={validated} onSubmit={submit}>

        <h3>Global</h3>

        <Form.Group className="mb-3" controlId="formGroupQuestionTime">
          <Form.Label>Temps de réponse par question</Form.Label>
          <Form.Range onChange={(e) => setQuestionTimeLimit(e.target.valueAsNumber)} value={questionTimeLimit} style={{ width: '100%' }} min={15} max={60} />
          <Form.Label style={{ width: '100%', textAlign: 'center', marginTop: '-10px' }}><i>{questionTimeLimit} seconde{questionTimeLimit > 1 ? 's' : ''}</i></Form.Label>
        </Form.Group>

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

      <br />
      <h3>
        <FontAwesomeIcon icon={['fas', 'database']} className="me-2" />
        Backup complet
      </h3>

      <div className="card p-3 mb-3">
        <p className="mb-2">
          <strong>Sauvegardez toutes vos données</strong> (questions, boîtes, scores, paramètres) ou restaurez une sauvegarde complète.
        </p>

        {backupMessage && (
          <Alert variant="success" className="mb-2">
            {backupMessage}
          </Alert>
        )}

        {backupError && (
          <Alert variant="danger" className="mb-2">
            {backupError}
          </Alert>
        )}

        <div className="d-flex gap-2">
          <Button variant="primary" onClick={handleExportFullBackup}>
            <FontAwesomeIcon icon={['fas', 'download']} className="me-2" />
            Exporter le backup complet
          </Button>
          <Button variant="warning" onClick={() => backupFileInputRef.current?.click()}>
            <FontAwesomeIcon icon={['fas', 'upload']} className="me-2" />
            Importer un backup complet
          </Button>
        </div>

        <input
          ref={backupFileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportFullBackup}
        />
      </div>
    </div>
  );
};

export default Settings;