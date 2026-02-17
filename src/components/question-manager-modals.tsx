import React, { useState, useEffect } from 'react';
import { Button, Form, Modal, Badge, Alert } from 'react-bootstrap';
import { Question, QuestionType, TrivialCategory, categoryNames } from './store/questions-store';

// Labels et limites QCM
const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const QCM_MIN_OPTIONS = 2;
const QCM_MAX_OPTIONS = 6;

// ============================================================
// Types
// ============================================================

interface BoxModalProps {
  show: boolean;
  onHide: () => void;
  onAdd: (name: string) => void;
}

interface QuestionFormData {
  question: string;
  answer: string;
  alternativeAnswers: string;
  category: TrivialCategory;
  boxName: string;
  cardNumber: number | undefined;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: QuestionType;
  qcmOptions: string[];
  qcmCorrectIndex: number;
  qcmCorrectIndexes: number[];
}

interface QuestionModalProps {
  show: boolean;
  onHide: () => void;
  onSubmit: (data: QuestionFormData, isEdit: boolean, editId?: string) => void;
  editingQuestion: Question | null;
  boxes: { name: string }[];
  defaultBoxName: string;
  /** Si true, le bouton affiche "Ajouter directement" au lieu de "Proposer" */
  isAdmin?: boolean;
  /** Callback alternatif pour soumettre en mode public (modération) */
  onSubmitPublic?: (data: QuestionFormData) => void;
}

interface BulkActionsModalProps {
  show: boolean;
  onHide: () => void;
  action: 'delete' | 'move' | null;
  selectedCount: number;
  boxes: { name: string }[];
  onDelete: () => void;
  onMove: (targetBox: string) => void;
}

export interface ParsedBulkQuestion {
  question: string;
  answer: string;
  alternativeAnswers: string[];
  isQcm?: boolean;
  qcmOptions?: string[];
  qcmCorrectIndex?: number;
  qcmCorrectIndexes?: number[];
}

interface BulkAddModalProps {
  show: boolean;
  onHide: () => void;
  onSubmit: (questions: ParsedBulkQuestion[], boxName: string, randomCategories: boolean, fixedCategory?: TrivialCategory) => void;
  boxes: { name: string }[];
  defaultBoxName: string;
}

// ============================================================
// BoxModal - Modal pour créer une nouvelle boîte
// ============================================================

export const BoxModal: React.FC<BoxModalProps> = React.memo(({ show, onHide, onAdd }) => {
  const [name, setName] = useState('');

  // Reset quand la modal s'ouvre
  useEffect(() => {
    if (show) {
      setName('');
    }
  }, [show]);

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setName('');
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Nouvelle boîte</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group>
          <Form.Label>Nom de la boîte</Form.Label>
          <Form.Control
            type="text"
            placeholder="Ex: Cinéma 91, Histoire..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Annuler
        </Button>
        <Button variant="primary" onClick={handleSubmit}>
          Ajouter
        </Button>
      </Modal.Footer>
    </Modal>
  );
});

// ============================================================
// QuestionModal - Modal pour créer/éditer une question
// ============================================================

const defaultFormData: QuestionFormData = {
  question: '',
  answer: '',
  alternativeAnswers: '',
  category: TrivialCategory.Geography,
  boxName: '',
  cardNumber: undefined,
  difficulty: 'medium',
  questionType: QuestionType.FREE_TEXT,
  qcmOptions: ['', ''],
  qcmCorrectIndex: 0,
  qcmCorrectIndexes: [0],
};

