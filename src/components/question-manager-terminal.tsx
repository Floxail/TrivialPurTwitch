/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LUMON INDUSTRIES - QUESTION DATA MANAGEMENT TERMINAL
 * "The work is mysterious and important."
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit3,
  Box,
  FileText,
  CheckCircle,
  AlertTriangle,
  Info,
  Clock,
  Database,
  Layers,
} from 'lucide-react';

import {
  TerminalButton,
  TerminalInput,
  TerminalTextarea,
  TerminalSelect,
  TerminalModal,
  TerminalTable,
  TerminalBadge,
  TerminalAlert,
  TerminalTabs,
  TerminalTabPanel,
  TerminalPanel,
} from './terminal-ui';

import {
  categoryNames,
  Question,
  TrivialCategory,
  useQuestionsStore,
} from './store/questions-store';
import { useGlobalStore } from './store/global-store';

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY STYLING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const getCategoryClass = (category: TrivialCategory): string => {
  const classes: Record<TrivialCategory, string> = {
    [TrivialCategory.Geography]: 'category-geography',
    [TrivialCategory.Entertainment]: 'category-entertainment',
    [TrivialCategory.History]: 'category-history',
    [TrivialCategory.Arts]: 'category-arts',
    [TrivialCategory.Science]: 'category-science',
    [TrivialCategory.Sports]: 'category-sports',
  };
  return classes[category] || '';
};

const getCategoryBgClass = (category: TrivialCategory): string => {
  const classes: Record<TrivialCategory, string> = {
    [TrivialCategory.Geography]: 'category-bg-geography',
    [TrivialCategory.Entertainment]: 'category-bg-entertainment',
    [TrivialCategory.History]: 'category-bg-history',
    [TrivialCategory.Arts]: 'category-bg-arts',
    [TrivialCategory.Science]: 'category-bg-science',
    [TrivialCategory.Sports]: 'category-bg-sports',
  };
  return classes[category] || '';
};

// ═══════════════════════════════════════════════════════════════════════════
// DECORATIVE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const SystemArtifact: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <span className={`font-terminal text-terminal-xs text-lumon-text-muted/50 ${className}`}>
    {children}
  </span>
);

const CornerDecoration: React.FC = () => (
  <>
    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-lumon-cyan/30" />
    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-lumon-cyan/30" />
    <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-lumon-cyan/30" />
    <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-lumon-cyan/30" />
  </>
);

