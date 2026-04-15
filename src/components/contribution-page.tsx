import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from 'react';
import { Form, Spinner } from 'react-bootstrap';
import { useAuthStore } from './store/auth-store';
import { useGlobalStore } from './store/global-store';
import {
  useQuestionsStore,
  QuestionType,
} from './store/questions-store';
import { apiSubmitQuestion, SubmitQuestionPayload } from 'services/api-submit-service';
import { apiCreateQuestion } from 'services/api-service';

// Labels et limites QCM
const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const QCM_MIN_OPTIONS = 2;
const QCM_MAX_OPTIONS = 6;

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
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const boxes = useQuestionsStore((state) => state.boxes);
  const addBox = useQuestionsStore((state) => state.addBox);

  // On ne peut pas ajouter de questions dans une boîte Master qui contient des sous-boîtes.
  const childlessBoxes = React.useMemo(() => {
    const parentsWithChildren = new Set(
      boxes.map(b => b.parentBox).filter((p): p is string => !!p)
    );
    return boxes.filter(b => !parentsWithChildren.has(b.name));
  }, [boxes]);

  const [tab, setTab] = useState<'single' | 'bulk'>('single');

  // Notifications
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Single question form
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [alternativeAnswers, setAlternativeAnswers] = useState('');
  const [boxName, setBoxName] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>(QuestionType.FREE_TEXT);
  const [qcmOptions, setQcmOptions] = useState<string[]>(['', '']);
  const [qcmCorrectIndexes, setQcmCorrectIndexes] = useState<number[]>([0]);
  const [submitting, setSubmitting] = useState(false);

  // Bulk
  const [bulkText, setBulkText] = useState('');
  const [bulkBox, setBulkBox] = useState('');
  const [bulkPreview, setBulkPreview] = useState<{ questions: ParsedBulkQuestion[]; errors: string[] } | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Nouvelle boîte
  const [showNewBox, setShowNewBox] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');
  const [newBoxOrdered, setNewBoxOrdered] = useState(false);
  const [newBoxDescription, setNewBoxDescription] = useState('');
  const [newBoxParent, setNewBoxParent] = useState('');

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
    setQuestionType(QuestionType.FREE_TEXT);
    setQcmOptions(['', '']);
    setQcmCorrectIndexes([0]);
  };

  const handleCreateBox = async () => {
    const name = newBoxName.trim();
    if (!name) return;
    if (boxes.find(b => b.name === name)) {
      showError(`La boîte "${name}" existe déjà`);
      return;
    }
    await addBox(name, newBoxOrdered || undefined, newBoxDescription.trim() || undefined, newBoxParent || undefined);
    setNewBoxName('');
    setNewBoxOrdered(false);
    setNewBoxDescription('');
    setNewBoxParent('');
    setShowNewBox(false);
    showSuccess(`Boîte "${name}" créée !${newBoxParent ? ` (sous-boîte de ${newBoxParent})` : ''}${newBoxOrdered ? ' (mode ordonné)' : ''}`);
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
      const payload: SubmitQuestionPayload = {
        question: question.trim(),
        answer: answer.trim(),
        boxName: boxName || undefined,
        questionType,
      };
      if (questionType === QuestionType.FREE_TEXT && alternativeAnswers.trim()) {
        payload.alternativeAnswers = alternativeAnswers.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (questionType === QuestionType.QCM) {
        payload.qcmOptions = qcmOptions;
        payload.qcmCorrectIndex = qcmCorrectIndexes[0];
        payload.qcmCorrectIndexes = qcmCorrectIndexes;
      }
      if (isAdmin) {
        await apiCreateQuestion({
          ...payload,
          id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          boxName: payload.boxName || 'Sans boîte',
          questionType: payload.questionType || 'free_text',
          difficulty: 'medium',
        });
        showSuccess('Question ajoutée directement en base !');
      } else {
        await apiSubmitQuestion(payload);
        showSuccess('Question soumise pour modération !');
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
        const payload: SubmitQuestionPayload = {
          question: q.question,
          answer: q.answer,
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
        if (isAdmin) {
          await apiCreateQuestion({
            ...payload,
            id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${count}`,
            boxName: payload.boxName || 'Sans boîte',
            questionType: payload.questionType || 'free_text',
            difficulty: 'medium',
          });
        } else {
          await apiSubmitQuestion(payload);
        }
        count++;
      }

      const qcmCount = result.questions.filter(q => q.isQcm).length;
      const freeCount = result.questions.length - qcmCount;
      const details = [
        freeCount > 0 ? `${freeCount} texte libre` : '',
        qcmCount > 0 ? `${qcmCount} QCM` : '',
      ].filter(Boolean).join(', ');

      const modeLabel = isAdmin ? 'ajoutées directement en base' : 'soumises pour modération';
      showSuccess(`${count} question(s) ${modeLabel} (${details})`);
      setBulkText('');
      setBulkPreview(null);
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la soumission en masse');
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className="lumon-page" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 className="text-glow-cyan mb-3">
        <FontAwesomeIcon icon={['fas', 'pen']} className="me-2" />
        Proposer des questions
      </h2>

      {success && <div className="terminal-alert terminal-alert-success mb-3">{success}</div>}
      {error && <div className="terminal-alert terminal-alert-danger mb-3">{error}</div>}

      <div className="mb-3">
        <div className="terminal-alert terminal-alert-info py-2">
          <FontAwesomeIcon icon={['fas', 'globe']} className="me-2" />
          {isAdmin
            ? <>En tant qu'admin, tes questions sont <strong>ajoutées directement en base</strong>.</>
            : <>Ta question sera <strong>envoyée à un admin</strong> qui la validera avant de l'ajouter.</>
          }
        </div>
      </div>

      {/* Tabs : Question unique / Ajout en masse */}
      <div className="terminal-tabs mb-3">
        <div
          className={`terminal-tab ${tab === 'single' ? 'terminal-tab-active' : ''}`}
          onClick={() => setTab('single')}
        >
          Question unique
        </div>
        <div
          className={`terminal-tab ${tab === 'bulk' ? 'terminal-tab-active' : ''}`}
          onClick={() => setTab('bulk')}
        >
          Ajout en masse
        </div>
      </div>

      {/* ========== Création de boîte ========== */}
      <div className="mb-3">
        {!showNewBox ? (
          <button className="terminal-btn terminal-btn-success terminal-btn-sm" onClick={() => setShowNewBox(true)}>
            <FontAwesomeIcon icon={['fas', 'plus']} className="me-1" />
            Nouvelle boîte
          </button>
        ) : (
          <div className="d-flex flex-column gap-2">
            <div className="d-flex gap-2 align-items-center">
              <input
                className="terminal-input terminal-input-box"
                type="text"
                placeholder="Nom de la boîte (ex: Cinéma 91)"
                value={newBoxName}
                onChange={(e) => setNewBoxName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBox()}
                autoFocus
                style={{ maxWidth: '300px' }}
              />
              <Form.Check
                type="switch"
                id="newBoxOrdered"
                label="↓ Ordonné"
                checked={newBoxOrdered}
                onChange={(e) => setNewBoxOrdered(e.target.checked)}
                title="Les questions seront jouées dans l'ordre d'insertion"
                style={{ whiteSpace: 'nowrap' }}
              />
            </div>
            <input
              className="terminal-input"
              type="text"
              placeholder="Description (optionnel, ex: Boîte Trivial Pursuit édition Cinéma 1991)"
              value={newBoxDescription}
              onChange={(e) => setNewBoxDescription(e.target.value)}
              style={{ maxWidth: '500px' }}
            />
            {isAdmin && (
              <select
                className="terminal-input"
                value={newBoxParent}
                onChange={(e) => setNewBoxParent(e.target.value)}
                style={{ maxWidth: '300px' }}
                title="Rattacher à une boîte Master (optionnel)"
              >
                <option value="">— Boîte indépendante (racine) —</option>
                {boxes.filter(b => !b.parentBox).map(b => (
                  <option key={b.name} value={b.name}>↳ Sous-boîte de : {b.name}</option>
                ))}
              </select>
            )}
            <div className="d-flex gap-2">
              <button className="terminal-btn terminal-btn-success terminal-btn-sm" onClick={handleCreateBox} disabled={!newBoxName.trim()}>
                Créer
              </button>
              <button className="terminal-btn terminal-btn-sm" onClick={() => { setShowNewBox(false); setNewBoxName(''); setNewBoxOrdered(false); setNewBoxDescription(''); setNewBoxParent(''); }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== Tab: Question unique ==================== */}
      {tab === 'single' && (
        <Form onSubmit={handleSingleSubmit}>
          {/* Boîte */}
          <Form.Group className="mb-3">
            <Form.Label>
              Boîte Trivial Pursuit (optionnel)
            </Form.Label>
            <Form.Select
              value={boxName}
              onChange={(e) => setBoxName(e.target.value)}
            >
              <option value="">L'admin choisira la boîte</option>
              {childlessBoxes.map(box => (
                <option key={box.name} value={box.name}>{box.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Type */}
          <Form.Group className="mb-3">
            <Form.Label style={{ color: 'var(--lumon-cyan)', fontFamily: "'Orbitron', sans-serif", fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Type de question *</Form.Label>
            <div className="d-flex gap-2">
              <button
                type="button"
                className={`terminal-btn flex-fill ${questionType === QuestionType.FREE_TEXT ? '' : 'terminal-btn-amber'}`}
                onClick={() => setQuestionType(QuestionType.FREE_TEXT)}
                style={questionType === QuestionType.FREE_TEXT ? { backgroundColor: 'var(--lumon-cyan)', color: 'var(--lumon-void)' } : {}}
              >
                Réponse libre
              </button>
              <button
                type="button"
                className={`terminal-btn flex-fill ${questionType === QuestionType.QCM ? '' : 'terminal-btn-amber'}`}
                onClick={() => setQuestionType(QuestionType.QCM)}
                style={questionType === QuestionType.QCM ? { backgroundColor: 'var(--lumon-cyan)', color: 'var(--lumon-void)' } : {}}
              >
                QCM (2-6 choix)
              </button>
            </div>
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
            <div className="terminal-panel border-glow-cyan p-3 mb-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="text-display-tech" style={{ fontSize: '0.75rem', color: 'var(--lumon-cyan)' }}>Options QCM ({qcmOptions.length})</span>
                <div className="d-flex gap-1">
                  <button
                    type="button"
                    className="terminal-btn terminal-btn-danger terminal-btn-sm"
                    disabled={qcmOptions.length <= QCM_MIN_OPTIONS}
                    onClick={() => {
                      const newOpts = qcmOptions.slice(0, -1);
                      const newIdxs = qcmCorrectIndexes.filter(i => i < newOpts.length);
                      if (newIdxs.length === 0) newIdxs.push(0);
                      setQcmOptions(newOpts);
                      setQcmCorrectIndexes(newIdxs);
                      setAnswer(newIdxs.map(i => newOpts[i]).filter(Boolean).join(', '));
                    }}
                  >
                    − Option
                  </button>
                  <button
                    type="button"
                    className="terminal-btn terminal-btn-success terminal-btn-sm"
                    disabled={qcmOptions.length >= QCM_MAX_OPTIONS}
                    onClick={() => setQcmOptions([...qcmOptions, ''])}
                  >
                    + Option
                  </button>
                </div>
              </div>
              {qcmOptions.map((opt, i) => {
                const isCorrect = qcmCorrectIndexes.includes(i);
                return (
                  <Form.Group key={i} className="mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <Form.Check
                        type="checkbox"
                        checked={isCorrect}
                        onChange={() => {
                          let newIdxs: number[];
                          if (isCorrect) {
                            newIdxs = qcmCorrectIndexes.filter(idx => idx !== i);
                            if (newIdxs.length === 0) return;
                          } else {
                            newIdxs = [...qcmCorrectIndexes, i].sort();
                          }
                          setQcmCorrectIndexes(newIdxs);
                          setAnswer(newIdxs.map(idx => qcmOptions[idx]).filter(Boolean).join(', '));
                        }}
                      />
                      <span style={{
                        fontWeight: 'bold',
                        color: isCorrect ? '#4CAF50' : 'inherit',
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
                          setAnswer(qcmCorrectIndexes.map(idx => idx === i ? e.target.value : newOpts[idx]).filter(Boolean).join(', '));
                        }}
                        style={{
                          borderColor: isCorrect ? '#4CAF50' : undefined,
                          borderWidth: isCorrect ? '2px' : undefined,
                        }}
                      />
                      {isCorrect && <span className="terminal-badge terminal-badge-success">Correcte</span>}
                    </div>
                  </Form.Group>
                );
              })}
            </div>
          )}

          <button
            type="submit"
            className="terminal-btn w-100"
            disabled={submitting}
            style={{ padding: '0.7rem 1rem', fontSize: '0.85rem' }}
          >
            {submitting && <Spinner animation="border" size="sm" className="me-2" />}
            <FontAwesomeIcon icon={['fas', 'paper-plane']} className="me-2" />
            Proposer la question
          </button>
        </Form>
      )}

      {/* ==================== Tab: Ajout en masse ==================== */}
      {tab === 'bulk' && (
        <div>
          <Form.Group className="mb-3">
            <Form.Label>Boîte de destination (optionnel)</Form.Label>
            <Form.Select
              value={bulkBox}
              onChange={(e) => setBulkBox(e.target.value)}
            >
              <option value="">L'admin choisira</option>
              {childlessBoxes.map(box => (
                <option key={box.name} value={box.name}>{box.name}</option>
              ))}
            </Form.Select>
          </Form.Group>


          {!isAdmin && (
            <div className="terminal-alert terminal-alert-warning py-2 mb-3" style={{ fontSize: '0.8rem' }}>
              <FontAwesomeIcon icon={['fas', 'info-circle']} className="me-2" />
              Limite : <strong>100 questions par minute</strong>. Au-delà, les envois suivants échouent (réessaie après 1 min).
            </div>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Questions (format Q:/R:/ALT: ou QCM A:/B:/.../F:)</Form.Label>
            <Form.Control
              as="textarea"
              rows={12}
              placeholder={`Q: Paris est la capitale de la France ?\nA: FAUX\nB: VRAIS\nR: B\n\nQ: Lesquels sont des langages de programmation ?\nA: Python\nB: Cobra\nC: Java\nD: Espresso\nR: A,C\n\nQ: Qui a peint la Joconde ?\nR: Léonard de Vinci\nALT: De Vinci, Vinci, etc..`}
              value={bulkText}
              onChange={(e) => { setBulkText(e.target.value); setBulkPreview(null); }}
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
          </Form.Group>

          <div className="d-flex gap-2 mb-3">
            <button className="terminal-btn terminal-btn-sm" onClick={handleBulkPreview} disabled={!bulkText.trim()}>
              Prévisualiser
            </button>
          </div>

          {bulkPreview && (
            <div className="mb-3">
              {bulkPreview.questions.length > 0 && (
                <div className="terminal-alert terminal-alert-success mb-2">{bulkPreview.questions.length} question(s) détectée(s)</div>
              )}
              {bulkPreview.errors.length > 0 && (
                <div className="terminal-alert terminal-alert-warning mb-2">
                  {bulkPreview.errors.map((err, i) => <div key={i}>{err}</div>)}
                </div>
              )}
              {bulkPreview.questions.length > 0 && (
                <div className="terminal-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '13px' }}>
                  {bulkPreview.questions.map((q, i) => (
                    <div key={i} className="mb-2 p-2 terminal-panel" style={{ fontSize: '0.8rem' }}>
                      <strong>Q:</strong> {q.question}
                      {q.isQcm && <span className="terminal-badge terminal-badge-cyan ms-2">QCM</span>}
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

          <button
            className="terminal-btn w-100"
            disabled={bulkSubmitting || !bulkText.trim()}
            onClick={handleBulkSubmit}
            style={{ padding: '0.7rem 1rem', fontSize: '0.85rem' }}
          >
            {bulkSubmitting && <Spinner animation="border" size="sm" className="me-2" />}
            <FontAwesomeIcon icon={['fas', 'paper-plane']} className="me-2" />
            Proposer {bulkPreview ? `(${bulkPreview.questions.length})` : ''} question(s)
          </button>
        </div>
      )}
    </div>
  );
};

export default ContributionPage;
