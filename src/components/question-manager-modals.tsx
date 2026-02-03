import React, { useState, useEffect } from 'react';
import { Button, Form, Modal, Badge } from 'react-bootstrap';
import { Question, QuestionType, TrivialCategory, categoryNames } from './store/questions-store';

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
}

interface QuestionModalProps {
  show: boolean;
  onHide: () => void;
  onSubmit: (data: QuestionFormData, isEdit: boolean, editId?: string) => void;
  editingQuestion: Question | null;
  boxes: { name: string }[];
  defaultBoxName: string;
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
  qcmOptions: ['', '', '', ''],
  qcmCorrectIndex: 0,
};

export const QuestionModal: React.FC<QuestionModalProps> = React.memo(({
  show,
  onHide,
  onSubmit,
  editingQuestion,
  boxes,
  defaultBoxName
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
          qcmOptions: editingQuestion.qcmOptions || ['', '', '', ''],
          qcmCorrectIndex: editingQuestion.qcmCorrectIndex ?? 0,
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
      if (filledOptions.length !== 4) {
        alert('⚠️ Pour une question QCM, les 4 options doivent être remplies');
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
                  4 choix (A, B, C, D)
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
              <h6 className="mb-3">📋 Options QCM</h6>
              <p className="text-muted small mb-3">
                Les viewers répondront avec A, B, C ou D dans le chat
              </p>
              {['A', 'B', 'C', 'D'].map((letter, index) => (
                <Form.Group key={letter} className="mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="radio"
                      name="qcmCorrect"
                      checked={formData.qcmCorrectIndex === index}
                      onChange={() => {
                        setFormData({
                          ...formData,
                          qcmCorrectIndex: index,
                          answer: formData.qcmOptions[index] || formData.answer
                        });
                      }}
                      title="Réponse correcte"
                    />
                    <span style={{ fontWeight: 'bold', color: formData.qcmCorrectIndex === index ? '#4CAF50' : 'inherit', minWidth: '25px' }}>
                      {letter})
                    </span>
                    <Form.Control
                      type="text"
                      placeholder={`Option ${letter}`}
                      value={formData.qcmOptions[index]}
                      onChange={(e) => {
                        const newOptions = [...formData.qcmOptions];
                        newOptions[index] = e.target.value;
                        const newAnswer = formData.qcmCorrectIndex === index ? e.target.value : formData.answer;
                        setFormData({ ...formData, qcmOptions: newOptions, answer: newAnswer });
                      }}
                      style={{
                        borderColor: formData.qcmCorrectIndex === index ? '#4CAF50' : undefined,
                        borderWidth: formData.qcmCorrectIndex === index ? '2px' : undefined
                      }}
                    />
                    {formData.qcmCorrectIndex === index && (
                      <Badge bg="success">✓ Correcte</Badge>
                    )}
                  </div>
                </Form.Group>
              ))}
              <Form.Text className="text-muted">
                Sélectionnez le bouton radio pour indiquer la bonne réponse
              </Form.Text>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Annuler
          </Button>
          <Button variant="primary" type="submit">
            {editingQuestion ? 'Modifier' : 'Ajouter'}
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
