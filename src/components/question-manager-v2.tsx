import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Button, Form, Table, Badge, Tabs, Tab, Alert, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { Question, QuestionType, TrivialBox, useQuestionsStore } from './store/questions-store';
import { useGlobalStore } from './store/global-store';
import { useAuthStore } from './store/auth-store';
import { QuestionModal, BulkActionsModal } from './question-manager-modals';
import { apiReorderBox } from 'services/api-service';

const EditBoxModal = React.memo(({ box, allBoxes, isMaster, onConfirm, onClose }: {
  box: { name: string; ordered?: boolean; description?: string | null; hidden?: boolean; parentBox?: string | null };
  allBoxes: { name: string; parentBox?: string | null }[];
  isMaster: boolean; // Cette boîte est un master (a des sous-boîtes)
  onConfirm: (updates: { newName?: string; ordered?: boolean; description?: string; hidden?: boolean; parentBox?: string | null }) => void;
  onClose: () => void;
}) => {
  const [name, setName] = useState(box.name);
  const [ordered, setOrdered] = useState(!!box.ordered);
  const [description, setDescription] = useState(box.description || '');
  const [hidden, setHidden] = useState(!!box.hidden);
  const [parentBox, setParentBox] = useState<string>(box.parentBox || '');

  // Boîtes candidates comme parent : top-level (sans parent) et différentes de cette boîte
  const parentCandidates = allBoxes.filter(b => !b.parentBox && b.name !== box.name);

  const hasChanges = name.trim() !== box.name
    || ordered !== !!box.ordered
    || description !== (box.description || '')
    || hidden !== !!box.hidden
    || parentBox !== (box.parentBox || '');
  const isValid = name.trim().length > 0 && hasChanges;

  const handleConfirm = () => {
    if (!isValid) return;
    const updates: { newName?: string; ordered?: boolean; description?: string; hidden?: boolean; parentBox?: string | null } = {};
    if (name.trim() !== box.name) updates.newName = name.trim();
    if (ordered !== !!box.ordered) updates.ordered = ordered;
    if (description !== (box.description || '')) updates.description = description;
    if (hidden !== !!box.hidden) updates.hidden = hidden;
    if (parentBox !== (box.parentBox || '')) updates.parentBox = parentBox || null;
    onConfirm(updates);
  };

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Modifier la boîte</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Nom</Form.Label>
          <Form.Control
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Description / Info</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Boîte de Trivial Pursuit édition Cinéma 1991"
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Boîte parente (optionnel)</Form.Label>
          {isMaster ? (
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>
              Cette boîte est une <strong>boîte Master</strong> (elle a des sous-boîtes). Supprimez d'abord ses sous-boîtes pour la rattacher à un parent.
            </div>
          ) : (
            <Form.Select value={parentBox} onChange={(e) => setParentBox(e.target.value)}>
              <option value="">— Indépendante (boîte racine) —</option>
              {parentCandidates.map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </Form.Select>
          )}
        </Form.Group>
        <Form.Check
          type="switch"
          id="editBoxOrdered"
          label="↓ Mode ordonné"
          checked={ordered}
          onChange={(e) => setOrdered(e.target.checked)}
          className="mb-2"
        />
        <Form.Check
          type="switch"
          id="editBoxHidden"
          label="Masquer pour le public"
          checked={hidden}
          onChange={(e) => setHidden(e.target.checked)}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!isValid}>Enregistrer</Button>
      </Modal.Footer>
    </Modal>
  );
});

