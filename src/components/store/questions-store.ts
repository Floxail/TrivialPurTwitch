import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { loadQuestionsFromGitHub, mergeQuestionsFromGitHub } from '../../services/github-data-service';

const localStorageKey: string = 'quiz_questions_storage_v2';

// Catégories Trivial Pursuit standard
export enum TrivialCategory {
  Geography = 0,      // Bleu
  Entertainment = 1,  // Rose
  History = 2,        // Jaune
  Arts = 3,          // Marron/Orange
  Science = 4,       // Vert
  Sports = 5         // Orange
}

export const categoryNames: Record<TrivialCategory, string> = {
  [TrivialCategory.Geography]: '▲ Bleu',
  [TrivialCategory.Entertainment]: '▲ Rose',
  [TrivialCategory.History]: '▲ Jaune',
  [TrivialCategory.Arts]: '▲ Marron',
  [TrivialCategory.Science]: '▲ Vert',
  [TrivialCategory.Sports]: '▲ Orange',
};

export const categoryColors: Record<TrivialCategory, string> = {
  [TrivialCategory.Geography]: '#4A90E2',      // Bleu
  [TrivialCategory.Entertainment]: '#E91E63',  // Rose
  [TrivialCategory.History]: '#FFC107',        // Jaune
  [TrivialCategory.Arts]: '#533303ff',           //Marron
  [TrivialCategory.Science]: '#4CAF50',        // Vert
  [TrivialCategory.Sports]: '#FF5722',         // Rouge-Orange
};

// Type de question
export enum QuestionType {
  FREE_TEXT = 'free_text',  // Réponse libre (mode actuel)
  QCM = 'qcm'               // Questionnaire à Choix Multiples
}

export type Question = {
  id: string;
  category: TrivialCategory;
  question: string;
  answer: string;
  alternativeAnswers?: string[]; // Réponses alternatives acceptées (mode FREE_TEXT)
  boxName: string; // Nom de la boîte
  cardNumber?: number; // Numéro de carte (pour organisation)
  difficulty?: 'easy' | 'medium' | 'hard';

  // Champs QCM
  questionType?: QuestionType; // Par défaut FREE_TEXT si non spécifié
  qcmOptions?: string[]; // 4 options (A, B, C, D)
  qcmCorrectIndex?: number; // Index de la bonne réponse (0-3)
};

// Structure d'une boîte (contient plusieurs cartes)
export type TrivialBox = {
  name: string; // Ex: "Cinéma 91"
  cardNumbers: number[]; // Ex: [1, 2, 3, 4, 5]
  totalQuestions: number; // Nombre total de questions dans cette boîte
};

// Carte de quiz (mode CARD)
export type QuizCard = {
  questions: Question[]; // 6 questions, une par catégorie
  boxName: string;
  cardNumber: number;
};

export class QuestionsData {
  questions: Question[] = [];
  boxes: TrivialBox[] = []; // Liste des boîtes avec leurs cartes
  syncStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  lastGitHubSync?: string;
  lastGitHubQuestionIds: string[] = []; // IDs des questions GitHub lors de la dernière sync

  // Settings
  cumulativeScoresInCardMode: boolean = false; // Cumuler les scores entre cartes
  cumulativeScoresInQuizMode: boolean = false; // Cumuler les scores entre quiz
  defaultQuizQuestions: number = 10; // Nombre de questions par défaut en mode QUIZ
}

