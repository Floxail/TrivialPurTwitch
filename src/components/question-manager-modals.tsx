import React, { useState, useEffect } from 'react';
import { Button, Form, Modal, Badge } from 'react-bootstrap';
import { Question, QuestionType } from './store/questions-store';

// Labels et limites QCM
const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const QCM_MIN_OPTIONS = 2;
const QCM_MAX_OPTIONS = 6;

// ============================================================
// Types
// ============================================================

interface QuestionFormData {
  question: string;
  answer: string;
  alternativeAnswers: string;
  boxName: string;
  cardNumber: number | undefined;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: QuestionType;
  qcmOptions: string[];
  qcmCorrectIndex: number;
  qcmCorrectIndexes: number[];
  imageUrl: string;
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

// ============================================================
// QuestionModal - Modal pour créer/éditer une question
// ============================================================

const defaultFormData: QuestionFormData = {
  question: '',
  answer: '',
  alternativeAnswers: '',
  boxName: '',
  cardNumber: undefined,
  difficulty: 'medium',
  questionType: QuestionType.FREE_TEXT,
  qcmOptions: ['', ''],
  qcmCorrectIndex: 0,
  qcmCorrectIndexes: [0],
  imageUrl: '',
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
          boxName: editingQuestion.boxName,
          cardNumber: editingQuestion.cardNumber,
          difficulty: editingQuestion.difficulty || 'medium',
          questionType: editingQuestion.questionType || QuestionType.FREE_TEXT,
          qcmOptions: editingQuestion.qcmOptions || ['', ''],
          qcmCorrectIndex: editingQuestion.qcmCorrectIndex ?? 0,
          qcmCorrectIndexes: editingQuestion.qcmCorrectIndexes ?? (editingQuestion.qcmCorrectIndex !== undefined ? [editingQuestion.qcmCorrectIndex] : [0]),
          imageUrl: editingQuestion.imageUrl || '',
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

          <Form.Group className="mb-3">
            <Form.Label>URL de l'image (Optionnel)</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex: lien Discord ou Imgur (https://i.imgur.com/...)"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
            />
            <Form.Text className="text-muted">
              L'image sera affichée sous la question pendant le quiz
            </Form.Text>
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
