import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Form, Spinner } from 'react-bootstrap';
import { useAuthStore } from './store/auth-store';
import { useGlobalStore } from './store/global-store';
import {
  useQuestionsStore,
  Question,
  QuestionType,
  TrivialCategory,
  categoryNames,
} from './store/questions-store';
import { apiSubmitQuestion, SubmitQuestionPayload } from 'services/api-submit-service';

// Labels et limites QCM
const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const QCM_MIN_OPTIONS = 2;
const QCM_MAX_OPTIONS = 6;

type ContributionMode = 'local' | 'public';

// ============================================================
// Parser bulk questions (réutilisé depuis question-manager-modals)
// ============================================================

interface ParsedBulkQuestion {
  question: string;
  answer: string;
  alternativeAnswers: string[];
  isQcm?: boolean;
  qcmOptions?: string[];
  qcmCorrectIndex?: number;
}

function parseBulkQuestions(text: string): { questions: ParsedBulkQuestion[]; errors: string[] } {
  const questions: ParsedBulkQuestion[] = [];
  const errors: string[] = [];

  const blocks = text.split(/\n(?=Q\s*:)/i).filter(b => b.trim().length > 0);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let question = '';
    let answer = '';
    const alternativeAnswers: string[] = [];
    const qcmOptions: Record<string, string> = {};

    for (const line of lines) {
      const qMatch = line.match(/^Q\s*:\s*(.+)/i);
      const rMatch = line.match(/^R\s*:\s*(.+)/i);
      const altMatch = line.match(/^ALT\s*:\s*(.+)/i);
      const optMatch = line.match(/^([A-F])\s*:\s*(.+)/);

      if (qMatch) {
        question = qMatch[1].trim();
      } else if (altMatch) {
        const parts = altMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        alternativeAnswers.push(...parts);
      } else if (rMatch) {
        answer = rMatch[1].trim();
      } else if (optMatch) {
        qcmOptions[optMatch[1]] = optMatch[2].trim();
      }
    }

    if (!question && !answer) continue;
    if (!question) { errors.push(`Bloc ${i + 1} : question manquante`); continue; }
    if (!answer) { errors.push(`Bloc ${i + 1} : réponse manquante`); continue; }

    const optionKeys = QCM_LABELS.filter(l => qcmOptions[l]);
    const answerUpper = answer.toUpperCase();
    const isQcm = optionKeys.length >= 2 && QCM_LABELS.includes(answerUpper) && !!qcmOptions[answerUpper];

    if (isQcm) {
      const orderedOptions = optionKeys.map(l => qcmOptions[l]);
      const correctIndex = optionKeys.indexOf(answerUpper);
      questions.push({
        question, answer: qcmOptions[answerUpper], alternativeAnswers: [],
        isQcm: true, qcmOptions: orderedOptions, qcmCorrectIndex: correctIndex,
      });
    } else {
      questions.push({ question, answer, alternativeAnswers });
    }
  }

  return { questions, errors };
}

// ============================================================
// ContributionPage - Accessible à TOUS les utilisateurs
// ============================================================