type QuestionsActions = {
  backup: () => void;
  clear: () => void;

  // Gestion des questions
  addQuestion: (question: Question) => void;
  updateQuestion: (questionId: string, updates: Partial<Question>) => void;
  deleteQuestion: (questionId: string) => void;

  // Gestion des boîtes
  getBoxes: () => TrivialBox[];
  getBoxByName: (boxName: string) => TrivialBox | undefined;
  addBox: (boxName: string) => void;
  removeBox: (boxName: string) => void;
  rebuildBoxes: (questions: Question[]) => TrivialBox[];

  // Récupération des questions
  getQuestionsByBox: (boxName: string) => Question[];
  getQuestionsByCard: (boxName: string, cardNumber: number) => Question[];
  getCardNumbersForBox: (boxName: string) => number[];

  // Génération de quiz
  generateQuizCard: (boxName: string, cardNumber: number) => QuizCard | null;
  generateRandomQuiz: (boxName: string, questionCount: number) => Question[] | null;
  generateRandomQuizAllBoxes: (questionCount: number, balanceCategories?: boolean) => Question[] | null;

  // Settings
  setCumulativeScores: (value: boolean) => void;
  setCumulativeScoresQuiz: (value: boolean) => void;
  setDefaultQuizQuestions: (count: number) => void;

  // Migration
  migrateFromV1: () => void;

  // Fusionner les questions depuis GitHub
  loadFromGitHub: () => Promise<void>;

  // Backup complet
  exportFullBackup: () => any;
  importFullBackup: (backupData: any) => boolean;

  // Dédoublonnage
  removeDuplicates: () => number;
};

// Restore persisted state
const plain: QuestionsData = JSON.parse(localStorage.getItem(localStorageKey) || '{}');
const restoredState: QuestionsData = {
  questions: plain.questions || [],
  boxes: plain.boxes || [],
  syncStatus: 'idle',
  lastGitHubSync: plain.lastGitHubSync,
  lastGitHubQuestionIds: plain.lastGitHubQuestionIds || [],
  cumulativeScoresInCardMode: plain.cumulativeScoresInCardMode || false,
  cumulativeScoresInQuizMode: plain.cumulativeScoresInQuizMode || false,
  defaultQuizQuestions: plain.defaultQuizQuestions || 10,
};

