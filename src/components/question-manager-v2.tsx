import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Button, Form, Modal, Table, Badge, Tabs, Tab, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { categoryColors, categoryNames, Question, TrivialCategory, useQuestionsStore } from './store/questions-store';
import { useGlobalStore } from './store/global-store';

const QuestionManager = () => {
  const navigate = useNavigate();
  const globalStore = useGlobalStore();
  const questionsStore = useQuestionsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [selectedBox, setSelectedBox] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<TrivialCategory | 'all'>('all');
  const [importSuccess, setImportSuccess] = useState<string>('');
  const [importError, setImportError] = useState<string>('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    alternativeAnswers: '',
    category: TrivialCategory.Geography,
    boxName: '',
    cardNumber: undefined as number | undefined,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
  });

  // Gestion des boîtes
  const [showBoxModal, setShowBoxModal] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');

  // Sélection multiple
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'delete' | 'move' | null>(null);
  const [bulkMoveTargetBox, setBulkMoveTargetBox] = useState<string>('');

  useEffect(() => {
    globalStore.setSubtitle('Gestion des questions');
  }, []);

  // Détection des doublons
  const findDuplicates = () => {
    const duplicates: { question: string; box: string; count: number; ids: string[]; originalQuestions: Question[] }[] = [];
    const questionMap = new Map<string, { count: number; ids: string[]; questions: Question[] }>();

    // Grouper par question (insensible à la casse et aux espaces)
    questionsStore.questions.forEach(q => {
      const normalizedQuestion = q.question.toLowerCase().trim();
      const key = `${normalizedQuestion}|${q.boxName}`; // Inclure la boîte dans la clé

      if (questionMap.has(key)) {
        const existing = questionMap.get(key)!;
        existing.count++;
        existing.ids.push(q.id);
        existing.questions.push(q);
      } else {
        questionMap.set(key, { count: 1, ids: [q.id], questions: [q] });
      }
    });

    // Filtrer pour ne garder que les doublons
    questionMap.forEach((value, key) => {
      if (value.count > 1) {
        const [question, box] = key.split('|');
        duplicates.push({
          question,
          box,
          count: value.count,
          ids: value.ids,
          originalQuestions: value.questions
        });
      }
    });

    return duplicates;
  };

  const handleCheckDuplicates = () => {
    const duplicates = findDuplicates();

    if (duplicates.length === 0) {
      setImportSuccess('✅ Aucun doublon détecté !');
      setTimeout(() => setImportSuccess(''), 3000);
      return;
    }

    // Créer un message détaillé
    let message = `⚠️ ${duplicates.length} question(s) en doublon détectée(s) :\n\n`;

    duplicates.slice(0, 5).forEach((dup, index) => {
      message += `${index + 1}. "${dup.question.substring(0, 60)}${dup.question.length > 60 ? '...' : ''}"\n`;
      message += `   Boîte: ${dup.box}\n`;
      message += `   Occurrences: ${dup.count}\n\n`;
    });

    if (duplicates.length > 5) {
      message += `... et ${duplicates.length - 5} autre(s)\n\n`;
    }

    message += 'Voulez-vous supprimer les doublons ?\n(garde seulement la première occurrence de chaque question)';

    if (!window.confirm(message)) {
      return;
    }

    // Utiliser la fonction optimisée du store
    const removedCount = questionsStore.removeDuplicates();

    setImportSuccess(`✅ ${removedCount} doublon(s) supprimé(s) !`);
    setTimeout(() => setImportSuccess(''), 5000);
  };

  // Fonction pour calculer le temps relatif
  const getRelativeTime = (isoDate: string | undefined): string => {
    if (!isoDate) return 'Jamais';

    const now = Date.now();
    const syncDate = new Date(isoDate).getTime();
    const diffMs = now - syncDate;

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `il y a ${days} jour${days > 1 ? 's' : ''}`;
    if (hours > 0) return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
    return 'à l\'instant';
  };

  // Synchronisation depuis GitHub
  const handleSyncFromGitHub = async () => {
    try {
      setImportSuccess('🔄 Synchronisation avec GitHub en cours...');
      await questionsStore.loadFromGitHub();

      if (questionsStore.syncStatus === 'success') {
        setImportSuccess('✅ Synchronisation GitHub réussie !');
        setTimeout(() => setImportSuccess(''), 5000);
      } else {
        setImportError('❌ Erreur lors de la synchronisation GitHub');
        setTimeout(() => setImportError(''), 5000);
      }
    } catch (error) {
      setImportError('❌ Erreur lors de la synchronisation GitHub');
      setTimeout(() => setImportError(''), 5000);
    }
  };

  // Filtrage robuste en cascade - source unique de vérité
  const filteredQuestions = useMemo(() => {
    // 1. On part de toutes les questions brutes du store
    let result = [...questionsStore.questions];

    // 2. On applique le filtre de BOÎTE de manière stricte
    if (selectedBox && selectedBox.trim()) {
      result = result.filter(q => q.boxName === selectedBox);
    }

    // 3. On applique le filtre de CATÉGORIE
    if (filterCategory !== 'all') {
      result = result.filter(q => q.category === filterCategory);
    }

    // 4. Tri alphabétique par boxName, puis par cardNumber, puis par category
    result.sort((a, b) => {
      // D'abord par boxName (alphabétique français)
      const boxCompare = a.boxName.toLowerCase().localeCompare(b.boxName.toLowerCase(), 'fr', { sensitivity: 'base' });
      if (boxCompare !== 0) return boxCompare;

      // Ensuite par cardNumber (si présent)
      const cardA = a.cardNumber ?? 0;
      const cardB = b.cardNumber ?? 0;
      if (cardA !== cardB) return cardA - cardB;

      // Enfin par catégorie
      return a.category - b.category;
    });

    return result;
  }, [selectedBox, filterCategory, questionsStore.questions]);

  // Si besoin de allQuestions pour d'autres calculs (stats, etc.)
  const allQuestions = useMemo(() => {
    if (!selectedBox || !selectedBox.trim()) return questionsStore.questions;
    return questionsStore.questions.filter(q => q.boxName === selectedBox);
  }, [selectedBox, questionsStore.questions]);

  // Export JSON
  const handleExport = () => {
    const exportData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      boxes: questionsStore.boxes,
      questions: questionsStore.questions,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `questions.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import JSON (multiple files support)
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    let totalImported = 0;
    let totalSkipped = 0;
    let totalBoxesAdded = 0;
    let errorFiles: string[] = [];

    // Traiter chaque fichier
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });

        const data = JSON.parse(content);

        // Validation basique
        if (!data.questions || !Array.isArray(data.questions)) {
          errorFiles.push(`${file.name}: format non reconnu`);
          continue;
        }

        // Import des boîtes si présentes (v2)
        if (data.boxes && Array.isArray(data.boxes)) {
          data.boxes.forEach((box: any) => {
            if (!questionsStore.boxes.find(b => b.name === box.name)) {
              questionsStore.addBox(box.name);
              totalBoxesAdded++;
            }
          });
        }

        // Import des boîtes depuis trivialBoxes (v1.0)
        if (data.trivialBoxes && Array.isArray(data.trivialBoxes)) {
          data.trivialBoxes.forEach((boxName: string) => {
            if (!questionsStore.boxes.find(b => b.name === boxName)) {
              questionsStore.addBox(boxName);
              totalBoxesAdded++;
            }
          });
        }

        // Import des questions
        let fileImportedCount = 0;
        data.questions.forEach((q: any) => {
          // Normaliser le format : v1.0 utilise 'trivialBox', v2.0 utilise 'boxName'
          const normalizedQuestion: Question = {
            ...q,
            boxName: q.boxName || q.trivialBox || 'Sans boîte',
          };

          // Supprimer l'ancien champ trivialBox s'il existe
          if ('trivialBox' in normalizedQuestion) {
            delete (normalizedQuestion as any).trivialBox;
          }

          // Vérifier que la question n'existe pas déjà
          const exists = questionsStore.questions.find(existing =>
            existing.question === normalizedQuestion.question && existing.boxName === normalizedQuestion.boxName
          );

          if (!exists) {
            questionsStore.addQuestion(normalizedQuestion);
            fileImportedCount++;
            totalImported++;
          } else {
            totalSkipped++;
          }
        });

      } catch (error) {
        errorFiles.push(`${file.name}: ${error instanceof Error ? error.message : 'erreur inconnue'}`);
      }
    }

    // Afficher le résumé
    if (totalImported > 0 || totalBoxesAdded > 0) {
      let message = `✅ Import réussi :\n`;
      if (totalBoxesAdded > 0) {
        message += `• ${totalBoxesAdded} boîte(s) ajoutée(s)\n`;
      }
      message += `• ${totalImported} question(s) importée(s)`;
      if (totalSkipped > 0) {
        message += `\n• ${totalSkipped} doublon(s) ignoré(s)`;
      }
      if (files.length > 1) {
        message += `\n• ${files.length} fichier(s) traité(s)`;
      }

      setImportSuccess(message);
      setTimeout(() => setImportSuccess(''), 8000);
    }

    // Afficher les erreurs s'il y en a
    if (errorFiles.length > 0) {
      const errorMessage = `❌ Erreurs (${errorFiles.length} fichier(s)):\n${errorFiles.slice(0, 3).join('\n')}${errorFiles.length > 3 ? `\n... et ${errorFiles.length - 3} autre(s)` : ''}`;
      setImportError(errorMessage);
      setTimeout(() => setImportError(''), 8000);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenModal = (question?: Question) => {
    if (question) {
      setEditingQuestion(question);
      setFormData({
        question: question.question,
        answer: question.answer,
        alternativeAnswers: question.alternativeAnswers?.join(', ') || '',
        category: question.category,
        boxName: question.boxName,
        cardNumber: question.cardNumber,
        difficulty: question.difficulty || 'medium',
      });
    } else {
      setEditingQuestion(null);
      setFormData({
        question: '',
        answer: '',
        alternativeAnswers: '',
        category: TrivialCategory.Geography,
        boxName: selectedBox || questionsStore.getBoxes()[0]?.name || '',
        cardNumber: undefined,
        difficulty: 'medium',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingQuestion(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const alternativeAnswers = formData.alternativeAnswers
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);

    if (editingQuestion) {
      // Modification
      questionsStore.updateQuestion(editingQuestion.id, {
        question: formData.question,
        answer: formData.answer,
        alternativeAnswers: alternativeAnswers.length > 0 ? alternativeAnswers : undefined,
        category: formData.category,
        boxName: formData.boxName,
        cardNumber: formData.cardNumber,
        difficulty: formData.difficulty,
      });
    } else {
      // Création
      const newQuestion: Question = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        question: formData.question,
        answer: formData.answer,
        alternativeAnswers: alternativeAnswers.length > 0 ? alternativeAnswers : undefined,
        category: formData.category,
        boxName: formData.boxName,
        cardNumber: formData.cardNumber,
        difficulty: formData.difficulty,
      };
      questionsStore.addQuestion(newQuestion);
    }

    handleCloseModal();
  };

  const handleDeleteQuestion = (questionId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette question ?')) {
      questionsStore.deleteQuestion(questionId);
    }
  };

  const handleAddBox = () => {
    if (newBoxName.trim()) {
      questionsStore.addBox(newBoxName.trim());
      setNewBoxName('');
      setShowBoxModal(false);
    }
  };

  const handleDeleteBox = (boxName: string) => {
    const box = questionsStore.getBoxByName(boxName);
    if (!box) return;

    if (!window.confirm(`Supprimer la boîte "${boxName}" et toutes ses ${box.totalQuestions} questions ?`)) {
      return;
    }

    questionsStore.removeBox(boxName);
  };

  const handleDeleteCard = (boxName: string, cardNumber: number) => {
    const cardQuestions = questionsStore.getQuestionsByCard(boxName, cardNumber);

    if (!window.confirm(`Supprimer la carte #${cardNumber} (${cardQuestions.length} questions) ?`)) {
      return;
    }

    cardQuestions.forEach(q => {
      questionsStore.deleteQuestion(q.id);
    });
  };

  const getCategoryCountsForCard = (questions: Question[]): Record<TrivialCategory, number> => {
    const counts: Record<TrivialCategory, number> = {
      [TrivialCategory.Geography]: 0,
      [TrivialCategory.Entertainment]: 0,
      [TrivialCategory.History]: 0,
      [TrivialCategory.Arts]: 0,
      [TrivialCategory.Science]: 0,
      [TrivialCategory.Sports]: 0,
    };

    questions.forEach(q => {
      counts[q.category]++;
    });

    return counts;
  };

  // Gestion de la sélection multiple
  const handleToggleQuestion = (questionId: string) => {
    setSelectedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedQuestions.size === filteredQuestions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(filteredQuestions.map(q => q.id)));
    }
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Supprimer ${selectedQuestions.size} question(s) sélectionnée(s) ?`)) {
      return;
    }

    selectedQuestions.forEach(id => {
      questionsStore.deleteQuestion(id);
    });

    // Vérifier si la boîte actuelle est maintenant vide
    const remainingQuestions = questionsStore.getQuestionsByBox(selectedBox);
    if (selectedBox && remainingQuestions.length === 0) {
      // Si la boîte est vide, revenir à "Toutes les boîtes"
      setSelectedBox('');
    }

    setSelectedQuestions(new Set());
    setShowBulkActionsModal(false);
  };

  const handleBulkMove = () => {
    if (!bulkMoveTargetBox) {
      alert('Veuillez sélectionner une boîte de destination');
      return;
    }

    selectedQuestions.forEach(id => {
      questionsStore.updateQuestion(id, { boxName: bulkMoveTargetBox });
    });

    // Vérifier si la boîte actuelle est maintenant vide
    const remainingQuestions = questionsStore.getQuestionsByBox(selectedBox);
    if (selectedBox && remainingQuestions.length === 0) {
      // Si la boîte est vide, revenir à "Toutes les boîtes"
      setSelectedBox('');
    }

    setSelectedQuestions(new Set());
    setShowBulkActionsModal(false);
    setBulkMoveTargetBox('');
  };

  const handleOpenBulkActions = (action: 'delete' | 'move') => {
    setBulkAction(action);
    setShowBulkActionsModal(true);
  };

  return (
    <>
      {/* Alerts pour import */}
      {importSuccess && (
        <Alert variant="success" className="mb-3" dismissible onClose={() => setImportSuccess('')}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{importSuccess}</pre>
        </Alert>
      )}
      {importError && (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setImportError('')}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{importError}</pre>
        </Alert>
      )}

      {/* Input caché pour import multiple */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        multiple
        style={{ display: 'none' }}
        onChange={handleImport}
      />

      {/* Modal de gestion des boîtes */}
      <Modal show={showBoxModal} onHide={() => setShowBoxModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Nouvelle boîte</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Nom de la boîte</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex: Cinéma 91, Histoire..."
              value={newBoxName}
              onChange={(e) => setNewBoxName(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBoxModal(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleAddBox}>
            Ajouter
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal d'édition de question */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg" centered>
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
                {questionsStore.getBoxes().map(box => (
                  <option key={box.name} value={box.name}>{box.name}</option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Numéro de carte (optionnel)</Form.Label>
              <Form.Control
                type="number"
                min="1"
                placeholder="Laissez vide pour question hors carte"
                value={formData.cardNumber || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  cardNumber: e.target.value ? parseInt(e.target.value) : undefined
                })}
              />
              <Form.Text className="text-muted">
                Pour mode CARTE, chaque carte doit avoir exactement 6 questions (1 par catégorie)
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Catégorie *</Form.Label>
              <Form.Select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: parseInt(e.target.value) as TrivialCategory })}
              >
                {Object.entries(categoryNames).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
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
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Annuler
            </Button>
            <Button variant="primary" type="submit">
              {editingQuestion ? 'Modifier' : 'Ajouter'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal d'actions de masse */}
      <Modal show={showBulkActionsModal} onHide={() => setShowBulkActionsModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {bulkAction === 'delete' ? 'Supprimer les questions' : 'Changer de boîte'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {bulkAction === 'delete' ? (
            <p>
              Voulez-vous vraiment supprimer <strong>{selectedQuestions.size}</strong> question(s) ?
            </p>
          ) : (
            <Form.Group>
              <Form.Label>Boîte de destination</Form.Label>
              <Form.Select
                value={bulkMoveTargetBox}
                onChange={(e) => setBulkMoveTargetBox(e.target.value)}
              >
                <option value="">Sélectionner une boîte...</option>
                {questionsStore.getBoxes().map(box => (
                  <option key={box.name} value={box.name}>{box.name}</option>
                ))}
              </Form.Select>
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkActionsModal(false)}>
            Annuler
          </Button>
          <Button
            variant={bulkAction === 'delete' ? 'danger' : 'primary'}
            onClick={bulkAction === 'delete' ? handleBulkDelete : handleBulkMove}
          >
            {bulkAction === 'delete' ? 'Supprimer' : 'Déplacer'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Interface principale */}
      <div className="mb-3 d-flex justify-content-between">
        <Button onClick={() => navigate('/quiz')}>
          <FontAwesomeIcon icon={['fas', 'arrow-left']} /> Retour au quiz
        </Button>
        <div>
          <Button variant="primary" className="me-2" onClick={handleSyncFromGitHub}>
            <FontAwesomeIcon icon={['fas', 'sync']} /> Sync GitHub
          </Button>
          <Button variant="warning" className="me-2" onClick={handleCheckDuplicates}>
            <FontAwesomeIcon icon={['fas', 'search']} /> Vérifier doublons
          </Button>
          <Button variant="success" className="me-2" onClick={handleExport}>
            <FontAwesomeIcon icon={['fas', 'download']} /> Exporter Questions
          </Button>
          <Button variant="info" className="me-2" onClick={() => fileInputRef.current?.click()}>
            <FontAwesomeIcon icon={['fas', 'upload']} /> Importer Questions
          </Button>
        </div>
      </div>

      {/* Indicateur de statut de synchronisation */}
      <div className="mb-3">
        <Alert variant={questionsStore.syncStatus === 'success' ? 'success' : questionsStore.syncStatus === 'error' ? 'danger' : questionsStore.syncStatus === 'loading' ? 'info' : 'secondary'} className="py-2">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              {questionsStore.syncStatus === 'loading' && (
                <>
                  <FontAwesomeIcon icon={['fas', 'sync']} spin className="me-2" />
                  <strong>Synchronisation en cours...</strong>
                </>
              )}
              {questionsStore.syncStatus === 'success' && (
                <>
                  <FontAwesomeIcon icon={['fas', 'check-circle']} className="me-2" />
                  <strong>Synchronisé avec GitHub</strong>
                </>
              )}
              {questionsStore.syncStatus === 'error' && (
                <>
                  <FontAwesomeIcon icon={['fas', 'exclamation-triangle']} className="me-2" />
                  <strong>Erreur lors de la dernière synchronisation</strong>
                </>
              )}
              {questionsStore.syncStatus === 'idle' && (
                <>
                  <FontAwesomeIcon icon={['fas', 'info-circle']} className="me-2" />
                  <strong>Prêt à synchroniser</strong>
                </>
              )}
            </div>
            <div className="text-muted small">
              {questionsStore.lastGitHubSync && (
                <>
                  Dernière sync: {getRelativeTime(questionsStore.lastGitHubSync)}
                  <span className="ms-2">({questionsStore.questions.length} questions)</span>
                </>
              )}
              {!questionsStore.lastGitHubSync && (
                <span>Aucune synchronisation effectuée</span>
              )}
            </div>
          </div>
        </Alert>
      </div>

      <Tabs defaultActiveKey="boxes" className="mb-3">
        <Tab eventKey="boxes" title="📦 Boîtes">
          <div className="mb-3 d-flex justify-content-between">
            <Button onClick={() => setShowBoxModal(true)}>
              <FontAwesomeIcon icon={['fas', 'plus']} /> Nouvelle boîte
            </Button>
            <div>
              <Form.Select
                style={{ width: '250px' }}
                value={selectedBox}
                onChange={(e) => setSelectedBox(e.target.value)}
              >
                <option value="">Toutes les boîtes</option>
                {questionsStore.getBoxes().map(box => (
                  <option key={box.name} value={box.name}>
                    {box.name} ({box.totalQuestions} questions)
                  </option>
                ))}
              </Form.Select>
            </div>
          </div>

          {questionsStore.getBoxes().length === 0 ? (
            <div className="text-center p-5">
              <FontAwesomeIcon icon={['fas', 'box']} size="3x" color="var(--alt-text-color)" />
              <p className="mt-3 text-muted">Aucune boîte. Créez votre première boîte et importez des cartes.</p>
            </div>
          ) : (
            <div className="row">
              {(selectedBox ? questionsStore.getBoxes().filter(b => b.name === selectedBox) : questionsStore.getBoxes()).map(box => (
                <div key={box.name} className="col-md-6 mb-3">
                  <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <h5 className="mb-0">
                        <FontAwesomeIcon icon={['fas', 'box']} className="me-2" />
                        {box.name}
                      </h5>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => handleDeleteBox(box.name)}
                      >
                        <FontAwesomeIcon icon={['fas', 'trash']} />
                      </Button>
                    </div>
                    <div className="card-body">
                      {/* Statistiques */}
                      <div className="mb-3">
                        <Badge bg="primary" className="me-2">
                          {box.cardNumbers.length} carte{box.cardNumbers.length > 1 ? 's' : ''}
                        </Badge>
                        <Badge bg="secondary">
                          {box.totalQuestions} question{box.totalQuestions > 1 ? 's' : ''}
                        </Badge>
                      </div>

                      {/* Liste des cartes */}
                      <h6 className="mb-2">Cartes disponibles :</h6>
                      <div className="d-flex flex-wrap gap-2 mb-3">
                        {box.cardNumbers.length > 0 ? (
                          box.cardNumbers.map(cardNum => {
                            const cardQuestions = questionsStore.getQuestionsByCard(box.name, cardNum);
                            const categoryCounts = getCategoryCountsForCard(cardQuestions);
                            const isComplete = Object.values(categoryCounts).every(c => c === 1);

                            return (
                              <div
                                key={cardNum}
                                className={`border rounded p-2 ${isComplete ? 'border-success' : 'border-warning'}`}
                                style={{ width: '120px', cursor: 'pointer' }}
                                onClick={() => setExpandedCard(expandedCard === `${box.name}-${cardNum}` ? null : `${box.name}-${cardNum}`)}
                              >
                                <div className="d-flex justify-content-between align-items-center">
                                  <strong>Carte #{cardNum}</strong>
                                  {isComplete ? (
                                    <Badge bg="success">✓</Badge>
                                  ) : (
                                    <Badge bg="warning">{cardQuestions.length}/6</Badge>
                                  )}
                                </div>

                                {/* Détails de la carte (si expanded) */}
                                {expandedCard === `${box.name}-${cardNum}` && (
                                  <div className="mt-2" style={{ fontSize: '12px' }}>
                                    {Object.entries(categoryNames).map(([key, name]) => {
                                      const count = categoryCounts[parseInt(key) as TrivialCategory];
                                      return (
                                        <div key={key} className="d-flex justify-content-between">
                                          <span
                                            style={{
                                              color: categoryColors[parseInt(key) as TrivialCategory],
                                              fontWeight: count > 0 ? 'bold' : 'normal'
                                            }}
                                          >
                                            {name.substring(0, 3)}
                                          </span>
                                          <span>{count > 0 ? '✓' : '✗'}</span>
                                        </div>
                                      );
                                    })}
                                    <Button
                                      size="sm"
                                      variant="outline-danger"
                                      className="mt-2 w-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteCard(box.name, cardNum);
                                      }}
                                    >
                                      <FontAwesomeIcon icon={['fas', 'trash']} /> Supprimer
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-muted">Aucune carte dans cette boîte</p>
                        )}
                      </div>

                      {/* Bouton pour ajouter une carte */}
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => navigate('/convertisseur')}
                      >
                        <FontAwesomeIcon icon={['fas', 'plus']} /> Ajouter une carte
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tab>

        <Tab eventKey="questions" title="📝 Toutes les questions">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <Form.Select
                style={{ width: '250px', display: 'inline-block' }}
                value={selectedBox}
                onChange={(e) => setSelectedBox(e.target.value)}
              >
                <option value="">Toutes les boîtes</option>
                {questionsStore.getBoxes().map(box => (
                  <option key={box.name} value={box.name}>
                    {box.name} ({box.totalQuestions} questions)
                  </option>
                ))}
              </Form.Select>
              <Form.Select
                className="ms-2"
                style={{ width: '200px', display: 'inline-block' }}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value === 'all' ? 'all' : parseInt(e.target.value) as TrivialCategory)}
              >
                <option value="all">Toutes les catégories</option>
                {Object.entries(categoryNames).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </Form.Select>
            </div>
            <Button onClick={() => handleOpenModal()}>
              <FontAwesomeIcon icon={['fas', 'plus']} /> Nouvelle question
            </Button>
          </div>

          {/* Barre d'actions de masse */}
          {selectedQuestions.size > 0 && (
            <Alert variant="info" className="d-flex justify-content-between align-items-center">
              <span>
                <strong>{selectedQuestions.size}</strong> question(s) sélectionnée(s)
              </span>
              <div>
                <Button size="sm" variant="primary" className="me-2" onClick={() => handleOpenBulkActions('move')}>
                  <FontAwesomeIcon icon={['fas', 'box']} /> Changer de boîte
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleOpenBulkActions('delete')}>
                  <FontAwesomeIcon icon={['fas', 'trash']} /> Supprimer
                </Button>
              </div>
            </Alert>
          )}

          {filteredQuestions.length === 0 ? (
            <div className="text-center p-5">
              <FontAwesomeIcon icon={['fas', 'question']} size="3x" color="var(--alt-text-color)" />
              <p className="mt-3 text-muted">Aucune question. Commencez par ajouter une boîte Trivial Pursuit et des questions.</p>
            </div>
          ) : (
            <Table hover responsive>
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>
                    <Form.Check
                      type="checkbox"
                      checked={selectedQuestions.size === filteredQuestions.length && filteredQuestions.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th style={{ width: '12%' }}>Boîte</th>
                  <th style={{ width: '8%' }}>Carte #</th>
                  <th style={{ width: '12%' }}>Catégorie</th>
                  <th style={{ width: '30%' }}>Question</th>
                  <th style={{ width: '20%' }}>Réponse</th>
                  <th style={{ width: '13%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.map(question => (
                  <tr key={question.id}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        checked={selectedQuestions.has(question.id)}
                        onChange={() => handleToggleQuestion(question.id)}
                      />
                    </td>
                    <td><Badge bg="secondary">{question.boxName}</Badge></td>
                    <td>
                      {question.cardNumber !== undefined ? (
                        <Badge bg="info">#{question.cardNumber}</Badge>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <Badge
                        bg=""
                        style={{
                          backgroundColor: categoryColors[question.category],
                          color: 'white',
                          fontWeight: 'bold',
                          border: '2px solid rgba(0,0,0,0.2)'
                        }}
                      >
                        {categoryNames[question.category]}
                      </Badge>
                    </td>
                    <td>{question.question}</td>
                    <td>
                      <strong>{question.answer}</strong>
                      {question.alternativeAnswers && question.alternativeAnswers.length > 0 && (
                        <div className="text-muted small">
                          Alt: {question.alternativeAnswers.join(', ')}
                        </div>
                      )}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-1"
                        onClick={() => handleOpenModal(question)}
                      >
                        <FontAwesomeIcon icon={['fas', 'edit']} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => handleDeleteQuestion(question.id)}
                      >
                        <FontAwesomeIcon icon={['fas', 'trash']} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Tab>
      </Tabs>
    </>
  );
};

export default QuestionManager;