export const QuestionModal: React.FC<QuestionModalProps> = React.memo(({
  show,
  onHide,
  onSubmit,
  editingQuestion,
  boxes,
  defaultBoxName,
  isAdmin,
  onSubmitPublic,
}) => {
  const [formData, setFormData] = useState<QuestionFormData>(defaultFormData);

  // Initialiser le formulaire quand la modal s'ouvre
  useEffect(() => {
    if (show) {
      if (editingQuestion) {
        setFormData({
          question: editingQuestion.question,
          answer: editingQuestion.answer,
          alternativeAnswers: editingQuestion.alternativeAnswers?.join(', ') || '',
          category: editingQuestion.category,
          boxName: editingQuestion.boxName,
          cardNumber: editingQuestion.cardNumber,
          difficulty: editingQuestion.difficulty || 'medium',
          questionType: editingQuestion.questionType || QuestionType.FREE_TEXT,
          qcmOptions: editingQuestion.qcmOptions || ['', ''],
          qcmCorrectIndex: editingQuestion.qcmCorrectIndex ?? 0,
          qcmCorrectIndexes: editingQuestion.qcmCorrectIndexes ?? (editingQuestion.qcmCorrectIndex !== undefined ? [editingQuestion.qcmCorrectIndex] : [0]),
        });
      } else {
        setFormData({
          ...defaultFormData,
          boxName: defaultBoxName,
        });
      }
    }
  }, [show, editingQuestion, defaultBoxName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Valider QCM
    if (formData.questionType === QuestionType.QCM) {
      const filledOptions = formData.qcmOptions.filter(o => o.trim().length > 0);
      if (filledOptions.length < QCM_MIN_OPTIONS) {
        alert(`⚠️ Pour une question QCM, il faut au moins ${QCM_MIN_OPTIONS} options remplies`);
        return;
      }
      if (filledOptions.length !== formData.qcmOptions.length) {
        alert('⚠️ Toutes les options doivent être remplies. Supprimez les options vides.');
        return;
      }
    }

    onSubmit(formData, !!editingQuestion, editingQuestion?.id);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{editingQuestion ? 'Modifier la question' : 'Nouvelle question'}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Boîte Trivial Pursuit *</Form.Label>
            <Form.Select
              required
              value={formData.boxName}
              onChange={(e) => setFormData({ ...formData, boxName: e.target.value })}
            >
              <option value="">Sélectionner une boîte...</option>
              {boxes.map(box => (
                <option key={box.name} value={box.name}>{box.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Type de question */}
          <Form.Group className="mb-3">
            <Form.Label><strong>Type de question *</strong></Form.Label>
            <div className="d-flex gap-2">
              <Button
                type="button"
                variant={formData.questionType === QuestionType.FREE_TEXT ? 'primary' : 'outline-primary'}
                onClick={() => setFormData({ ...formData, questionType: QuestionType.FREE_TEXT })}
                className="flex-fill"
              >
                ✏️ Réponse libre
                <div style={{ fontSize: '11px', marginTop: '3px' }}>
                  Les viewers tapent leur réponse
                </div>
              </Button>
              <Button
                type="button"
                variant={formData.questionType === QuestionType.QCM ? 'primary' : 'outline-primary'}
                onClick={() => setFormData({ ...formData, questionType: QuestionType.QCM })}
                className="flex-fill"
              >
                📋 QCM
                <div style={{ fontSize: '11px', marginTop: '3px' }}>
                  2 à 6 choix (A-F)
                </div>
              </Button>
            </div>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Catégorie *</Form.Label>
            <Form.Select
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: parseInt(e.target.value) as TrivialCategory })}
            >
              {Object.entries(categoryNames).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Question *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              required
              placeholder="Entrez votre question..."
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Réponse *</Form.Label>
            <Form.Control
              type="text"
              required
              placeholder="Réponse correcte"
              value={formData.answer}
              onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
            />
          </Form.Group>

          {/* Réponses alternatives - uniquement pour réponse libre */}
          {formData.questionType === QuestionType.FREE_TEXT && (
            <Form.Group className="mb-3">
              <Form.Label>Réponses alternatives (optionnel)</Form.Label>
              <Form.Control
                type="text"
                placeholder="Séparez par des virgules : réponse1, réponse2"
                value={formData.alternativeAnswers}
                onChange={(e) => setFormData({ ...formData, alternativeAnswers: e.target.value })}
              />
              <Form.Text className="text-muted">
                Accepte aussi les variantes orthographiques grâce à la tolérance aux fautes
              </Form.Text>
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Difficulté</Form.Label>
            <Form.Select
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}
            >
              <option value="easy">Facile</option>
              <option value="medium">Moyen</option>
              <option value="hard">Difficile</option>
            </Form.Select>
          </Form.Group>

          {/* Options QCM */}
          {formData.questionType === QuestionType.QCM && (
            <div className="p-3 mb-3" style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '10px', border: '2px solid #ff60b7' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">📋 Options QCM ({formData.qcmOptions.length} options)</h6>
                <div className="d-flex gap-1">
                  <Button
                    type="button"
                    variant="outline-danger"
                    size="sm"
                    disabled={formData.qcmOptions.length <= QCM_MIN_OPTIONS}
                    onClick={() => {
                      const newOptions = formData.qcmOptions.slice(0, -1);
                      const newCorrectIndexes = formData.qcmCorrectIndexes
                        .filter(i => i < newOptions.length);
                      if (newCorrectIndexes.length === 0) newCorrectIndexes.push(0);
                      const newAnswer = newCorrectIndexes.map(i => newOptions[i]).filter(Boolean).join(', ');
                      setFormData({
                        ...formData,
                        qcmOptions: newOptions,
                        qcmCorrectIndex: newCorrectIndexes[0],
                        qcmCorrectIndexes: newCorrectIndexes,
                        answer: newAnswer || formData.answer
                      });
                    }}
                    title="Supprimer la dernière option"
                  >
                    − Option
                  </Button>
                  <Button
                    type="button"
                    variant="outline-success"
                    size="sm"
                    disabled={formData.qcmOptions.length >= QCM_MAX_OPTIONS}
                    onClick={() => {
                      setFormData({
                        ...formData,
                        qcmOptions: [...formData.qcmOptions, '']
                      });
                    }}
                    title="Ajouter une option"
                  >
                    + Option
                  </Button>
                </div>
              </div>
              <p className="text-muted small mb-3">
                {formData.qcmCorrectIndexes.length > 1
                  ? `Les viewers répondront avec les lettres correctes (ex: ${formData.qcmCorrectIndexes.map(i => QCM_LABELS[i]).join(',')}) dans le chat`
                  : `Les viewers répondront avec ${formData.qcmOptions.map((_, i) => QCM_LABELS[i]).join(', ')} dans le chat`
                }
              </p>
              {formData.qcmOptions.map((option, index) => {
                const isCorrect = formData.qcmCorrectIndexes.includes(index);
                return (
                  <Form.Group key={index} className="mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <Form.Check
                        type="checkbox"
                        checked={isCorrect}
                        onChange={() => {
                          let newIndexes: number[];
                          if (isCorrect) {
                            newIndexes = formData.qcmCorrectIndexes.filter(i => i !== index);
                            if (newIndexes.length === 0) return; // Au moins 1 réponse correcte
                          } else {
                            newIndexes = [...formData.qcmCorrectIndexes, index].sort();
                          }
                          const newAnswer = newIndexes.map(i => formData.qcmOptions[i]).filter(Boolean).join(', ');
                          setFormData({
                            ...formData,
                            qcmCorrectIndex: newIndexes[0],
                            qcmCorrectIndexes: newIndexes,
                            answer: newAnswer || formData.answer
                          });
                        }}
                        title="Réponse correcte"
                      />
                      <span style={{ fontWeight: 'bold', color: isCorrect ? '#4CAF50' : 'inherit', minWidth: '25px' }}>
                        {QCM_LABELS[index]})
                      </span>
                      <Form.Control
                        type="text"
                        placeholder={`Option ${QCM_LABELS[index]}`}
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...formData.qcmOptions];
                          newOptions[index] = e.target.value;
                          const newAnswer = formData.qcmCorrectIndexes.map(i => newOptions[i]).filter(Boolean).join(', ');
                          setFormData({ ...formData, qcmOptions: newOptions, answer: newAnswer });
                        }}
                        style={{
                          borderColor: isCorrect ? '#4CAF50' : undefined,
                          borderWidth: isCorrect ? '2px' : undefined
                        }}
                      />
                      {isCorrect && (
                        <Badge bg="success">&#10003; Correcte</Badge>
                      )}
                    </div>
                  </Form.Group>
                );
              })}
              <Form.Text className="text-muted">
                Cochez les cases pour indiquer les bonnes réponses (une ou plusieurs)
              </Form.Text>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Annuler
          </Button>
          {/* Bouton "Proposer" pour les non-admins (envoi en modération) */}
          {!editingQuestion && onSubmitPublic && !isAdmin && (
            <Button variant="outline-primary" type="button" onClick={() => {
              if (formData.questionType === QuestionType.QCM) {
                const filledOptions = formData.qcmOptions.filter(o => o.trim().length > 0);
                if (filledOptions.length < QCM_MIN_OPTIONS || filledOptions.length !== formData.qcmOptions.length) return;
              }
              onSubmitPublic(formData);
            }}>
              Proposer (modération)
            </Button>
          )}
          <Button variant={isAdmin ? 'warning' : 'primary'} type="submit">
            {editingQuestion ? 'Modifier' : (isAdmin ? 'Ajouter directement' : 'Ajouter')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
});

// ============================================================
// BulkAddModal - Modal pour ajouter plusieurs questions en masse
// ============================================================

const BULK_ADD_PLACEHOLDER = `Q: Quelle est la capitale de la France ?
A: Lyon
B: Paris
C: Marseille
D: Bordeaux
R: B

Q: Lesquels sont des langages de programmation ?
A: Python
B: Cobra
C: Java
D: Espresso
R: A,C

Q: Qui a peint la Joconde ?
R: Léonard de Vinci
ALT: Leonard de Vinci
ALT: De Vinci , vinci`;

function parseBulkQuestions(text: string): { questions: ParsedBulkQuestion[]; errors: string[] } {
  const questions: ParsedBulkQuestion[] = [];
  const errors: string[] = [];

  // Séparer les blocs par les lignes "Q:" (chaque bloc commence par Q:)
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
      // Match QCM options: "A: texte", "B: texte", etc.
      const optMatch = line.match(/^([A-F])\s*:\s*(.+)/);

      if (qMatch) {
        question = qMatch[1].trim();
      } else if (altMatch) {
        // ALT: doit être testé avant optMatch (car "A:" matcherait aussi)
        // Support virgules : "ALT: réponse1, réponse2" → 2 alternatives
        const parts = altMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        alternativeAnswers.push(...parts);
      } else if (rMatch) {
        answer = rMatch[1].trim();
      } else if (optMatch) {
        qcmOptions[optMatch[1]] = optMatch[2].trim();
      }
    }

    if (!question && !answer) {
      continue;
    }

    if (!question) {
      errors.push(`Bloc ${i + 1} : question manquante (Q: ...)`);
      continue;
    }

    if (!answer) {
      errors.push(`Bloc ${i + 1} : réponse manquante (R: ...) pour "${question.substring(0, 40)}..."`);
      continue;
    }

    // Détecter si c'est un QCM : au moins 2 options A-F et réponse = lettre(s) valide(s)
    const optionKeys = QCM_LABELS.filter(l => qcmOptions[l]);
    // Extraire les lettres de la réponse : "B,D" / "BD" / "B D" / "B, D" → ['B', 'D']
    const answerLetters = answer.toUpperCase().split(/[\s,]+/).join('').split('').filter(c => QCM_LABELS.includes(c));
    const uniqueAnswerLetters = Array.from(new Set(answerLetters));
    const isQcm = optionKeys.length >= 2 && uniqueAnswerLetters.length > 0
      && uniqueAnswerLetters.every(l => qcmOptions[l]);

    if (isQcm) {
      const orderedOptions = optionKeys.map(l => qcmOptions[l]);
      const correctIndexes = uniqueAnswerLetters.map(l => optionKeys.indexOf(l)).filter(i => i >= 0).sort();
      const answerText = correctIndexes.map(i => orderedOptions[i]).join(', ');

      questions.push({
        question,
        answer: answerText,
        alternativeAnswers: [],
        isQcm: true,
        qcmOptions: orderedOptions,
        qcmCorrectIndex: correctIndexes[0],
        qcmCorrectIndexes: correctIndexes,
      });
    } else {
      questions.push({ question, answer, alternativeAnswers });
    }
  }

  return { questions, errors };
}

export const BulkAddModal: React.FC<BulkAddModalProps> = React.memo(({
  show,
  onHide,
  onSubmit,
  boxes,
  defaultBoxName
}) => {
  const [text, setText] = useState('');
  const [boxName, setBoxName] = useState('');
  const [randomCategories, setRandomCategories] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<TrivialCategory>(TrivialCategory.Geography);
  const [preview, setPreview] = useState<{ questions: ParsedBulkQuestion[]; errors: string[] } | null>(null);


  useEffect(() => {
    if (show) {
      setText('');
      setBoxName(defaultBoxName);
      setRandomCategories(true);
      setSelectedCategory(TrivialCategory.Geography);
      setPreview(null);
    }
  }, [show, defaultBoxName]);

  const handlePreview = () => {
    const result = parseBulkQuestions(text);
    setPreview(result);
  };

  const handleSubmit = () => {
    if (!boxName) {
      alert('Veuillez sélectionner une boîte');
      return;
    }

    const result = preview || parseBulkQuestions(text);

    if (result.questions.length === 0) {
      alert('Aucune question valide détectée');
      return;
    }

    onSubmit(result.questions, boxName, randomCategories, randomCategories ? undefined : selectedCategory);
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Ajout en masse de questions</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Boîte de destination *</Form.Label>
          <Form.Select
            required
            value={boxName}
            onChange={(e) => setBoxName(e.target.value)}
          >
            <option value="">Sélectionner une boîte...</option>
            {boxes.map(box => (
              <option key={box.name} value={box.name}>{box.name}</option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check
            type="switch"
            id="randomCategories"
            label="Catégories aléatoires"
            checked={randomCategories}
            onChange={(e) => setRandomCategories(e.target.checked)}
          />
          {randomCategories ? (
            <Form.Text className="text-muted">
              Chaque question sera assignée à une catégorie Trivial Pursuit aléatoire
            </Form.Text>
          ) : (
            <div className="mt-2 p-2" style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Form.Label className="small mb-1">Catégorie pour toutes les questions</Form.Label>
              <Form.Select
                size="sm"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(parseInt(e.target.value) as TrivialCategory)}
              >
                {Object.entries(categoryNames).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </Form.Select>
            </div>
          )}
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Questions (format Q:/R:/ALT: ou QCM)</Form.Label>
          <Form.Control
            as="textarea"
            rows={12}
            placeholder={BULK_ADD_PLACEHOLDER}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null); // Reset preview on edit
            }}
            style={{ fontFamily: 'monospace', fontSize: '13px' }}
          />
          <Form.Text className="text-muted">
            Séparez chaque question par une ligne vide.<br />
            <strong>Texte libre :</strong> <code>Q:</code> question, <code>R:</code> réponse, <code>ALT:</code> alternative (optionnel)<br />
            <strong>QCM :</strong> <code>Q:</code> question, <code>A:</code> <code>B:</code> <code>C:</code> <code>D:</code> options, <code>R:</code> lettre(s) correcte(s) (ex: B ou A,C)
          </Form.Text>
        </Form.Group>

        <Button variant="outline-info" size="sm" onClick={handlePreview} disabled={!text.trim()}>
          Prévisualiser
        </Button>

        {preview && (
          <div className="mt-3">
            {preview.questions.length > 0 && (
              <Alert variant="success">
                {preview.questions.length} question(s) détectée(s)
              </Alert>
            )}
            {preview.errors.length > 0 && (
              <Alert variant="warning">
                {preview.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </Alert>
            )}
            {preview.questions.length > 0 && (
              <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '13px' }}>
                {preview.questions.map((q, i) => (
                  <div key={i} className="mb-2 p-2" style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '5px' }}>
                    <strong>Q:</strong> {q.question}
                    {q.isQcm && <Badge bg="info" className="ms-2">QCM</Badge>}
                    <br />
                    {q.isQcm && q.qcmOptions ? (
                      <>
                        {q.qcmOptions.map((opt, j) => {
                          const isCorrectPreview = (q.qcmCorrectIndexes || [q.qcmCorrectIndex]).includes(j);
                          return (
                            <span key={j}>
                              <span style={{ color: isCorrectPreview ? '#4CAF50' : 'inherit', fontWeight: isCorrectPreview ? 'bold' : 'normal' }}>
                                {String.fromCharCode(65 + j)}: {opt}
                                {isCorrectPreview && ' \u2713'}
                              </span>
                              <br />
                            </span>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        <strong>R:</strong> {q.answer}
                        {q.alternativeAnswers.length > 0 && (
                          <><br /><span className="text-muted">ALT: {q.alternativeAnswers.join(', ')}</span></>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Annuler
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!text.trim() || !boxName}
        >
          Ajouter {preview ? `(${preview.questions.length})` : ''}
        </Button>
      </Modal.Footer>
    </Modal>
  );
});

// ============================================================
// BulkActionsModal - Modal pour actions de masse
// ============================================================

export const BulkActionsModal: React.FC<BulkActionsModalProps> = React.memo(({
  show,
  onHide,
  action,
  selectedCount,
  boxes,
  onDelete,
  onMove
}) => {
  const [targetBox, setTargetBox] = useState('');

  useEffect(() => {
    if (show) {
      setTargetBox('');
    }
  }, [show]);

  const handleMove = () => {
    if (targetBox) {
      onMove(targetBox);
    } else {
      alert('Veuillez sélectionner une boîte de destination');
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {action === 'delete' ? 'Supprimer les questions' : 'Changer de boîte'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {action === 'delete' ? (
          <p>
            Voulez-vous vraiment supprimer <strong>{selectedCount}</strong> question(s) ?
          </p>
        ) : (
          <Form.Group>
            <Form.Label>Boîte de destination</Form.Label>
            <Form.Select
              value={targetBox}
              onChange={(e) => setTargetBox(e.target.value)}
            >
              <option value="">Sélectionner une boîte...</option>
              {boxes.map(box => (
                <option key={box.name} value={box.name}>{box.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Annuler
        </Button>
        <Button
          variant={action === 'delete' ? 'danger' : 'primary'}
          onClick={action === 'delete' ? onDelete : handleMove}
        >
          {action === 'delete' ? 'Supprimer' : 'Déplacer'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
});