const ContributionPage: React.FC = () => {
  const setSubtitle = useGlobalStore((state) => state.setSubtitle);
  const twitchNick = useAuthStore((state) => state.twitchNick);
  const boxes = useQuestionsStore((state) => state.boxes);
  const addQuestion = useQuestionsStore((state) => state.addQuestion);
  const addBox = useQuestionsStore((state) => state.addBox);

  // Mode par défaut : local (ma collection)
  const [mode, setMode] = useState<ContributionMode>('local');
  const [tab, setTab] = useState<'single' | 'bulk'>('single');

  // Notifications
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Single question form
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [alternativeAnswers, setAlternativeAnswers] = useState('');
  const [category, setCategory] = useState<TrivialCategory>(TrivialCategory.Geography);
  const [boxName, setBoxName] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>(QuestionType.FREE_TEXT);
  const [qcmOptions, setQcmOptions] = useState<string[]>(['', '']);
  const [qcmCorrectIndex, setQcmCorrectIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Bulk
  const [bulkText, setBulkText] = useState('');
  const [bulkBox, setBulkBox] = useState('');
  const [bulkRandomCat, setBulkRandomCat] = useState(true);
  const [bulkCategory, setBulkCategory] = useState<TrivialCategory>(TrivialCategory.Geography);
  const [bulkPreview, setBulkPreview] = useState<{ questions: ParsedBulkQuestion[]; errors: string[] } | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Nouvelle boîte
  const [showNewBox, setShowNewBox] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');

  useEffect(() => {
    setSubtitle('Proposer des questions');
  }, [setSubtitle]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  const resetSingleForm = () => {
    setQuestion('');
    setAnswer('');
    setAlternativeAnswers('');
    setCategory(TrivialCategory.Geography);
    setQuestionType(QuestionType.FREE_TEXT);
    setQcmOptions(['', '']);
    setQcmCorrectIndex(0);
  };

  const handleCreateBox = async () => {
    const name = newBoxName.trim();
    if (!name) return;
    if (boxes.find(b => b.name === name)) {
      showError(`La boîte "${name}" existe déjà`);
      return;
    }
    await addBox(name);
    setNewBoxName('');
    setShowNewBox(false);
    showSuccess(`Boîte "${name}" créée !`);
  };

  // ==================== Soumission unique ====================
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim() || !answer.trim()) {
      showError('La question et la réponse sont requises');
      return;
    }

    if (questionType === QuestionType.QCM) {
      const filled = qcmOptions.filter(o => o.trim());
      if (filled.length < QCM_MIN_OPTIONS) {
        showError(`QCM : au moins ${QCM_MIN_OPTIONS} options requises`);
        return;
      }
      if (filled.length !== qcmOptions.length) {
        showError('Toutes les options QCM doivent être remplies');
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      if (mode === 'public') {
        const payload: SubmitQuestionPayload = {
          question: question.trim(),
          answer: answer.trim(),
          category,
          boxName: boxName || undefined,
          questionType,
        };
        if (questionType === QuestionType.FREE_TEXT && alternativeAnswers.trim()) {
          payload.alternativeAnswers = alternativeAnswers.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (questionType === QuestionType.QCM) {
          payload.qcmOptions = qcmOptions;
          payload.qcmCorrectIndex = qcmCorrectIndex;
        }
        await apiSubmitQuestion(payload);
        showSuccess('Question soumise pour modération !');
      } else {
        if (!boxName) {
          showError('Sélectionnez une boîte de destination');
          setSubmitting(false);
          return;
        }
        const newQuestion: Question = {
          id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          question: question.trim(),
          answer: answer.trim(),
          alternativeAnswers: alternativeAnswers ? alternativeAnswers.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          category,
          boxName,
          questionType,
          difficulty: 'medium',
        };
        if (questionType === QuestionType.QCM) {
          newQuestion.qcmOptions = qcmOptions;
          newQuestion.qcmCorrectIndex = qcmCorrectIndex;
        }
        addQuestion(newQuestion);
        showSuccess('Question ajoutée à ta collection locale !');
      }
      resetSingleForm();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== Soumission bulk ====================
  const handleBulkPreview = () => {
    setBulkPreview(parseBulkQuestions(bulkText));
  };

  const handleBulkSubmit = async () => {
    const result = bulkPreview || parseBulkQuestions(bulkText);
    if (result.questions.length === 0) {
      showError('Aucune question valide détectée');
      return;
    }

    setBulkSubmitting(true);
    setError('');

    try {
      let count = 0;

      for (const q of result.questions) {
        const cat = bulkRandomCat
          ? (Math.floor(Math.random() * 6) as TrivialCategory)
          : bulkCategory;

        if (mode === 'public') {
          const payload: SubmitQuestionPayload = {
            question: q.question,
            answer: q.answer,
            category: cat,
            boxName: bulkBox || undefined,
            questionType: q.isQcm ? 'qcm' : 'free_text',
          };
          if (!q.isQcm && q.alternativeAnswers.length > 0) {
            payload.alternativeAnswers = q.alternativeAnswers;
          }
          if (q.isQcm) {
            payload.qcmOptions = q.qcmOptions;
            payload.qcmCorrectIndex = q.qcmCorrectIndex;
          }
          await apiSubmitQuestion(payload);
        } else {
          if (!bulkBox) {
            showError('Sélectionnez une boîte de destination');
            setBulkSubmitting(false);
            return;
          }
          const newQ: Question = {
            id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${count}`,
            question: q.question,
            answer: q.answer,
            alternativeAnswers: q.alternativeAnswers.length > 0 ? q.alternativeAnswers : undefined,
            category: cat,
            boxName: bulkBox,
            questionType: q.isQcm ? QuestionType.QCM : QuestionType.FREE_TEXT,
            difficulty: 'medium',
          };
          if (q.isQcm) {
            newQ.qcmOptions = q.qcmOptions;
            newQ.qcmCorrectIndex = q.qcmCorrectIndex;
          }
          addQuestion(newQ);
        }
        count++;
      }

      const qcmCount = result.questions.filter(q => q.isQcm).length;
      const freeCount = result.questions.length - qcmCount;
      const details = [
        freeCount > 0 ? `${freeCount} texte libre` : '',
        qcmCount > 0 ? `${qcmCount} QCM` : '',
      ].filter(Boolean).join(', ');

      showSuccess(`${count} question(s) ${mode === 'public' ? 'soumises pour modération' : 'ajoutées à ta collection'} (${details})`);
      setBulkText('');
      setBulkPreview(null);
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la soumission en masse');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const isLocal = mode === 'local';
  const isPublic = mode === 'public';

  return (
    <div className="p-3" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2>
        <FontAwesomeIcon icon={['fas', 'pen']} className="me-2" />
        Proposer des questions
      </h2>

      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {/* ========== Sélecteur de mode ========== */}
      <div className="mb-3">
        <ButtonGroup className="w-100">
          <Button
            variant={isLocal ? 'warning' : 'outline-secondary'}
            onClick={() => setMode('local')}
            className="py-2"
          >
            <FontAwesomeIcon icon={['fas', 'database']} className="me-2" />
            <strong>Ma Collection</strong>
            <div style={{ fontSize: '11px', opacity: 0.85 }}>Stocké localement sur ton navigateur</div>
          </Button>
          <Button
            variant={isPublic ? 'primary' : 'outline-secondary'}
            onClick={() => setMode('public')}
            className="py-2"
          >
            <FontAwesomeIcon icon={['fas', 'globe']} className="me-2" />
            <strong>Proposer à la Communauté</strong>
            <div style={{ fontSize: '11px', opacity: 0.85 }}>Envoyé pour validation par un admin</div>
          </Button>
        </ButtonGroup>
      </div>

      {/* Badge info mode */}
      <div className="mb-3">
        {isLocal && (
          <Alert variant="warning" className="py-2 mb-0">
            <FontAwesomeIcon icon={['fas', 'database']} className="me-2" />
            Les questions seront ajoutées <strong>uniquement dans ton navigateur</strong> ({twitchNick || 'toi'}).
            Elles ne seront pas visibles par les autres streamers.
          </Alert>
        )}
        {isPublic && (
          <Alert variant="info" className="py-2 mb-0">
            <FontAwesomeIcon icon={['fas', 'globe']} className="me-2" />
            Ta question sera <strong>envoyée à un admin</strong> qui la validera avant de l'ajouter pour tout le monde.
          </Alert>
        )}
      </div>

      {/* Tabs : Question unique / Ajout en masse */}
      <ButtonGroup size="sm" className="mb-3">
        <Button
          variant={tab === 'single' ? 'info' : 'outline-secondary'}
          onClick={() => setTab('single')}
        >
          Question unique
        </Button>
        <Button
          variant={tab === 'bulk' ? 'info' : 'outline-secondary'}
          onClick={() => setTab('bulk')}
        >
          Ajout en masse
        </Button>
      </ButtonGroup>

      {/* ========== Création de boîte ========== */}
      <div className="mb-3">
        {!showNewBox ? (
          <Button size="sm" variant="outline-success" onClick={() => setShowNewBox(true)}>
            <FontAwesomeIcon icon={['fas', 'plus']} className="me-1" />
            Nouvelle boîte
          </Button>
        ) : (
          <div className="d-flex gap-2 align-items-center">
            <Form.Control
              size="sm"
              type="text"
              placeholder="Nom de la boîte (ex: Cinéma 91)"
              value={newBoxName}
              onChange={(e) => setNewBoxName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateBox()}
              autoFocus
              style={{ maxWidth: '300px' }}
            />
            <Button size="sm" variant="success" onClick={handleCreateBox} disabled={!newBoxName.trim()}>
              Créer
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={() => { setShowNewBox(false); setNewBoxName(''); }}>
              Annuler
            </Button>
          </div>
        )}
      </div>

      {/* ==================== Tab: Question unique ==================== */}
      {tab === 'single' && (
        <Form onSubmit={handleSingleSubmit}>
          {/* Boîte */}
          <Form.Group className="mb-3">
            <Form.Label>
              Boîte Trivial Pursuit {isLocal ? '*' : '(optionnel)'}
            </Form.Label>
            <Form.Select
              required={isLocal}
              value={boxName}
              onChange={(e) => setBoxName(e.target.value)}
            >
              <option value="">
                {isPublic ? "L'admin choisira la boîte" : 'Sélectionner une boîte...'}
              </option>
              {boxes.map(box => (
                <option key={box.name} value={box.name}>{box.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Type */}
          <Form.Group className="mb-3">
            <Form.Label><strong>Type de question *</strong></Form.Label>
            <div className="d-flex gap-2">
              <Button
                type="button"
                variant={questionType === QuestionType.FREE_TEXT ? 'primary' : 'outline-primary'}
                onClick={() => setQuestionType(QuestionType.FREE_TEXT)}
                className="flex-fill"
              >
                Réponse libre
              </Button>
              <Button
                type="button"
                variant={questionType === QuestionType.QCM ? 'primary' : 'outline-primary'}
                onClick={() => setQuestionType(QuestionType.QCM)}
                className="flex-fill"
              >
                QCM (2-6 choix)
              </Button>
            </div>
          </Form.Group>

          {/* Catégorie */}
          <Form.Group className="mb-3">
            <Form.Label>Catégorie *</Form.Label>
            <Form.Select
              value={category}
              onChange={(e) => setCategory(parseInt(e.target.value) as TrivialCategory)}
            >
              {Object.entries(categoryNames).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Question */}
          <Form.Group className="mb-3">
            <Form.Label>Question *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              required
              placeholder="Entrez votre question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </Form.Group>

          {/* Réponse */}
          <Form.Group className="mb-3">
            <Form.Label>Réponse *</Form.Label>
            <Form.Control
              type="text"
              required
              placeholder="Réponse correcte"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </Form.Group>

          {/* Alternatives (texte libre) */}
          {questionType === QuestionType.FREE_TEXT && (
            <Form.Group className="mb-3">
              <Form.Label>Réponses alternatives (optionnel)</Form.Label>
              <Form.Control
                type="text"
                placeholder="Séparez par des virgules : réponse1, réponse2"
                value={alternativeAnswers}
                onChange={(e) => setAlternativeAnswers(e.target.value)}
              />
            </Form.Group>
          )}

          {/* Options QCM */}
          {questionType === QuestionType.QCM && (
            <div className="p-3 mb-3" style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '10px', border: '2px solid #ff60b7' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">Options QCM ({qcmOptions.length})</h6>
                <div className="d-flex gap-1">
                  <Button
                    type="button"
                    variant="outline-danger"
                    size="sm"
                    disabled={qcmOptions.length <= QCM_MIN_OPTIONS}
                    onClick={() => {
                      const newOpts = qcmOptions.slice(0, -1);
                      const newIdx = qcmCorrectIndex >= newOpts.length ? 0 : qcmCorrectIndex;
                      setQcmOptions(newOpts);
                      setQcmCorrectIndex(newIdx);
                      if (newIdx !== qcmCorrectIndex) setAnswer(newOpts[newIdx] || answer);
                    }}
                  >
                    − Option
                  </Button>
                  <Button
                    type="button"
                    variant="outline-success"
                    size="sm"
                    disabled={qcmOptions.length >= QCM_MAX_OPTIONS}
                    onClick={() => setQcmOptions([...qcmOptions, ''])}
                  >
                    + Option
                  </Button>
                </div>
              </div>
              {qcmOptions.map((opt, i) => (
                <Form.Group key={i} className="mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="radio"
                      name="qcmCorrect"
                      checked={qcmCorrectIndex === i}
                      onChange={() => {
                        setQcmCorrectIndex(i);
                        setAnswer(qcmOptions[i] || answer);
                      }}
                    />
                    <span style={{
                      fontWeight: 'bold',
                      color: qcmCorrectIndex === i ? '#4CAF50' : 'inherit',
                      minWidth: '25px'
                    }}>
                      {QCM_LABELS[i]})
                    </span>
                    <Form.Control
                      type="text"
                      placeholder={`Option ${QCM_LABELS[i]}`}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...qcmOptions];
                        newOpts[i] = e.target.value;
                        setQcmOptions(newOpts);
                        if (qcmCorrectIndex === i) setAnswer(e.target.value);
                      }}
                      style={{
                        borderColor: qcmCorrectIndex === i ? '#4CAF50' : undefined,
                        borderWidth: qcmCorrectIndex === i ? '2px' : undefined,
                      }}
                    />
                    {qcmCorrectIndex === i && <Badge bg="success">Correcte</Badge>}
                  </div>
                </Form.Group>
              ))}
            </div>
          )}

          <Button type="submit" variant={isLocal ? 'warning' : 'primary'} disabled={submitting} className="w-100">
            {submitting && <Spinner animation="border" size="sm" className="me-2" />}
            {isLocal ? (
              <>
                <FontAwesomeIcon icon={['fas', 'plus']} className="me-2" />
                Ajouter à ma collection
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={['fas', 'paper-plane']} className="me-2" />
                Proposer la question
              </>
            )}
          </Button>
        </Form>
      )}

      {/* ==================== Tab: Ajout en masse ==================== */}
      {tab === 'bulk' && (
        <div>
          <Form.Group className="mb-3">
            <Form.Label>Boîte de destination {isLocal ? '*' : '(optionnel)'}</Form.Label>
            <Form.Select
              required={isLocal}
              value={bulkBox}
              onChange={(e) => setBulkBox(e.target.value)}
            >
              <option value="">
                {isPublic ? "L'admin choisira" : 'Sélectionner...'}
              </option>
              {boxes.map(box => (
                <option key={box.name} value={box.name}>{box.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              id="bulkRandomCat"
              label="Catégories aléatoires"
              checked={bulkRandomCat}
              onChange={(e) => setBulkRandomCat(e.target.checked)}
            />
            {!bulkRandomCat && (
              <Form.Select
                size="sm"
                className="mt-2"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(parseInt(e.target.value) as TrivialCategory)}
              >
                {Object.entries(categoryNames).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </Form.Select>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Questions (format Q:/R:/ALT: ou QCM A:/B:/C:/D:)</Form.Label>
            <Form.Control
              as="textarea"
              rows={12}
              placeholder={`Q: Quelle est la capitale de la France ?\nA: Lyon\nB: Paris\nC: Marseille\nD: Bordeaux\nR: B\n\nQ: Qui a peint la Joconde ?\nR: Léonard de Vinci\nALT: De Vinci`}
              value={bulkText}
              onChange={(e) => { setBulkText(e.target.value); setBulkPreview(null); }}
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
          </Form.Group>

          <div className="d-flex gap-2 mb-3">
            <Button variant="outline-info" size="sm" onClick={handleBulkPreview} disabled={!bulkText.trim()}>
              Prévisualiser
            </Button>
          </div>

          {bulkPreview && (
            <div className="mb-3">
              {bulkPreview.questions.length > 0 && (
                <Alert variant="success">{bulkPreview.questions.length} question(s) détectée(s)</Alert>
              )}
              {bulkPreview.errors.length > 0 && (
                <Alert variant="warning">
                  {bulkPreview.errors.map((err, i) => <div key={i}>{err}</div>)}
                </Alert>
              )}
              {bulkPreview.questions.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '13px' }}>
                  {bulkPreview.questions.map((q, i) => (
                    <div key={i} className="mb-2 p-2" style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '5px' }}>
                      <strong>Q:</strong> {q.question}
                      {q.isQcm && <Badge bg="info" className="ms-2">QCM</Badge>}
                      <br />
                      {q.isQcm && q.qcmOptions ? (
                        q.qcmOptions.map((opt, j) => (
                          <span key={j}>
                            <span style={{
                              color: j === q.qcmCorrectIndex ? '#4CAF50' : 'inherit',
                              fontWeight: j === q.qcmCorrectIndex ? 'bold' : 'normal',
                            }}>
                              {QCM_LABELS[j]}: {opt}{j === q.qcmCorrectIndex && ' ✓'}
                            </span>
                            <br />
                          </span>
                        ))
                      ) : (
                        <>
                          <strong>R:</strong> {q.answer}
                          {q.alternativeAnswers.length > 0 && (
                            <span className="text-muted"> (ALT: {q.alternativeAnswers.join(', ')})</span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            variant={isLocal ? 'warning' : 'primary'}
            disabled={bulkSubmitting || !bulkText.trim()}
            onClick={handleBulkSubmit}
            className="w-100"
          >
            {bulkSubmitting && <Spinner animation="border" size="sm" className="me-2" />}
            {isLocal ? (
              <>
                <FontAwesomeIcon icon={['fas', 'plus']} className="me-2" />
                Ajouter à ma collection {bulkPreview ? `(${bulkPreview.questions.length})` : ''}
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={['fas', 'paper-plane']} className="me-2" />
                Proposer {bulkPreview ? `(${bulkPreview.questions.length})` : ''} question(s)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ContributionPage;