export const useQuestionsStore = create<QuestionsData & QuestionsActions>()(
  persist(
    (set, get) => ({
      ...restoredState,

      backup: () => {
        const current = get();
        const toSave = {
          questions: current.questions,
          boxes: current.boxes,
          lastGitHubSync: current.lastGitHubSync,
          lastGitHubQuestionIds: current.lastGitHubQuestionIds,
          cumulativeScoresInCardMode: current.cumulativeScoresInCardMode,
          cumulativeScoresInQuizMode: current.cumulativeScoresInQuizMode,
          defaultQuizQuestions: current.defaultQuizQuestions,
        };
        localStorage.setItem(localStorageKey, JSON.stringify(toSave));
      },

      clear: () => {
        set({
          questions: [],
          boxes: [],
          syncStatus: 'idle',
          lastGitHubSync: undefined,
          lastGitHubQuestionIds: [],
          cumulativeScoresInCardMode: false,
          cumulativeScoresInQuizMode: false,
          defaultQuizQuestions: 10,
        });
        get().backup();
      },

      // ========== GESTION DES QUESTIONS ==========

      addQuestion: (question: Question) => {
        const currentQuestions = get().questions;
        const newQuestions = [...currentQuestions, question];
        const boxes = get().rebuildBoxes(newQuestions);

        set({
          questions: newQuestions,
          boxes: boxes,
        });
        get().backup();
      },

      updateQuestion: (questionId: string, updates: Partial<Question>) => {
        const currentQuestions = get().questions;
        const newQuestions = currentQuestions.map((q) =>
          q.id === questionId ? { ...q, ...updates } : q
        );
        const boxes = get().rebuildBoxes(newQuestions);

        set({
          questions: newQuestions,
          boxes: boxes,
        });
        get().backup();
      },

      deleteQuestion: (questionId: string) => {
        const currentQuestions = get().questions;
        const newQuestions = currentQuestions.filter((q) => q.id !== questionId);
        const boxes = get().rebuildBoxes(newQuestions);

        set({
          questions: newQuestions,
          boxes: boxes,
        });
        get().backup();
      },

      // ========== GESTION DES BOÎTES ==========

      rebuildBoxes: (questions: Question[]): TrivialBox[] => {
        const boxMap = new Map<string, Set<number>>();

        questions.forEach((q) => {
          if (!boxMap.has(q.boxName)) {
            boxMap.set(q.boxName, new Set());
          }
          if (q.cardNumber !== undefined) {
            boxMap.get(q.boxName)!.add(q.cardNumber);
          }
        });

        const boxes: TrivialBox[] = [];
        boxMap.forEach((cardSet, boxName) => {
          const cardNumbers = Array.from(cardSet).sort((a, b) => a - b);
          const totalQuestions = questions.filter((q) => q.boxName === boxName).length;
          boxes.push({
            name: boxName,
            cardNumbers,
            totalQuestions,
          });
        });

        return boxes.sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'fr', { sensitivity: 'base' })
        );
      },

      getBoxes: () => {
        return get().boxes;
      },

      getBoxByName: (boxName: string) => {
        return get().boxes.find((box) => box.name === boxName);
      },

      addBox: (boxName: string) => {
        const currentBoxes = get().boxes;
        if (currentBoxes.find((box) => box.name === boxName)) {
          return; // La boîte existe déjà
        }

        const newBox: TrivialBox = {
          name: boxName,
          cardNumbers: [],
          totalQuestions: 0,
        };

        set({ boxes: [...currentBoxes, newBox] });
        get().backup();
      },

      removeBox: (boxName: string) => {
        const currentQuestions = get().questions;
        const newQuestions = currentQuestions.filter((q) => q.boxName !== boxName);
        const boxes = get().rebuildBoxes(newQuestions);

        set({
          questions: newQuestions,
          boxes: boxes,
        });
        get().backup();
      },

      // ========== RÉCUPÉRATION DES QUESTIONS ==========

      getQuestionsByBox: (boxName: string) => {
        return get().questions.filter((q) => q.boxName === boxName);
      },

      getQuestionsByCard: (boxName: string, cardNumber: number) => {
        return get().questions.filter(
          (q) => q.boxName === boxName && q.cardNumber === cardNumber
        );
      },

      getCardNumbersForBox: (boxName: string) => {
        const box = get().getBoxByName(boxName);
        return box ? box.cardNumbers : [];
      },

      // ========== GÉNÉRATION DE QUIZ ==========

      generateQuizCard: (boxName: string, cardNumber: number): QuizCard | null => {
        const questions = get().getQuestionsByCard(boxName, cardNumber);

        if (questions.length === 0) {
          return null;
        }

        // Vérifier qu'on a bien une question par catégorie
        const categoryCounts = new Map<TrivialCategory, number>();
        questions.forEach((q) => {
          categoryCounts.set(q.category, (categoryCounts.get(q.category) || 0) + 1);
        });

        // Une carte valide doit avoir exactement 6 questions (une par catégorie)
        if (questions.length !== 6 || categoryCounts.size !== 6) {
          console.warn(
            `Carte ${boxName} #${cardNumber} invalide : ${questions.length} questions, ${categoryCounts.size} catégories`
          );
        }

        return {
          questions,
          boxName,
          cardNumber,
        };
      },

      generateRandomQuiz: (boxName: string, questionCount: number): Question[] | null => {
        const allQuestions = get().getQuestionsByBox(boxName);

        if (allQuestions.length === 0) {
          return null;
        }

        // Mélanger et prendre N questions
        const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(questionCount, shuffled.length));
      },

      generateRandomQuizAllBoxes: (questionCount: number, balanceCategories: boolean = false): Question[] | null => {
        const allQuestions = get().questions;

        if (allQuestions.length === 0) {
          return null;
        }

        if (!balanceCategories) {
          // Mode simple : mélanger toutes les questions
          const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
          return shuffled.slice(0, Math.min(questionCount, shuffled.length));
        }

        // Mode équilibré : essayer d'avoir une répartition équitable des catégories
        const byCategory = new Map<TrivialCategory, Question[]>();

        // Grouper par catégorie
        allQuestions.forEach(q => {
          if (!byCategory.has(q.category)) {
            byCategory.set(q.category, []);
          }
          byCategory.get(q.category)!.push(q);
        });

        // Mélanger chaque catégorie
        byCategory.forEach((questions, cat) => {
          byCategory.set(cat, questions.sort(() => Math.random() - 0.5));
        });

        const result: Question[] = [];
        let remaining = questionCount;

        // Prendre des questions de chaque catégorie en rotation
        const categories = Array.from(byCategory.keys()).sort(() => Math.random() - 0.5);
        let catIndex = 0;

        while (remaining > 0 && categories.length > 0) {
          const cat = categories[catIndex % categories.length];
          const catQuestions = byCategory.get(cat)!;

          if (catQuestions.length > 0) {
            result.push(catQuestions.shift()!);
            remaining--;
          } else {
            // Plus de questions dans cette catégorie, la retirer
            categories.splice(catIndex % categories.length, 1);
            if (categories.length === 0) break;
          }

          catIndex++;
        }

        // Mélanger le résultat final pour varier l'ordre des catégories
        return result.sort(() => Math.random() - 0.5);
      },

      // ========== SETTINGS ==========

      setCumulativeScores: (value: boolean) => {
        set({ cumulativeScoresInCardMode: value });
        get().backup();
      },

      setCumulativeScoresQuiz: (value: boolean) => {
        set({ cumulativeScoresInQuizMode: value });
        get().backup();
      },

      setDefaultQuizQuestions: (count: number) => {
        const validCount = Math.max(1, Math.min(100, count));
        set({ defaultQuizQuestions: validCount });
        get().backup();
      },

      // ========== MIGRATION ==========

      migrateFromV1: () => {
        try {
          const v1Data = localStorage.getItem('quiz_storage');
          if (!v1Data) {
            console.log('Aucune donnée v1 à migrer');
            return;
          }

          const parsed = JSON.parse(v1Data);
          if (!parsed.state || !parsed.state.questions) {
            console.log('Format v1 invalide');
            return;
          }

          const v1Questions = parsed.state.questions;
          console.log(`Migration de ${v1Questions.length} questions depuis v1...`);

          const boxes = get().rebuildBoxes(v1Questions);
          set({
            questions: v1Questions,
            boxes: boxes,
          });
          get().backup();

          console.log('✅ Migration v1 → v2 terminée');
        } catch (error) {
          console.error('Erreur lors de la migration v1:', error);
        }
      },

      // ========== SYNCHRONISATION GITHUB ==========

      loadFromGitHub: async () => {
        try {
          set({ syncStatus: 'loading' });

          const githubData = await loadQuestionsFromGitHub();

          if (!githubData) {
            set({ syncStatus: 'error' });
            return;
          }

          const currentQuestions = get().questions;
          const previousGithubIds = get().lastGitHubQuestionIds.length > 0
            ? new Set(get().lastGitHubQuestionIds)
            : undefined;

          const mergedQuestions = mergeQuestionsFromGitHub(
            githubData,
            currentQuestions,
            previousGithubIds
          );

          // Sauvegarder les IDs GitHub actuels pour la prochaine sync
          const currentGithubIds = githubData.questions.map((q: any) => q.id);

          const boxes = get().rebuildBoxes(mergedQuestions);

          set({
            questions: mergedQuestions,
            lastGitHubQuestionIds: currentGithubIds,
            boxes: boxes,
            syncStatus: 'success',
            lastGitHubSync: new Date().toISOString(),
          });

          get().backup();

          console.log(`✅ ${mergedQuestions.length} questions chargées depuis GitHub`);
        } catch (error) {
          console.error('❌ Erreur lors du chargement GitHub:', error);
          set({ syncStatus: 'error' });
        }
      },

      // ========== BACKUP COMPLET ==========

      exportFullBackup: () => {
        const current = get();

        // Récupérer les données des autres stores
        let playerData = null;
        let settingsData = null;

        try {
          const playerStorage = localStorage.getItem('player_storage');
          if (playerStorage) {
            playerData = JSON.parse(playerStorage);
          }
        } catch (e) {
          console.warn('Impossible de charger player_storage', e);
        }

        try {
          const settingsStorage = localStorage.getItem('settings_storage');
          if (settingsStorage) {
            settingsData = JSON.parse(settingsStorage);
          }
        } catch (e) {
          console.warn('Impossible de charger settings_storage', e);
        }

        return {
          version: '2.0',
          exportDate: new Date().toISOString(),
          quiz: {
            questions: current.questions,
            boxes: current.boxes,
            cumulativeScoresInCardMode: current.cumulativeScoresInCardMode,
            cumulativeScoresInQuizMode: current.cumulativeScoresInQuizMode,
            defaultQuizQuestions: current.defaultQuizQuestions,
          },
          players: playerData,
          settings: settingsData,
        };
      },

      importFullBackup: (backupData: any): boolean => {
        try {
          // Validation basique
          if (!backupData || !backupData.version) {
            console.error('Format de backup invalide');
            return false;
          }

          // Restaurer les données du quiz
          if (backupData.quiz) {
            const boxes = get().rebuildBoxes(backupData.quiz.questions || []);

            set({
              questions: backupData.quiz.questions || [],
              boxes: boxes,
              cumulativeScoresInCardMode: backupData.quiz.cumulativeScoresInCardMode || false,
              cumulativeScoresInQuizMode: backupData.quiz.cumulativeScoresInQuizMode || false,
              defaultQuizQuestions: backupData.quiz.defaultQuizQuestions || 10,
            });

            get().backup();
          }

          // Restaurer les données des joueurs
          if (backupData.players) {
            try {
              localStorage.setItem('player_storage', JSON.stringify(backupData.players));
            } catch (e) {
              console.warn('Impossible de restaurer player_storage', e);
            }
          }

          // Restaurer les settings
          if (backupData.settings) {
            try {
              localStorage.setItem('settings_storage', JSON.stringify(backupData.settings));
            } catch (e) {
              console.warn('Impossible de restaurer settings_storage', e);
            }
          }

          console.log('✅ Backup restauré avec succès');
          return true;
        } catch (error) {
          console.error('❌ Erreur lors de la restauration du backup:', error);
          return false;
        }
      },

      // ========== DÉDOUBLONNAGE ==========

      removeDuplicates: (): number => {
        const currentQuestions = get().questions;
        const seen = new Map<string, Question>();

        // On garde la première occurrence de chaque question unique
        // Critère d'unicité: question + answer + boxName
        currentQuestions.forEach((q) => {
          const key = `${q.question.trim().toLowerCase()}|${q.answer.trim().toLowerCase()}|${q.boxName}`;
          if (!seen.has(key)) {
            seen.set(key, q);
          }
        });

        const uniqueQuestions = Array.from(seen.values());
        const removedCount = currentQuestions.length - uniqueQuestions.length;

        if (removedCount > 0) {
          const boxes = get().rebuildBoxes(uniqueQuestions);
          set({
            questions: uniqueQuestions,
            boxes: boxes,
          });
          get().backup();
          console.log(`✅ ${removedCount} doublon(s) supprimé(s)`);
        }

        return removedCount;
      },
    }),
    {
      name: 'quiz_storage',
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) =>
            ['questions', 'boxes', 'lastGitHubSync', 'lastGitHubQuestionIds',
             'cumulativeScoresInCardMode', 'cumulativeScoresInQuizMode',
             'defaultQuizQuestions'].includes(key)
          ),
        ),
    },
  ),
);