const SyncStatusIndicator: React.FC<{
  status: 'idle' | 'loading' | 'success' | 'error';
  lastSync?: string;
  totalQuestions: number;
}> = ({ status, lastSync, totalQuestions }) => {
  const getRelativeTime = (isoDate: string | undefined): string => {
    if (!isoDate) return 'JAMAIS';

    const now = Date.now();
    const syncDate = new Date(isoDate).getTime();
    const diffMs = now - syncDate;

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}J`;
    if (hours > 0) return `${hours}H`;
    if (minutes > 0) return `${minutes}M`;
    return 'NOW';
  };

  const statusConfig = {
    idle: { color: 'text-lumon-text-muted', icon: Info, text: 'STANDBY' },
    loading: { color: 'text-lumon-cyan', icon: RefreshCw, text: 'SYNCING' },
    success: { color: 'text-lumon-success', icon: CheckCircle, text: 'SYNCED' },
    error: { color: 'text-lumon-danger', icon: AlertTriangle, text: 'ERROR' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-lumon-void/50 border border-lumon-cyan-dim/20">
      <div className="flex items-center gap-2">
        <Icon
          size={14}
          className={`${config.color} ${status === 'loading' ? 'animate-spin' : ''}`}
        />
        <span className={`font-terminal text-terminal-xs uppercase ${config.color}`}>
          {config.text}
        </span>
      </div>
      <div className="w-px h-4 bg-lumon-cyan-dim/30" />
      <div className="flex items-center gap-2 text-lumon-text-muted">
        <Clock size={12} />
        <span className="font-terminal text-terminal-xs">
          {getRelativeTime(lastSync)}
        </span>
      </div>
      <div className="w-px h-4 bg-lumon-cyan-dim/30" />
      <div className="flex items-center gap-2 text-lumon-text-muted">
        <Database size={12} />
        <span className="font-terminal text-terminal-xs">
          {totalQuestions} REC
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const QuestionManagerTerminal = () => {
  const navigate = useNavigate();
  const globalStore = useGlobalStore();
  const questionsStore = useQuestionsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI State
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [selectedBox, setSelectedBox] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<TrivialCategory | 'all'>('all');
  const [importSuccess, setImportSuccess] = useState<string>('');
  const [importError, setImportError] = useState<string>('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('boxes');

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

  // Box management
  const [showBoxModal, setShowBoxModal] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');

  // Multi-selection
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'delete' | 'move' | null>(null);
  const [bulkMoveTargetBox, setBulkMoveTargetBox] = useState<string>('');

  useEffect(() => {
    globalStore.setSubtitle('DATA.TERMINAL.QUESTIONS');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═════════════════════════════════════════════════════════════════════════
  // DUPLICATE DETECTION
  // ═════════════════════════════════════════════════════════════════════════

  const findDuplicates = () => {
    const duplicates: {
      question: string;
      box: string;
      count: number;
      ids: string[];
      originalQuestions: Question[];
    }[] = [];
    const questionMap = new Map<
      string,
      { count: number; ids: string[]; questions: Question[] }
    >();

    questionsStore.questions.forEach((q) => {
      const normalizedQuestion = q.question.toLowerCase().trim();
      const key = `${normalizedQuestion}|${q.boxName}`;

      if (questionMap.has(key)) {
        const existing = questionMap.get(key)!;
        existing.count++;
        existing.ids.push(q.id);
        existing.questions.push(q);
      } else {
        questionMap.set(key, { count: 1, ids: [q.id], questions: [q] });
      }
    });

    questionMap.forEach((value, key) => {
      if (value.count > 1) {
        const [question, box] = key.split('|');
        duplicates.push({
          question,
          box,
          count: value.count,
          ids: value.ids,
          originalQuestions: value.questions,
        });
      }
    });

    return duplicates;
  };

  const handleCheckDuplicates = async () => {
    const duplicates = findDuplicates();

    if (duplicates.length === 0) {
      setImportSuccess('SCAN COMPLETE: 0 DUPLICATES DETECTED');
      setTimeout(() => setImportSuccess(''), 3000);
      return;
    }

    let message = `WARNING: ${duplicates.length} DUPLICATE(S) DETECTED\n\n`;
    duplicates.slice(0, 5).forEach((dup, index) => {
      message += `[${index + 1}] "${dup.question.substring(0, 50)}..."\n`;
      message += `    BOX: ${dup.box} | COUNT: ${dup.count}\n\n`;
    });

    if (duplicates.length > 5) {
      message += `... AND ${duplicates.length - 5} MORE\n\n`;
    }

    message += 'PROCEED WITH REMOVAL? (KEEPS FIRST INSTANCE)';

    if (!window.confirm(message)) {
      return;
    }

    let removedCount = 0;
    for (const dup of duplicates) {
      for (let i = 1; i < dup.ids.length; i++) {
        await questionsStore.deleteQuestion(dup.ids[i]);
        removedCount++;
      }
    }

    setImportSuccess(`PURGE COMPLETE: ${removedCount} DUPLICATE(S) REMOVED`);
    setTimeout(() => setImportSuccess(''), 5000);
  };

  // ═════════════════════════════════════════════════════════════════════════
  // GITHUB SYNC
  // ═════════════════════════════════════════════════════════════════════════

  const handleSyncFromGitHub = async () => {
    try {
      setImportSuccess('INITIATING GITHUB SYNC PROTOCOL...');
      await questionsStore.loadFromGitHub();

      if (questionsStore.syncStatus === 'success') {
        setImportSuccess('SYNC COMPLETE: DATA ALIGNED WITH REMOTE');
        setTimeout(() => setImportSuccess(''), 5000);
      } else {
        setImportError('SYNC FAILURE: UNABLE TO REACH REMOTE');
        setTimeout(() => setImportError(''), 5000);
      }
    } catch (error) {
      setImportError('CRITICAL: SYNC PROTOCOL FAILED');
      setTimeout(() => setImportError(''), 5000);
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // FILTERING
  // ═════════════════════════════════════════════════════════════════════════

  const filteredQuestions = useMemo(() => {
    let result = questionsStore.questions;

    if (selectedBox && selectedBox.trim()) {
      result = result.filter((q) => q.boxName === selectedBox);
    }

    if (filterCategory !== 'all') {
      result = result.filter((q) => q.category === filterCategory);
    }

    return result;
  }, [selectedBox, filterCategory, questionsStore.questions]);

  // ═════════════════════════════════════════════════════════════════════════
  // EXPORT / IMPORT
  // ═════════════════════════════════════════════════════════════════════════

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
    link.download = `questions_export_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setImportSuccess('EXPORT COMPLETE: DATA PACKAGE READY');
    setTimeout(() => setImportSuccess(''), 3000);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    let totalImported = 0;
    let totalSkipped = 0;
    let totalBoxesAdded = 0;
    let errorFiles: string[] = [];

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

        if (!data.questions || !Array.isArray(data.questions)) {
          errorFiles.push(`${file.name}: INVALID FORMAT`);
          continue;
        }

        if (data.boxes && Array.isArray(data.boxes)) {
          for (const box of data.boxes) {
            if (!questionsStore.boxes.find((b) => b.name === box.name)) {
              await questionsStore.addBox(box.name);
              totalBoxesAdded++;
            }
          }
        }

        if (data.trivialBoxes && Array.isArray(data.trivialBoxes)) {
          for (const boxName of data.trivialBoxes) {
            if (!questionsStore.boxes.find((b) => b.name === boxName)) {
              await questionsStore.addBox(boxName);
              totalBoxesAdded++;
            }
          }
        }

        for (const q of data.questions) {
          const normalizedQuestion: Question = {
            ...q,
            boxName: q.boxName || q.trivialBox || 'Sans boîte',
          };

          if ('trivialBox' in normalizedQuestion) {
            delete (normalizedQuestion as any).trivialBox;
          }

          const exists = questionsStore.questions.find(
            (existing) =>
              existing.question === normalizedQuestion.question &&
              existing.boxName === normalizedQuestion.boxName
          );

          if (!exists) {
            await questionsStore.addQuestion(normalizedQuestion);
            totalImported++;
          } else {
            totalSkipped++;
          }
        }
      } catch (error) {
        errorFiles.push(
          `${file.name}: ${error instanceof Error ? error.message : 'UNKNOWN ERROR'}`
        );
      }
    }

    if (totalImported > 0 || totalBoxesAdded > 0) {
      let message = `IMPORT SUCCESSFUL\n`;
      if (totalBoxesAdded > 0) message += `BOXES: +${totalBoxesAdded}\n`;
      message += `RECORDS: +${totalImported}`;
      if (totalSkipped > 0) message += `\nSKIPPED: ${totalSkipped} (DUPLICATE)`;

      setImportSuccess(message);
      setTimeout(() => setImportSuccess(''), 8000);
    }

    if (errorFiles.length > 0) {
      setImportError(`IMPORT ERRORS:\n${errorFiles.join('\n')}`);
      setTimeout(() => setImportError(''), 8000);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // MODAL HANDLERS
  // ═════════════════════════════════════════════════════════════════════════

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const alternativeAnswers = formData.alternativeAnswers
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    if (editingQuestion) {
      await questionsStore.updateQuestion(editingQuestion.id, {
        question: formData.question,
        answer: formData.answer,
        alternativeAnswers: alternativeAnswers.length > 0 ? alternativeAnswers : undefined,
        category: formData.category,
        boxName: formData.boxName,
        cardNumber: formData.cardNumber,
        difficulty: formData.difficulty,
      });
    } else {
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
      await questionsStore.addQuestion(newQuestion);
    }

    handleCloseModal();
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (window.confirm('CONFIRM: DELETE THIS RECORD?')) {
      await questionsStore.deleteQuestion(questionId);
    }
  };

  const handleAddBox = async () => {
    if (newBoxName.trim()) {
      await questionsStore.addBox(newBoxName.trim());
      setNewBoxName('');
      setShowBoxModal(false);
    }
  };

  const handleDeleteBox = async (boxName: string) => {
    const box = questionsStore.getBoxByName(boxName);
    if (!box) return;

    if (
      !window.confirm(
        `WARNING: DELETE BOX "${boxName}" AND ALL ${box.totalQuestions} RECORDS?`
      )
    ) {
      return;
    }

    await questionsStore.removeBox(boxName);
  };

  const handleDeleteCard = async (boxName: string, cardNumber: number) => {
    const cardQuestions = questionsStore.getQuestionsByCard(boxName, cardNumber);

    if (
      !window.confirm(`DELETE CARD #${cardNumber}? (${cardQuestions.length} RECORDS)`)
    ) {
      return;
    }

    for (const q of cardQuestions) {
      await questionsStore.deleteQuestion(q.id);
    }
  };

  const getCategoryCountsForCard = (
    questions: Question[]
  ): Record<TrivialCategory, number> => {
    const counts: Record<TrivialCategory, number> = {
      [TrivialCategory.Geography]: 0,
      [TrivialCategory.Entertainment]: 0,
      [TrivialCategory.History]: 0,
      [TrivialCategory.Arts]: 0,
      [TrivialCategory.Science]: 0,
      [TrivialCategory.Sports]: 0,
    };

    questions.forEach((q) => {
      counts[q.category]++;
    });

    return counts;
  };

  // ═════════════════════════════════════════════════════════════════════════
  // BULK ACTIONS
  // ═════════════════════════════════════════════════════════════════════════

  const handleBulkDelete = async () => {
    if (!window.confirm(`DELETE ${selectedQuestions.size} SELECTED RECORDS?`)) {
      return;
    }

    const ids = Array.from(selectedQuestions);
    for (const id of ids) {
      await questionsStore.deleteQuestion(id);
    }

    const remainingQuestions = questionsStore.getQuestionsByBox(selectedBox);
    if (selectedBox && remainingQuestions.length === 0) {
      setSelectedBox('');
    }

    setSelectedQuestions(new Set());
    setShowBulkActionsModal(false);
  };

  const handleBulkMove = async () => {
    if (!bulkMoveTargetBox) {
      alert('SELECT TARGET BOX');
      return;
    }

    const ids = Array.from(selectedQuestions);
    for (const id of ids) {
      await questionsStore.updateQuestion(id, { boxName: bulkMoveTargetBox });
    }

    const remainingQuestions = questionsStore.getQuestionsByBox(selectedBox);
    if (selectedBox && remainingQuestions.length === 0) {
      setSelectedBox('');
    }

    setSelectedQuestions(new Set());
    setShowBulkActionsModal(false);
    setBulkMoveTargetBox('');
  };

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  const boxOptions = questionsStore.getBoxes().map((box) => ({
    value: box.name,
    label: `${box.name} (${box.totalQuestions})`,
  }));

  const categoryOptions = Object.entries(categoryNames).map(([key, name]) => ({
    value: parseInt(key),
    label: name,
  }));

  const difficultyOptions = [
    { value: 'easy', label: 'EASY' },
    { value: 'medium', label: 'MEDIUM' },
    { value: 'hard', label: 'HARD' },
  ];

  return (
    <div className="min-h-screen bg-lumon-void p-6 scanlines-subtle">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        multiple
        className="hidden"
        onChange={handleImport}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <TerminalButton
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={16} />}
              onClick={() => navigate('/quiz')}
            >
              RETURN
            </TerminalButton>
            <div className="h-6 w-px bg-lumon-cyan-dim/30" />
            <div>
              <h1 className="font-display text-display-md text-lumon-cyan tracking-ultra-wide">
                DATA.TERMINAL
              </h1>
              <SystemArtifact>
                SYS.QUESTIONS.MANAGER // v2.0.4 // SESSION:{' '}
                {Math.random().toString(36).substr(2, 8).toUpperCase()}
              </SystemArtifact>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TerminalButton
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={handleSyncFromGitHub}
            >
              SYNC
            </TerminalButton>
            <TerminalButton
              size="sm"
              variant="amber"
              icon={<Search size={14} />}
              onClick={handleCheckDuplicates}
            >
              SCAN
            </TerminalButton>
            <TerminalButton
              size="sm"
              icon={<Download size={14} />}
              onClick={handleExport}
            >
              EXPORT
            </TerminalButton>
            <TerminalButton
              size="sm"
              icon={<Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
            >
              IMPORT
            </TerminalButton>
          </div>
        </div>

        {/* Sync Status */}
        <SyncStatusIndicator
          status={questionsStore.syncStatus}
          lastSync={questionsStore.lastGitHubSync}
          totalQuestions={questionsStore.questions.length}
        />
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          ALERTS
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {importSuccess && (
          <TerminalAlert
            variant="success"
            dismissible
            onDismiss={() => setImportSuccess('')}
            className="mb-4"
          >
            <pre className="font-terminal text-terminal-sm whitespace-pre-wrap">
              {importSuccess}
            </pre>
          </TerminalAlert>
        )}
        {importError && (
          <TerminalAlert
            variant="danger"
            dismissible
            onDismiss={() => setImportError('')}
            className="mb-4"
          >
            <pre className="font-terminal text-terminal-sm whitespace-pre-wrap">
              {importError}
            </pre>
          </TerminalAlert>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT - TABS
      ═══════════════════════════════════════════════════════════════════ */}
      <TerminalTabs
        tabs={[
          { key: 'boxes', label: 'CONTAINERS', icon: <Box size={14} />, badge: questionsStore.getBoxes().length },
          { key: 'questions', label: 'RECORDS', icon: <FileText size={14} />, badge: questionsStore.questions.length },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {/* ═══════════════════════════════════════════════════════════════
            BOXES TAB
        ═══════════════════════════════════════════════════════════════ */}
        <TerminalTabPanel tabKey="boxes" activeTab={activeTab}>
          <div className="flex items-center justify-between mb-4">
            <TerminalButton
              icon={<Plus size={14} />}
              onClick={() => setShowBoxModal(true)}
            >
              NEW CONTAINER
            </TerminalButton>

            <TerminalSelect
              options={[
                { value: '', label: 'ALL CONTAINERS' },
                ...boxOptions,
              ]}
              value={selectedBox}
              onChange={(e) => setSelectedBox(e.target.value)}
              fullWidth={false}
              className="w-64"
            />
          </div>

          {questionsStore.getBoxes().length === 0 ? (
            <div className="text-center py-16 border border-lumon-cyan-dim/20 border-dashed">
              <Layers size={48} className="mx-auto mb-4 text-lumon-text-muted" />
              <p className="font-terminal text-terminal-base text-lumon-text-muted">
                NO CONTAINERS FOUND
              </p>
              <p className="font-terminal text-terminal-xs text-lumon-text-muted/50 mt-1">
                CREATE A CONTAINER TO BEGIN DATA ENTRY
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(selectedBox
                ? questionsStore.getBoxes().filter((b) => b.name === selectedBox)
                : questionsStore.getBoxes()
              ).map((box) => (
                <TerminalPanel
                  key={box.name}
                  className="relative"
                  glow
                  actions={
                    <TerminalButton
                      size="sm"
                      variant="danger"
                      icon={<Trash2 size={12} />}
                      onClick={() => handleDeleteBox(box.name)}
                    />
                  }
                >
                  <CornerDecoration />

                  <div className="flex items-center gap-3 mb-4">
                    <Box size={20} className="text-lumon-cyan" />
                    <h3 className="font-display text-display-sm text-lumon-text uppercase tracking-wide-tech">
                      {box.name}
                    </h3>
                  </div>

                  <div className="flex gap-3 mb-4">
                    <TerminalBadge variant="cyan">
                      {box.cardNumbers.length} CARDS
                    </TerminalBadge>
                    <TerminalBadge variant="muted">
                      {box.totalQuestions} RECORDS
                    </TerminalBadge>
                  </div>

                  {box.cardNumbers.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {box.cardNumbers.map((cardNum) => {
                        const cardQuestions = questionsStore.getQuestionsByCard(
                          box.name,
                          cardNum
                        );
                        const categoryCounts = getCategoryCountsForCard(cardQuestions);
                        const isComplete = Object.values(categoryCounts).every(
                          (c) => c === 1
                        );
                        const isExpanded =
                          expandedCard === `${box.name}-${cardNum}`;

                        return (
                          <motion.div
                            key={cardNum}
                            className={`
                              p-2 border cursor-pointer transition-all
                              ${isComplete ? 'border-lumon-success/50' : 'border-lumon-amber-dim'}
                              ${isExpanded ? 'bg-lumon-cyan/5' : 'hover:bg-lumon-cyan/5'}
                            `}
                            onClick={() =>
                              setExpandedCard(isExpanded ? null : `${box.name}-${cardNum}`)
                            }
                            layout
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-terminal text-terminal-sm text-lumon-text">
                                #{cardNum}
                              </span>
                              {isComplete ? (
                                <CheckCircle
                                  size={12}
                                  className="text-lumon-success"
                                />
                              ) : (
                                <span className="font-terminal text-terminal-xs text-lumon-amber">
                                  {cardQuestions.length}/6
                                </span>
                              )}
                            </div>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-2 pt-2 border-t border-lumon-cyan-dim/20"
                                >
                                  {Object.entries(categoryNames).map(([key, name]) => {
                                    const count =
                                      categoryCounts[parseInt(key) as TrivialCategory];
                                    return (
                                      <div
                                        key={key}
                                        className="flex justify-between text-terminal-xs"
                                      >
                                        <span
                                          className={getCategoryClass(
                                            parseInt(key) as TrivialCategory
                                          )}
                                        >
                                          {name.substring(0, 3).toUpperCase()}
                                        </span>
                                        <span
                                          className={
                                            count > 0
                                              ? 'text-lumon-success'
                                              : 'text-lumon-danger'
                                          }
                                        >
                                          {count > 0 ? '●' : '○'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  <TerminalButton
                                    size="sm"
                                    variant="danger"
                                    fullWidth
                                    className="mt-2"
                                    icon={<Trash2 size={10} />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCard(box.name, cardNum);
                                    }}
                                  >
                                    DELETE
                                  </TerminalButton>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="font-terminal text-terminal-xs text-lumon-text-muted">
                      NO CARDS IN THIS CONTAINER
                    </p>
                  )}

                  <TerminalButton
                    size="sm"
                    className="mt-4"
                    icon={<Plus size={12} />}
                    onClick={() => navigate('/convertisseur')}
                  >
                    ADD CARD
                  </TerminalButton>
                </TerminalPanel>
              ))}
            </div>
          )}
        </TerminalTabPanel>

        {/* ═══════════════════════════════════════════════════════════════
            QUESTIONS TAB
        ═══════════════════════════════════════════════════════════════ */}
        <TerminalTabPanel tabKey="questions" activeTab={activeTab}>
          {/* Filters */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <TerminalSelect
                options={[
                  { value: '', label: 'ALL CONTAINERS' },
                  ...boxOptions,
                ]}
                value={selectedBox}
                onChange={(e) => setSelectedBox(e.target.value)}
                fullWidth={false}
                className="w-56"
              />
              <TerminalSelect
                options={[
                  { value: 'all', label: 'ALL CATEGORIES' },
                  ...categoryOptions,
                ]}
                value={filterCategory}
                onChange={(e) =>
                  setFilterCategory(
                    e.target.value === 'all'
                      ? 'all'
                      : (parseInt(e.target.value) as TrivialCategory)
                  )
                }
                fullWidth={false}
                className="w-48"
              />
            </div>

            <TerminalButton icon={<Plus size={14} />} onClick={() => handleOpenModal()}>
              NEW RECORD
            </TerminalButton>
          </div>

          {/* Bulk Actions Bar */}
          <AnimatePresence>
            {selectedQuestions.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <TerminalAlert variant="info" className="flex items-center justify-between">
                  <span className="font-terminal text-terminal-base">
                    <strong>{selectedQuestions.size}</strong> RECORD(S) SELECTED
                  </span>
                  <div className="flex gap-2">
                    <TerminalButton
                      size="sm"
                      icon={<Box size={12} />}
                      onClick={() => {
                        setBulkAction('move');
                        setShowBulkActionsModal(true);
                      }}
                    >
                      RELOCATE
                    </TerminalButton>
                    <TerminalButton
                      size="sm"
                      variant="danger"
                      icon={<Trash2 size={12} />}
                      onClick={() => {
                        setBulkAction('delete');
                        setShowBulkActionsModal(true);
                      }}
                    >
                      DELETE
                    </TerminalButton>
                  </div>
                </TerminalAlert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Questions Table */}
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-16 border border-lumon-cyan-dim/20 border-dashed">
              <FileText size={48} className="mx-auto mb-4 text-lumon-text-muted" />
              <p className="font-terminal text-terminal-base text-lumon-text-muted">
                NO RECORDS FOUND
              </p>
              <p className="font-terminal text-terminal-xs text-lumon-text-muted/50 mt-1">
                ADD A CONTAINER AND CREATE RECORDS
              </p>
            </div>
          ) : (
            <TerminalTable
              columns={[
                {
                  key: 'boxName',
                  header: 'CONTAINER',
                  width: '120px',
                  render: (q: Question) => (
                    <TerminalBadge variant="muted">{q.boxName}</TerminalBadge>
                  ),
                },
                {
                  key: 'cardNumber',
                  header: 'CARD',
                  width: '70px',
                  align: 'center',
                  render: (q: Question) =>
                    q.cardNumber !== undefined ? (
                      <span className="font-terminal text-terminal-sm text-lumon-cyan">
                        #{q.cardNumber}
                      </span>
                    ) : (
                      <span className="text-lumon-text-muted">-</span>
                    ),
                },
                {
                  key: 'category',
                  header: 'TYPE',
                  width: '110px',
                  render: (q: Question) => (
                    <span
                      className={`
                        font-terminal text-terminal-xs uppercase px-2 py-0.5 border
                        ${getCategoryClass(q.category)}
                        ${getCategoryBgClass(q.category)}
                      `}
                    >
                      {categoryNames[q.category].substring(0, 4)}
                    </span>
                  ),
                },
                {
                  key: 'question',
                  header: 'QUERY',
                  render: (q: Question) => (
                    <span className="font-terminal text-terminal-base text-lumon-text line-clamp-2">
                      {q.question}
                    </span>
                  ),
                },
                {
                  key: 'answer',
                  header: 'RESPONSE',
                  width: '180px',
                  render: (q: Question) => (
                    <div>
                      <span className="font-terminal text-terminal-base text-lumon-text font-bold">
                        {q.answer}
                      </span>
                      {q.alternativeAnswers && q.alternativeAnswers.length > 0 && (
                        <span className="block font-terminal text-terminal-xs text-lumon-text-muted mt-0.5">
                          ALT: {q.alternativeAnswers.join(', ')}
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  header: 'CMD',
                  width: '100px',
                  align: 'center',
                  render: (q: Question) => (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(q);
                        }}
                        className="p-1.5 text-lumon-text-dim hover:text-lumon-cyan hover:bg-lumon-cyan/10 transition-colors"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteQuestion(q.id);
                        }}
                        className="p-1.5 text-lumon-text-dim hover:text-lumon-danger hover:bg-lumon-danger/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ),
                },
              ]}
              data={filteredQuestions}
              keyExtractor={(q) => q.id}
              selectable
              selectedKeys={selectedQuestions}
              onSelectionChange={setSelectedQuestions}
              maxHeight="calc(100vh - 400px)"
            />
          )}
        </TerminalTabPanel>
      </TerminalTabs>

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════════════════ */}

      {/* New Box Modal */}
      <TerminalModal
        isOpen={showBoxModal}
        onClose={() => setShowBoxModal(false)}
        title="CREATE CONTAINER"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <TerminalButton variant="ghost" onClick={() => setShowBoxModal(false)}>
              CANCEL
            </TerminalButton>
            <TerminalButton onClick={handleAddBox}>CREATE</TerminalButton>
          </div>
        }
      >
        <TerminalInput
          label="CONTAINER NAME"
          placeholder="e.g., CINEMA 91, HISTORY..."
          value={newBoxName}
          onChange={(e) => setNewBoxName(e.target.value)}
          variant="box"
        />
      </TerminalModal>

      {/* Question Edit Modal */}
      <TerminalModal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingQuestion ? 'MODIFY RECORD' : 'CREATE RECORD'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <TerminalButton variant="ghost" onClick={handleCloseModal}>
              CANCEL
            </TerminalButton>
            <TerminalButton onClick={handleSubmit}>
              {editingQuestion ? 'UPDATE' : 'CREATE'}
            </TerminalButton>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TerminalSelect
              label="CONTAINER *"
              options={[
                { value: '', label: 'SELECT CONTAINER...' },
                ...boxOptions.map((b) => ({ value: b.value, label: b.value })),
              ]}
              value={formData.boxName}
              onChange={(e) => setFormData({ ...formData, boxName: e.target.value })}
            />

            <TerminalInput
              label="CARD NUMBER (OPTIONAL)"
              type="number"
              placeholder="Leave empty for non-card"
              value={formData.cardNumber || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cardNumber: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              variant="box"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TerminalSelect
              label="CATEGORY *"
              options={categoryOptions}
              value={formData.category}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  category: parseInt(e.target.value) as TrivialCategory,
                })
              }
            />

            <TerminalSelect
              label="DIFFICULTY"
              options={difficultyOptions}
              value={formData.difficulty}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  difficulty: e.target.value as 'easy' | 'medium' | 'hard',
                })
              }
            />
          </div>

          <TerminalTextarea
            label="QUESTION *"
            placeholder="Enter the question..."
            value={formData.question}
            onChange={(e) => setFormData({ ...formData, question: e.target.value })}
            rows={3}
          />

          <TerminalInput
            label="CORRECT RESPONSE *"
            placeholder="The correct answer"
            value={formData.answer}
            onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
            variant="box"
          />

          <TerminalInput
            label="ALTERNATIVE RESPONSES (OPTIONAL)"
            placeholder="Separate with commas: alt1, alt2, alt3"
            value={formData.alternativeAnswers}
            onChange={(e) =>
              setFormData({ ...formData, alternativeAnswers: e.target.value })
            }
            variant="box"
            hint="Spelling tolerance is automatically applied"
          />
        </form>
      </TerminalModal>

      {/* Bulk Actions Modal */}
      <TerminalModal
        isOpen={showBulkActionsModal}
        onClose={() => setShowBulkActionsModal(false)}
        title={bulkAction === 'delete' ? 'CONFIRM DELETION' : 'RELOCATE RECORDS'}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <TerminalButton
              variant="ghost"
              onClick={() => setShowBulkActionsModal(false)}
            >
              CANCEL
            </TerminalButton>
            <TerminalButton
              variant={bulkAction === 'delete' ? 'danger' : 'primary'}
              onClick={bulkAction === 'delete' ? handleBulkDelete : handleBulkMove}
            >
              {bulkAction === 'delete' ? 'DELETE' : 'RELOCATE'}
            </TerminalButton>
          </div>
        }
      >
        {bulkAction === 'delete' ? (
          <p className="font-terminal text-terminal-base text-lumon-text">
            CONFIRM DELETION OF{' '}
            <span className="text-lumon-danger font-bold">
              {selectedQuestions.size}
            </span>{' '}
            RECORD(S)?
          </p>
        ) : (
          <TerminalSelect
            label="TARGET CONTAINER"
            options={[
              { value: '', label: 'SELECT CONTAINER...' },
              ...boxOptions.map((b) => ({ value: b.value, label: b.value })),
            ]}
            value={bulkMoveTargetBox}
            onChange={(e) => setBulkMoveTargetBox(e.target.value)}
          />
        )}
      </TerminalModal>

      {/* ═══════════════════════════════════════════════════════════════════
          DECORATIVE FOOTER
      ═══════════════════════════════════════════════════════════════════ */}
      <footer className="fixed bottom-0 left-0 right-0 h-6 bg-lumon-void/95 border-t border-lumon-cyan-dim/20 flex items-center justify-between px-4">
        <SystemArtifact>
          MDE.DATA.TERMINAL // ACTIVE
        </SystemArtifact>
        <div className="flex items-center gap-4">
          <SystemArtifact>
            REC: {questionsStore.questions.length}
          </SystemArtifact>
          <SystemArtifact>
            0x{Date.now().toString(16).toUpperCase().slice(-8)}
          </SystemArtifact>
        </div>
      </footer>
    </div>
  );
};

export default QuestionManagerTerminal;