const QuestionManager = () => {
  const navigate = useNavigate();
  const globalStore = useGlobalStore();

  // Sélecteurs Zustand optimisés - ne re-render que quand ces valeurs changent
  const storeQuestions = useQuestionsStore(state => state.questions);
  const storeBoxes = useQuestionsStore(state => state.boxes);
  const syncStatus = useQuestionsStore(state => state.syncStatus);
  const lastDBSync = useQuestionsStore(state => state.lastDBSync);

  // Actions du store (références stables, ne causent pas de re-render)
  const updateQuestion = useQuestionsStore(state => state.updateQuestion);
  const deleteQuestion = useQuestionsStore(state => state.deleteQuestion);
  const bulkAddQuestions = useQuestionsStore(state => state.bulkAddQuestions);
  const addBox = useQuestionsStore(state => state.addBox);
  const removeBox = useQuestionsStore(state => state.removeBox);
  const updateBox = useQuestionsStore(state => state.updateBox);
  const getBoxByName = useQuestionsStore(state => state.getBoxByName);
  const syncFromDB = useQuestionsStore(state => state.syncFromDB);
  const removeDuplicates = useQuestionsStore(state => state.removeDuplicates);
  const isAdmin = useAuthStore(state => state.isAdmin);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [selectedBox, setSelectedBox] = useState<string>('');
  const [filterBoxType, setFilterBoxType] = useState<'all' | 'master' | 'sub' | 'unique'>('all');
  const [filterType, setFilterType] = useState<'all' | 'free_text' | 'qcm'>('all');
  const [importSuccess, setImportSuccess] = useState<string>('');
  const [importError, setImportError] = useState<string>('');
  const [preselectedBoxForModal, setPreselectedBoxForModal] = useState<string>('');

  // Sélection multiple
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'delete' | 'move' | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // Recherche globale
  const [searchQuery, setSearchQuery] = useState('');

  // Tab actif (contrôlé)
  const [activeTab, setActiveTab] = useState('boxes');

  // Édition boîte
  const [editingBoxName, setEditingBoxName] = useState<string | null>(null);

  // Création de boîte vide
  const [showCreateBoxModal, setShowCreateBoxModal] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');
  const [creatingBox, setCreatingBox] = useState(false);

  // Réordonnement boîte ordonnée
  const [reorderingBoxName, setReorderingBoxName] = useState<string | null>(null);
  const [reorderList, setReorderList] = useState<Question[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
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

  const handleCheckDuplicates = async () => {
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

    message += 'Voulez-vous supprimer les doublons ?\n';

    if (!window.confirm(message)) {
      return;
    }

    // Supprimer localement ET dans la DB Turso
    setImportSuccess('⏳ Suppression des doublons en cours...');
    try {
      const removedCount = await removeDuplicates();
      setImportSuccess(`✅ ${removedCount} doublon(s) supprimé(s)!`);
    } catch (err) {
      console.error('Erreur suppression doublons:', err);
      setImportSuccess('⚠️ Erreur lors de la suppression des doublons');
    }
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

  // Synchronisation depuis la BD Turso
  const handleSyncFromDB = async () => {
    try {
      setImportSuccess('🔄 Synchronisation avec la base de données en cours...');
      await syncFromDB();
      setImportSuccess('✅ Synchronisation BD réussie !');
      setTimeout(() => setImportSuccess(''), 5000);
    } catch (error) {
      setImportError('❌ Erreur lors de la synchronisation BD');
      setTimeout(() => setImportError(''), 5000);
    }
  };

  // ==========================================================
  // DONNÉES MÉMORISÉES - Évite les recalculs à chaque frappe
  // ==========================================================

  // Filtrer les boîtes cachées pour les non-admins
  const visibleBoxes = useMemo(
    () => isAdmin ? storeBoxes : storeBoxes.filter(b => !b.hidden),
    [storeBoxes, isAdmin]
  );

  // Boîtes avec leurs stats (mémorisé) — O(n) au lieu de O(boxes * questions)
  const boxesWithStats = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const q of storeQuestions) {
      countMap.set(q.boxName || '', (countMap.get(q.boxName || '') || 0) + 1);
    }
    return visibleBoxes.map(box => ({
      ...box,
      totalQuestions: countMap.get(box.name) || 0
    }));
  }, [visibleBoxes, storeQuestions]);

  // Map: master box name → sous-boîtes
  const subBoxesByMaster = useMemo(() => {
    const map = new Map<string, TrivialBox[]>();
    for (const box of boxesWithStats) {
      if (box.parentBox) {
        const subs = map.get(box.parentBox) || [];
        subs.push(box);
        map.set(box.parentBox, subs);
      }
    }
    return map;
  }, [boxesWithStats]);

  // Set des noms de master boxes (ont au moins une sous-boîte)
  const masterBoxNames = useMemo(() => new Set(subBoxesByMaster.keys()), [subBoxesByMaster]);

  // Boîtes filtrées par type (master/sub/all)
  const filteredBoxesByType = useMemo(() => {
    if (filterBoxType === 'master') return boxesWithStats.filter(b => masterBoxNames.has(b.name));
    if (filterBoxType === 'sub') return boxesWithStats.filter(b => !!b.parentBox);
    if (filterBoxType === 'unique') return boxesWithStats.filter(b => !b.parentBox && !masterBoxNames.has(b.name));

    return boxesWithStats;
  }, [boxesWithStats, filterBoxType, masterBoxNames]);

  // Boîtes filtrées par recherche (sur la liste filtrée par type)
  const searchFilteredBoxes = useMemo(() => {
    if (!searchQuery.trim()) return filteredBoxesByType;
    const q = searchQuery.toLowerCase();
    return filteredBoxesByType.filter(b => b.name.toLowerCase().includes(q));
  }, [filteredBoxesByType, searchQuery]);

  // La boîte sélectionnée est-elle ordonnée ?
  const selectedBoxIsOrdered = useMemo(() => {
    if (!selectedBox) return false;
    const box = visibleBoxes.find(b => b.name === selectedBox.trim());
    return !!box?.ordered;
  }, [selectedBox, visibleBoxes]);

  // Questions filtrées (mémorisé)
  const filteredQuestions = useMemo(() => {
    let result = [...storeQuestions];

    if (selectedBox && selectedBox.trim() !== '') {
      const boxNameToFilter = selectedBox.trim();
      result = result.filter(q => (q.boxName || '').trim() === boxNameToFilter);
    }

    if (filterType !== 'all') {
      result = result.filter(q => (q.questionType || QuestionType.FREE_TEXT) === filterType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(question =>
        question.question.toLowerCase().includes(q) ||
        question.answer.toLowerCase().includes(q) ||
        (question.boxName || '').toLowerCase().includes(q)
      );
    }

    // Si la boîte est ordonnée, trier par createdAt / ID
    if (selectedBoxIsOrdered && filterType === 'all') {
      result.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          const cmp = a.createdAt.localeCompare(b.createdAt);
          if (cmp !== 0) return cmp;
        } else if (a.createdAt) return -1;
        else if (b.createdAt) return 1;
        return a.id.localeCompare(b.id);
      });
    } else {
      result.sort((a, b) => {
        const boxCompare = (a.boxName || '').toLowerCase().localeCompare((b.boxName || '').toLowerCase(), 'fr', { sensitivity: 'base' });
        if (boxCompare !== 0) return boxCompare;
        const cardA = a.cardNumber ?? 0;
        const cardB = b.cardNumber ?? 0;
        if (cardA !== cardB) return cardA - cardB;
        return a.id.localeCompare(b.id);
      });
    }

    return result;
  }, [storeQuestions, selectedBox, filterType, selectedBoxIsOrdered]);

  // Reset pagination quand les filtres changent
  useEffect(() => { setCurrentPage(1); }, [selectedBox, filterType, searchQuery]);

  // Questions paginées
  const totalPages = Math.ceil(filteredQuestions.length / PAGE_SIZE);
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredQuestions.slice(start, start + PAGE_SIZE);
  }, [filteredQuestions, currentPage]);

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
    const errorFiles: string[] = [];

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

        // Collecter les boîtes à créer
        const boxesToAdd: string[] = [];

        if (data.boxes && Array.isArray(data.boxes)) {
          for (const box of data.boxes) {
            if (!storeBoxes.find(b => b.name === box.name)) {
              boxesToAdd.push(box.name);
            }
          }
        }

        if (data.trivialBoxes && Array.isArray(data.trivialBoxes)) {
          for (const boxName of data.trivialBoxes) {
            if (!storeBoxes.find(b => b.name === boxName)) {
              boxesToAdd.push(boxName);
            }
          }
        }

        // Créer les boîtes via API
        for (const name of boxesToAdd) {
          await addBox(name);
          totalBoxesAdded++;
        }

        // Normaliser et filtrer les questions (exclure doublons)
        const newQuestions: Question[] = [];
        for (const q of data.questions) {
          const normalizedQuestion: Question = {
            ...q,
            boxName: q.boxName || q.trivialBox || 'Sans boîte',
          };

          if ('trivialBox' in normalizedQuestion) {
            delete (normalizedQuestion as any).trivialBox;
          }

          const exists = storeQuestions.find(existing =>
            existing.question === normalizedQuestion.question && existing.boxName === normalizedQuestion.boxName
          );

          if (!exists) {
            newQuestions.push(normalizedQuestion);
          } else {
            totalSkipped++;
          }
        }

        // Ajout en masse via API
        if (newQuestions.length > 0) {
          await bulkAddQuestions(newQuestions);
          totalImported += newQuestions.length;
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

  // Callback pour le QuestionModal (édition uniquement)
  const handleQuestionSubmit = async (formData: any, isEdit: boolean, editId?: string) => {
    if (!isEdit || !editId) return;

    const alternativeAnswers = formData.alternativeAnswers
      .split(',')
      .map((a: string) => a.trim())
      .filter((a: string) => a.length > 0);

    const isQcm = formData.questionType === QuestionType.QCM;
    const qcmOptions = isQcm ? formData.qcmOptions.filter((o: string) => o.trim().length > 0) : undefined;
    const qcmCorrectIndex = isQcm ? formData.qcmCorrectIndex : undefined;
    const qcmCorrectIndexes = isQcm ? formData.qcmCorrectIndexes : undefined;

    await updateQuestion(editId, {
      question: formData.question,
      answer: formData.answer,
      alternativeAnswers: alternativeAnswers.length > 0 ? alternativeAnswers : undefined,
      boxName: formData.boxName,
      cardNumber: formData.cardNumber,
      difficulty: formData.difficulty,
      questionType: formData.questionType,
      qcmOptions: qcmOptions,
      qcmCorrectIndex: qcmCorrectIndex,
      qcmCorrectIndexes: qcmCorrectIndexes,
      imageUrl: formData.imageUrl?.trim() || undefined,
      answerImageUrl: formData.answerImageUrl?.trim() || undefined,
    });

    handleCloseModal();
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette question ?')) {
      await deleteQuestion(questionId);
    }
  };

  const handleDeleteBox = async (boxName: string) => {
    const box = getBoxByName(boxName);
    if (!box) return;

    if (!window.confirm(`Supprimer la boîte "${boxName}" et toutes ses ${box.totalQuestions} questions ?`)) {
      return;
    }

    // Reset le filtre si on supprime la boîte actuellement sélectionnée
    if (selectedBox === boxName) {
      setSelectedBox('');
    }

    await removeBox(boxName);
  };

  const handleConfirmEditBox = async (updates: { newName?: string; ordered?: boolean; description?: string; hidden?: boolean; parentBox?: string | null }) => {
    if (!editingBoxName) return;
    await updateBox(editingBoxName, updates);
    setEditingBoxName(null);
  };

  const handleCreateEmptyBox = async () => {
    const trimmed = newBoxName.trim();
    if (!trimmed) return;
    if (storeBoxes.find(b => b.name.toLowerCase() === trimmed.toLowerCase())) {
      setImportError(`Une boîte nommée "${trimmed}" existe déjà.`);
      setTimeout(() => setImportError(''), 4000);
      return;
    }
    setCreatingBox(true);
    try {
      await addBox(trimmed);
      setImportSuccess(`✅ Boîte "${trimmed}" créée avec succès !`);
      setTimeout(() => setImportSuccess(''), 4000);
      setShowCreateBoxModal(false);
      setNewBoxName('');
    } catch (err: any) {
      setImportError(`Erreur: ${err.message}`);
      setTimeout(() => setImportError(''), 5000);
    } finally {
      setCreatingBox(false);
    }
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

  const handleBulkDelete = async () => {
    if (!window.confirm(`Supprimer ${selectedQuestions.size} question(s) sélectionnée(s) ?`)) {
      return;
    }

    const ids = Array.from(selectedQuestions);
    for (const id of ids) {
      await deleteQuestion(id);
    }

    // Vérifier si la boîte actuelle est maintenant vide
    const remainingQuestions = getBoxQuestions(selectedBox);
    if (selectedBox && remainingQuestions.length === 0) {
      setSelectedBox('');
    }

    setSelectedQuestions(new Set());
    setShowBulkActionsModal(false);
  };

  const handleBulkMove = async (targetBox: string) => {
    const ids = Array.from(selectedQuestions);
    for (const id of ids) {
      await updateQuestion(id, { boxName: targetBox });
    }

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

  // --- Réordonnement ---
  const handleOpenReorder = (boxName: string) => {
    const questions = storeQuestions.filter(q => q.boxName === boxName);
    // Trier par createdAt/ID pour afficher l'ordre actuel
    questions.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        const cmp = a.createdAt.localeCompare(b.createdAt);
        if (cmp !== 0) return cmp;
      } else if (a.createdAt) return -1;
      else if (b.createdAt) return 1;
      return a.id.localeCompare(b.id);
    });
    setReorderList(questions);
    setReorderingBoxName(boxName);
  };

  const handleReorderDrop = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const updated = [...reorderList];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setReorderList(updated);
  };

  const handleReorderSave = async () => {
    if (!reorderingBoxName) return;
    setReorderSaving(true);
    try {
      const ids = reorderList.map(q => q.id);
      await apiReorderBox(reorderingBoxName, ids);
      // Forcer un re-sync pour rafraîchir les created_at
      await syncFromDB();
      setReorderingBoxName(null);
      setImportSuccess(`✅ Ordre des questions mis à jour pour "${reorderingBoxName}"`);
      setTimeout(() => setImportSuccess(''), 5000);
    } catch (err: any) {
      setImportError(`Erreur réordonnement: ${err.message}`);
      setTimeout(() => setImportError(''), 5000);
    } finally {
      setReorderSaving(false);
    }
  };

  const handleReorderMove = (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= reorderList.length) return;
    handleReorderDrop(idx, newIdx);
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

      {/* Modale d'édition de boîte */}
      {editingBoxName !== null && (() => {
        const box = boxesWithStats.find(b => b.name === editingBoxName);
        const isMaster = storeBoxes.some(b => b.parentBox === editingBoxName);
        return box ? (
          <EditBoxModal
            box={box}
            allBoxes={storeBoxes}
            isMaster={isMaster}
            onConfirm={handleConfirmEditBox}
            onClose={() => setEditingBoxName(null)}
          />
        ) : null;
      })()}

      {/* Modale de création de boîte vide */}
      <Modal show={showCreateBoxModal} onHide={() => setShowCreateBoxModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Créer une Boîte Vide</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Nom de la boîte</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex: Culture Générale 2026"
              value={newBoxName}
              onChange={(e) => setNewBoxName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateEmptyBox(); } }}
            />
            <Form.Text className="text-muted">
              La boîte sera créée vide. Vous pourrez y ajouter des questions ou y rattacher des sous-boîtes ensuite.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateBoxModal(false)}>Annuler</Button>
          <Button variant="primary" onClick={handleCreateEmptyBox} disabled={!newBoxName.trim() || creatingBox}>
            {creatingBox ? 'Création...' : 'Créer'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modale de réordonnement */}
      {reorderingBoxName !== null && (
        <Modal show onHide={() => setReorderingBoxName(null)} centered size="lg" scrollable>
          <Modal.Header closeButton>
            <Modal.Title>
              Réordonner — {reorderingBoxName}
              <small className="text-muted ms-2" style={{ fontSize: '0.6em' }}>{reorderList.length} questions</small>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto', padding: 0 }}>
            <Table hover size="sm" className="mb-0">
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>#</th>
                  <th style={{ width: '72%' }}>Question</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Ordre</th>
                </tr>
              </thead>
              <tbody>
                {reorderList.map((q, idx) => (
                  <tr
                    key={q.id}
                    draggable
                    onDragStart={() => setDraggedIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (draggedIdx !== null) handleReorderDrop(draggedIdx, idx); setDraggedIdx(null); }}
                    style={{
                      cursor: 'grab',
                      backgroundColor: draggedIdx === idx ? 'rgba(100,100,255,0.15)' : undefined,
                    }}
                  >
                    <td className="text-muted">{idx + 1}</td>
                    <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
                      {q.question}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Button
                        size="sm"
                        variant="link"
                        className="p-0 me-2"
                        disabled={idx === 0}
                        onClick={() => handleReorderMove(idx, 'up')}
                      >
                        <FontAwesomeIcon icon={['fas', 'chevron-up']} />
                      </Button>
                      <Button
                        size="sm"
                        variant="link"
                        className="p-0"
                        disabled={idx === reorderList.length - 1}
                        onClick={() => handleReorderMove(idx, 'down')}
                      >
                        <FontAwesomeIcon icon={['fas', 'chevron-down']} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setReorderingBoxName(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleReorderSave} disabled={reorderSaving}>
              {reorderSaving ? 'Enregistrement...' : 'Enregistrer l\'ordre'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Modal d'édition de question */}
      <QuestionModal
        show={showModal}
        onHide={handleCloseModal}
        onSubmit={handleQuestionSubmit}
        editingQuestion={editingQuestion}
        boxes={boxesWithStats}
        defaultBoxName={preselectedBoxForModal}
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
          <Button variant="primary" className="me-2" onClick={handleSyncFromDB}>
            <FontAwesomeIcon icon={['fas', 'sync']} /> Sync BD
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
          {isAdmin && (
            <Button variant="outline-light" onClick={() => { setNewBoxName(''); setShowCreateBoxModal(true); }}>
              <FontAwesomeIcon icon={['fas', 'plus']} /> Créer une Boîte
            </Button>
          )}
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
                  <strong>Synchronisé avec la base de données</strong>
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
              {lastDBSync && (
                <>
                  Dernière sync BD: {getRelativeTime(lastDBSync)}
                  <span className="ms-2">({storeQuestions.length} questions)</span>
                </>
              )}
              {!lastDBSync && (
                <span>Aucune synchronisation effectuée</span>
              )}
            </div>
          </div>
        </Alert>
      </div>

      {/* Barre de recherche globale */}
      <div className="mb-3 position-relative">
        <FontAwesomeIcon
          icon={['fas', 'search']}
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }}
        />
        <Form.Control
          type="text"
          placeholder="Rechercher une boîte ou une question..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ paddingLeft: '36px' }}
        />
        {searchQuery && (
          <Button
            variant="link"
            size="sm"
            onClick={() => setSearchQuery('')}
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#888', padding: 0 }}
          >
            <FontAwesomeIcon icon={['fas', 'times']} />
          </Button>
        )}
      </div>

      <Tabs activeKey={activeTab} onSelect={(k) => k && setActiveTab(k)} className="mb-3">
        <Tab eventKey="boxes" title="📦 Boîtes">
          <div className="mb-3 d-flex justify-content-end gap-2">
            <Form.Select
              style={{ width: '180px' }}
              value={filterBoxType}
              onChange={(e) => { setFilterBoxType(e.target.value as 'all' | 'master' | 'sub' | 'unique'); setSelectedBox(''); }}
            >
              <option value="all">Tous les types</option>
              <option value="master">Master Boxes</option>
              <option value="sub">Sous-boîtes</option>
              <option value="Unique">Indépendante</option>
            </Form.Select>
            <Form.Select
              style={{ width: '250px' }}
              value={selectedBox}
              onChange={(e) => setSelectedBox(e.target.value)}
            >
              <option value="">Toutes les boîtes</option>
              {filteredBoxesByType.map(box => (
                <option key={box.name} value={box.name}>
                  {box.name} ({box.totalQuestions} questions)
                </option>
              ))}
            </Form.Select>
          </div>

          {searchFilteredBoxes.length === 0 ? (
            <div className="text-center p-5">
              <FontAwesomeIcon icon={['fas', 'box']} size="3x" color="var(--alt-text-color)" />
              <p className="mt-3 text-muted">
                {searchQuery ? `Aucune boîte pour "${searchQuery}".` :
                 filterBoxType === 'master' ? 'Aucune Master Box trouvée.' :
                 filterBoxType === 'sub' ? 'Aucune sous-boîte trouvée.' :
                 filterBoxType === 'unique' ? 'Aucune boîte indépendante trouvée.' :
                 'Aucune boîte. Créez votre première boîte et importez des questions.'}
              </p>
            </div>
          ) : (
            <div className="row">
              {(selectedBox ? searchFilteredBoxes.filter(b => b.name === selectedBox) : searchFilteredBoxes).map(box => {
                // Compter les types de questions
                const boxQuestions = getBoxQuestions(box.name);
                const qcmCount = boxQuestions.filter(q => q.questionType === QuestionType.QCM).length;
                const freeTextCount = boxQuestions.length - qcmCount;
                const isMasterBox = masterBoxNames.has(box.name);
                const childBoxes = subBoxesByMaster.get(box.name) || [];

                return (
                  <div key={box.name} className="col-md-6 mb-3">
                    <div className="card">
                      <div className="card-header d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">
                          <FontAwesomeIcon icon={['fas', box.parentBox ? 'folder-open' : (isMasterBox ? 'layer-group' : 'box')]} className="me-2" />
                          {box.ordered && <span title="Mode ordonné" style={{ fontSize: '0.7em', marginRight: '4px' }}>↓</span>}
                          {box.hidden && <FontAwesomeIcon icon={['fas', 'eye-slash']} className="me-1" title="Masquée pour le public" style={{ fontSize: '0.7em', opacity: 0.6 }} />}
                          <span
                            style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}
                            title="Voir les questions de cette boîte"
                            onClick={() => { setSelectedBox(box.name); setActiveTab('questions'); }}
                          >
                            {box.name}
                          </span>
                          {box.parentBox && (
                            <small className="text-muted ms-2" style={{ fontSize: '0.6em', fontWeight: 'normal' }}>
                              ↳ {box.parentBox}
                            </small>
                          )}
                          {isAdmin && box.createdBy && (
                            <small className="text-muted ms-2" style={{ fontSize: '0.6em', fontWeight: 'normal' }}>
                              par {box.createdBy}
                            </small>
                          )}
                        </h5>
                        {isAdmin && (
                          <div className="d-flex gap-1">
                            {box.ordered && (
                              <Button
                                size="sm"
                                variant="outline-info"
                                title="Réordonner les questions"
                                onClick={() => handleOpenReorder(box.name)}
                              >
                                <FontAwesomeIcon icon={['fas', 'sort']} />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              title="Modifier la boîte"
                              onClick={() => setEditingBoxName(box.name)}
                            >
                              <FontAwesomeIcon icon={['fas', 'pen']} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => handleDeleteBox(box.name)}
                            >
                              <FontAwesomeIcon icon={['fas', 'trash']} />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="card-body">
                        {box.description && (
                          <p className="text-muted small mb-2" style={{ fontStyle: 'italic' }}>
                            {box.description}
                          </p>
                        )}
                        {/* Sous-boîtes pour les Master Boxes */}
                        {isMasterBox && childBoxes.length > 0 && (
                          <div className="mb-3">
                            <small className="text-muted d-block mb-1">
                              <FontAwesomeIcon icon={['fas', 'sitemap']} className="me-1" />
                              {childBoxes.length} sous-boîte{childBoxes.length > 1 ? 's' : ''} :
                            </small>
                            <div className="d-flex flex-wrap gap-1">
                              {childBoxes.map(sub => (
                                <Badge
                                  key={sub.name}
                                  bg="info"
                                  className="me-1"
                                  style={{ cursor: 'pointer', fontSize: '0.8em' }}
                                  title={`${sub.totalQuestions} question${sub.totalQuestions > 1 ? 's' : ''} — Cliquer pour voir`}
                                  onClick={() => { setFilterBoxType('all'); setSelectedBox(sub.name); }}
                                >
                                  <FontAwesomeIcon icon={['fas', 'folder-open']} className="me-1" />
                                  {sub.name}
                                  <span className="ms-1" style={{ opacity: 0.7 }}>({sub.totalQuestions})</span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Statistiques */}
                        <div className="mb-3">
                          {isMasterBox ? (
                            <Badge bg="secondary" className="me-2">
                              {childBoxes.reduce((sum, s) => sum + s.totalQuestions, 0) + box.totalQuestions} question{(childBoxes.reduce((sum, s) => sum + s.totalQuestions, 0) + box.totalQuestions) > 1 ? 's' : ''} (total)
                            </Badge>
                          ) : (
                            <Badge bg="secondary" className="me-2">
                              {box.totalQuestions} question{box.totalQuestions > 1 ? 's' : ''}
                            </Badge>
                          )}
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
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'free_text' | 'qcm')}
              >
                <option value="all">Tous les types</option>
                <option value="free_text">Réponse libre</option>
                <option value="qcm">QCM</option>
              </Form.Select>
            </div>
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
                {isAdmin && (
                  <Button size="sm" variant="danger" onClick={() => handleOpenBulkActions('delete')}>
                    <FontAwesomeIcon icon={['fas', 'trash']} /> Supprimer
                  </Button>
                )}
              </div>
            </Alert>
          )}

          {filteredQuestions.length === 0 ? (
            <div className="text-center p-5">
              <FontAwesomeIcon icon={['fas', 'question']} size="3x" color="var(--alt-text-color)" />
              <p className="mt-3 text-muted">Aucune question. Commencez par ajouter une boîte Trivial Pursuit et des questions.</p>
            </div>
          ) : (
            <>
            {/* Pagination header */}
            {filteredQuestions.length > PAGE_SIZE && (
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small">
                  {filteredQuestions.length} questions — page {currentPage}/{totalPages}
                </span>
                <div className="d-flex gap-2 align-items-center">
                  <Button size="sm" variant="link" className="text-light p-0" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}>
                    <FontAwesomeIcon icon={['fas', 'angles-left']} />
                  </Button>
                  <Button size="sm" variant="link" className="text-light p-0" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <FontAwesomeIcon icon={['fas', 'chevron-left']} />
                  </Button>
                  <Button size="sm" variant="link" className="text-light p-0" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <FontAwesomeIcon icon={['fas', 'chevron-right']} />
                  </Button>
                  <Button size="sm" variant="link" className="text-light p-0" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
                    <FontAwesomeIcon icon={['fas', 'angles-right']} />
                  </Button>
                </div>
              </div>
            )}

            {selectedBoxIsOrdered && filterType === 'all' && (
              <div className="mb-2">
                <Badge bg="info">↓ Boîte ordonnée — les questions sont affichées dans l'ordre de jeu</Badge>
              </div>
            )}

            <Table hover responsive key={`table-${selectedBox}-${filterType}`}>
              <thead>
                <tr>
                  {selectedBoxIsOrdered && <th style={{ width: '4%' }}>#</th>}
                  <th style={{ width: selectedBoxIsOrdered ? '4%' : '5%' }}>
                    <Form.Check
                      type="checkbox"
                      checked={selectedQuestions.size === filteredQuestions.length && filteredQuestions.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th style={{ width: '12%' }}>Boîte</th>
                  <th style={{ width: '8%' }}>Type</th>
                  <th style={{ width: '12%' }}>Catégorie</th>
                  <th style={{ width: selectedBoxIsOrdered ? '28%' : '30%' }}>Question</th>
                  <th style={{ width: '20%' }}>Réponse</th>
                  <th style={{ width: '13%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuestions.map((question, idx) => (
                  <tr key={question.id}>
                    {selectedBoxIsOrdered && (
                      <td className="text-muted small">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                    )}
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
                      <Badge bg="secondary" style={{ fontWeight: 'bold' }}>
                        {(question.questionType || QuestionType.FREE_TEXT) === QuestionType.QCM ? 'QCM' : 'Libre'}
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
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => handleDeleteQuestion(question.id)}
                        >
                          <FontAwesomeIcon icon={['fas', 'trash']} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {/* Pagination footer */}
            {filteredQuestions.length > PAGE_SIZE && (
              <div className="d-flex justify-content-between align-items-center mt-2">
                <span className="text-muted small">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredQuestions.length)} sur {filteredQuestions.length}
                </span>
                <div className="d-flex gap-2 align-items-center">
                  <Button size="sm" variant="link" className="text-light p-0" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}>
                    <FontAwesomeIcon icon={['fas', 'angles-left']} />
                  </Button>
                  <Button size="sm" variant="link" className="text-light p-0" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <FontAwesomeIcon icon={['fas', 'chevron-left']} />
                  </Button>
                  <Button size="sm" variant="link" className="text-light p-0" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <FontAwesomeIcon icon={['fas', 'chevron-right']} />
                  </Button>
                  <Button size="sm" variant="link" className="text-light p-0" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
                    <FontAwesomeIcon icon={['fas', 'angles-right']} />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </Tab>
      </Tabs>
    </>
  );
};

export default QuestionManager;
