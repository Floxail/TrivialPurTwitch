import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Button, Form, Table, Badge, Tabs, Tab, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { categoryColors, categoryNames, Question, QuestionType, TrivialCategory, useQuestionsStore } from './store/questions-store';
import { useGlobalStore } from './store/global-store';
import { BoxModal, QuestionModal, BulkActionsModal, BulkAddModal, ParsedBulkQuestion } from './question-manager-modals';

const QuestionManager = () => {
  const navigate = useNavigate();
  const globalStore = useGlobalStore();

  // Sélecteurs Zustand optimisés - ne re-render que quand ces valeurs changent
  const storeQuestions = useQuestionsStore(state => state.questions);
  const storeBoxes = useQuestionsStore(state => state.boxes);
  const syncStatus = useQuestionsStore(state => state.syncStatus);
  const lastGitHubSync = useQuestionsStore(state => state.lastGitHubSync);

  // Actions du store (références stables, ne causent pas de re-render)
  const addQuestion = useQuestionsStore(state => state.addQuestion);
  const updateQuestion = useQuestionsStore(state => state.updateQuestion);
  const deleteQuestion = useQuestionsStore(state => state.deleteQuestion);
  const addBox = useQuestionsStore(state => state.addBox);
  const removeBox = useQuestionsStore(state => state.removeBox);
  const getBoxByName = useQuestionsStore(state => state.getBoxByName);
  const loadFromGitHub = useQuestionsStore(state => state.loadFromGitHub);
  const removeDuplicates = useQuestionsStore(state => state.removeDuplicates);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [selectedBox, setSelectedBox] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<TrivialCategory | 'all'>('all');
  const [importSuccess, setImportSuccess] = useState<string>('');
  const [importError, setImportError] = useState<string>('');
  const [preselectedBoxForModal, setPreselectedBoxForModal] = useState<string>('');

  // Gestion des boîtes
  const [showBoxModal, setShowBoxModal] = useState(false);

  // Sélection multiple
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'delete' | 'move' | null>(null);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);

  useEffect(() => {
    globalStore.setSubtitle('Gestion des questions');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Détection des doublons
  const findDuplicates = () => {
    const duplicates: { question: string; box: string; count: number; ids: string[]; originalQuestions: Question[] }[] = [];
    const questionMap = new Map<string, { count: number; ids: string[]; questions: Question[] }>();

    // Grouper par question (insensible à la casse et aux espaces)
    storeQuestions.forEach(q => {
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
    const removedCount = removeDuplicates();

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
      await loadFromGitHub();
      setImportSuccess('✅ Synchronisation GitHub réussie !');
      setTimeout(() => setImportSuccess(''), 5000);
    } catch (error) {
      setImportError('❌ Erreur lors de la synchronisation GitHub');
      setTimeout(() => setImportError(''), 5000);
    }
  };

  // ==========================================================
  // DONNÉES MÉMORISÉES - Évite les recalculs à chaque frappe
  // ==========================================================

  // Boîtes avec leurs stats (mémorisé)
  const boxesWithStats = useMemo(() => {
    return storeBoxes.map(box => ({
      ...box,
      totalQuestions: storeQuestions.filter(q => q.boxName === box.name).length
    }));
  }, [storeBoxes, storeQuestions]);

  // Questions filtrées (mémorisé)
  const filteredQuestions = useMemo(() => {
    let result = [...storeQuestions];

    if (selectedBox && selectedBox.trim() !== '') {
      const boxNameToFilter = selectedBox.trim();
      result = result.filter(q => (q.boxName || '').trim() === boxNameToFilter);
    }

    if (filterCategory !== 'all') {
      result = result.filter(q => q.category === filterCategory);
    }

    result.sort((a, b) => {
      const boxCompare = (a.boxName || '').toLowerCase().localeCompare((b.boxName || '').toLowerCase(), 'fr', { sensitivity: 'base' });
      if (boxCompare !== 0) return boxCompare;
      const cardA = a.cardNumber ?? 0;
      const cardB = b.cardNumber ?? 0;
      if (cardA !== cardB) return cardA - cardB;
      return a.category - b.category;
    });

    return result;
  }, [storeQuestions, selectedBox, filterCategory]);

  // Questions par boîte (mémorisé)
  const questionsByBoxMap = useMemo(() => {
    const map = new Map<string, Question[]>();
    storeQuestions.forEach(q => {
      const boxName = q.boxName || '';
      if (!map.has(boxName)) {
        map.set(boxName, []);
      }
      map.get(boxName)!.push(q);
    });
    return map;
  }, [storeQuestions]);

  // Fonction helper pour obtenir les questions d'une boîte (utilise le cache)
  const getBoxQuestions = (boxName: string): Question[] => {
    return questionsByBoxMap.get(boxName) || [];
  };


  // Export JSON
  const handleExport = () => {
    const exportData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      boxes: storeBoxes,
      questions: storeQuestions,
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
          for (const box of data.boxes) {
            if (!storeBoxes.find(b => b.name === box.name)) {
              addBox(box.name);
              totalBoxesAdded++;
            }
          }
        }

        // Import des boîtes depuis trivialBoxes (v1.0)
        if (data.trivialBoxes && Array.isArray(data.trivialBoxes)) {
          for (const boxName of data.trivialBoxes) {
            if (!storeBoxes.find(b => b.name === boxName)) {
              addBox(boxName);
              totalBoxesAdded++;
            }
          }
        }

        // Import des questions
        for (const q of data.questions) {
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
          const exists = storeQuestions.find(existing =>
            existing.question === normalizedQuestion.question && existing.boxName === normalizedQuestion.boxName
          );

          if (!exists) {
            addQuestion(normalizedQuestion);
            totalImported++;
          } else {
            totalSkipped++;
          }
        }

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

  const handleOpenModal = (question?: Question, preselectedBox?: string) => {
    setEditingQuestion(question || null);
    setPreselectedBoxForModal(preselectedBox || selectedBox || boxesWithStats[0]?.name || '');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingQuestion(null);
  };

  // Callback pour le QuestionModal
  const handleQuestionSubmit = (formData: any, isEdit: boolean, editId?: string) => {
    const alternativeAnswers = formData.alternativeAnswers
      .split(',')
      .map((a: string) => a.trim())
      .filter((a: string) => a.length > 0);

    const isQcm = formData.questionType === QuestionType.QCM;
    const qcmOptions = isQcm ? formData.qcmOptions.filter((o: string) => o.trim().length > 0) : undefined;
    const qcmCorrectIndex = isQcm ? formData.qcmCorrectIndex : undefined;

    if (isEdit && editId) {
      updateQuestion(editId, {
        question: formData.question,
        answer: formData.answer,
        alternativeAnswers: alternativeAnswers.length > 0 ? alternativeAnswers : undefined,
        category: formData.category,
        boxName: formData.boxName,
        cardNumber: formData.cardNumber,
        difficulty: formData.difficulty,
        questionType: formData.questionType,
        qcmOptions: qcmOptions,
        qcmCorrectIndex: qcmCorrectIndex,
      });
    } else {
      const newQuestion: Question = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        question: formData.question,
        answer: formData.answer,
        alternativeAnswers: alternativeAnswers.length > 0 ? alternativeAnswers : undefined,
        category: formData.category,
        boxName: formData.boxName,
        cardNumber: formData.cardNumber,
        difficulty: formData.difficulty,
        questionType: formData.questionType,
        qcmOptions: qcmOptions,
        qcmCorrectIndex: qcmCorrectIndex,
      };
      addQuestion(newQuestion);
    }

    handleCloseModal();
  };

  const handleDeleteQuestion = (questionId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette question ?')) {
      deleteQuestion(questionId);
    }
  };

  // Callback pour le BoxModal
  const handleBoxAdd = (name: string) => {
    addBox(name);
    setShowBoxModal(false);
  };

  const handleDeleteBox = (boxName: string) => {
    const box = getBoxByName(boxName);
    if (!box) return;

    if (!window.confirm(`Supprimer la boîte "${boxName}" et toutes ses ${box.totalQuestions} questions ?`)) {
      return;
    }

    removeBox(boxName);
  };

  // Fonctions supprimées - mode carte retiré
  // handleDeleteCard et getCategoryCountsForCard ne sont plus utilisées

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
      deleteQuestion(id);
    });

    // Vérifier si la boîte actuelle est maintenant vide
    const remainingQuestions = getBoxQuestions(selectedBox);
    if (selectedBox && remainingQuestions.length === 0) {
      // Si la boîte est vide, revenir à "Toutes les boîtes"
      setSelectedBox('');
    }

    setSelectedQuestions(new Set());
    setShowBulkActionsModal(false);
  };

  const handleBulkMove = (targetBox: string) => {
    selectedQuestions.forEach(id => {
      updateQuestion(id, { boxName: targetBox });
    });

    // Vérifier si la boîte actuelle est maintenant vide
    const remainingQuestions = getBoxQuestions(selectedBox);
    if (selectedBox && remainingQuestions.length === 0) {
      setSelectedBox('');
    }

    setSelectedQuestions(new Set());
    setShowBulkActionsModal(false);
  };

  const handleOpenBulkActions = (action: 'delete' | 'move') => {
    setBulkAction(action);
    setShowBulkActionsModal(true);
  };

  // Ajout en masse de questions
  const handleBulkAddSubmit = (questions: ParsedBulkQuestion[], boxName: string, randomCategories: boolean, fixedCategory?: TrivialCategory) => {
    const categoryValues = Object.values(TrivialCategory).filter(v => typeof v === 'number') as TrivialCategory[];
    let added = 0;
    let qcmCount = 0;

    for (const q of questions) {
      const category = randomCategories
        ? categoryValues[Math.floor(Math.random() * categoryValues.length)]
        : (fixedCategory ?? TrivialCategory.Geography);

      const newQuestion: Question = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        question: q.question,
        answer: q.answer,
        alternativeAnswers: q.alternativeAnswers.length > 0 ? q.alternativeAnswers : undefined,
        category,
        boxName,
        questionType: q.isQcm ? QuestionType.QCM : QuestionType.FREE_TEXT,
        difficulty: 'medium',
        ...(q.isQcm && q.qcmOptions ? {
          qcmOptions: q.qcmOptions,
          qcmCorrectIndex: q.qcmCorrectIndex ?? 0,
        } : {}),
      };

      addQuestion(newQuestion);
      added++;
      if (q.isQcm) qcmCount++;
    }

    const detail = qcmCount > 0 ? ` (${qcmCount} QCM, ${added - qcmCount} texte libre)` : '';
    setImportSuccess(`✅ ${added} question(s) ajoutée(s) en masse dans "${boxName}"${detail}`);
    setTimeout(() => setImportSuccess(''), 5000);
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
      <BoxModal
        show={showBoxModal}
        onHide={() => setShowBoxModal(false)}
        onAdd={handleBoxAdd}
      />

      {/* Modal d'édition de question */}
      <QuestionModal
        show={showModal}
        onHide={handleCloseModal}
        onSubmit={handleQuestionSubmit}
        editingQuestion={editingQuestion}
        boxes={boxesWithStats}
        defaultBoxName={preselectedBoxForModal}
      />

      {/* Modal d'ajout en masse */}
      <BulkAddModal
        show={showBulkAddModal}
        onHide={() => setShowBulkAddModal(false)}
        onSubmit={handleBulkAddSubmit}
        boxes={boxesWithStats}
        defaultBoxName={selectedBox || boxesWithStats[0]?.name || ''}
      />

      {/* Modal d'actions de masse */}
      <BulkActionsModal
        show={showBulkActionsModal}
        onHide={() => setShowBulkActionsModal(false)}
        action={bulkAction}
        selectedCount={selectedQuestions.size}
        boxes={boxesWithStats}
        onDelete={handleBulkDelete}
        onMove={handleBulkMove}
      />

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
          <Button variant="outline-primary" onClick={() => setShowBulkAddModal(true)}>
            <FontAwesomeIcon icon={['fas', 'list']} /> Ajout en masse
          </Button>
        </div>
      </div>

      {/* Indicateur de statut de synchronisation */}
      <div className="mb-3">
        <Alert variant={syncStatus === 'success' ? 'success' : syncStatus === 'error' ? 'danger' : syncStatus === 'loading' ? 'info' : 'secondary'} className="py-2">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              {syncStatus === 'loading' && (
                <>
                  <FontAwesomeIcon icon={['fas', 'sync']} spin className="me-2" />
                  <strong>Synchronisation en cours...</strong>
                </>
              )}
              {syncStatus === 'success' && (
                <>
                  <FontAwesomeIcon icon={['fas', 'check-circle']} className="me-2" />
                  <strong>Synchronisé avec GitHub</strong>
                </>
              )}
              {syncStatus === 'error' && (
                <>
                  <FontAwesomeIcon icon={['fas', 'exclamation-triangle']} className="me-2" />
                  <strong>Erreur lors de la dernière synchronisation</strong>
                </>
              )}
              {syncStatus === 'idle' && (
                <>
                  <FontAwesomeIcon icon={['fas', 'info-circle']} className="me-2" />
                  <strong>Prêt à synchroniser</strong>
                </>
              )}
            </div>
            <div className="text-muted small">
              {lastGitHubSync && (
                <>
                  Dernière sync: {getRelativeTime(lastGitHubSync)}
                  <span className="ms-2">({storeQuestions.length} questions)</span>
                </>
              )}
              {!lastGitHubSync && (
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
                {boxesWithStats.map(box => (
                  <option key={box.name} value={box.name}>
                    {box.name} ({box.totalQuestions} questions)
                  </option>
                ))}
              </Form.Select>
            </div>
          </div>

          {boxesWithStats.length === 0 ? (
            <div className="text-center p-5">
              <FontAwesomeIcon icon={['fas', 'box']} size="3x" color="var(--alt-text-color)" />
              <p className="mt-3 text-muted">Aucune boîte. Créez votre première boîte et importez des questions.</p>
            </div>
          ) : (
            <div className="row">
              {(selectedBox ? boxesWithStats.filter(b => b.name === selectedBox) : boxesWithStats).map(box => {
                // Compter les types de questions
                const boxQuestions = getBoxQuestions(box.name);
                const qcmCount = boxQuestions.filter(q => q.questionType === QuestionType.QCM).length;
                const freeTextCount = boxQuestions.length - qcmCount;

                return (
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
                          <Badge bg="secondary" className="me-2">
                            {box.totalQuestions} question{box.totalQuestions > 1 ? 's' : ''}
                          </Badge>
                          {qcmCount > 0 && (
                            <Badge bg="success" className="me-2">
                              📋 {qcmCount} QCM
                            </Badge>
                          )}
                          {freeTextCount > 0 && (
                            <Badge bg="outline-secondary" style={{ border: '1px solid #666', color: '#888' }}>
                              ✏️ {freeTextCount} Libre{freeTextCount > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>

                        {/* Répartition par catégorie */}
                        <h6 className="mb-2">Par catégorie :</h6>
                        <div className="d-flex flex-wrap gap-1 mb-3">
                          {Object.entries(categoryNames).map(([key, name]) => {
                            const count = boxQuestions.filter(q => q.category === parseInt(key)).length;
                            return (
                              <Badge
                                key={key}
                                bg=""
                                style={{
                                  backgroundColor: count > 0 ? categoryColors[parseInt(key) as TrivialCategory] : '#444',
                                  color: 'white',
                                  opacity: count > 0 ? 1 : 0.5
                                }}
                              >
                                {name.replace('▲ ', '')} : {count}
                              </Badge>
                            );
                          })}
                        </div>

                        {/* Bouton pour ajouter une question */}
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => {
                            handleOpenModal(undefined, box.name);
                          }}
                        >
                          <FontAwesomeIcon icon={['fas', 'plus']} /> Ajouter une question
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                {boxesWithStats.map(box => (
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
            <Table hover responsive key={`table-${selectedBox}-${filterCategory}`}>
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
                  <th style={{ width: '8%' }}>Type</th>
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
                      {question.questionType === QuestionType.QCM ? (
                        <Badge bg="success">📋 QCM</Badge>
                      ) : (
                        <Badge bg="outline-secondary" style={{ border: '1px solid #666', color: '#aaa' }}>✏️ Libre</Badge>
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
