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

// Modes de jeu
export enum QuizMode {
  CARD = 'card',    // Mode Carte : 6 questions (1 par catégorie)
  QUIZ = 'quiz'     // Mode Quiz : X questions aléatoires
}

export type Question = {
  id: string;
  category: TrivialCategory;
  question: string;
  answer: string;
  alternativeAnswers?: string[]; // Réponses alternatives acceptées
  boxName: string; // Nom de la boîte (sans #numéro)
  cardNumber?: number; // Numéro de carte (optionnel, pour le mode CARD)
  difficulty?: 'easy' | 'medium' | 'hard';
};

// Carte de quiz (mode CARD)
export type QuizCard = {
  questions: Question[]; // 6 questions, une par catégorie
  boxName: string;
  cardNumber: number;
};

// Session de quiz active
export type ActiveQuiz = {
  mode: QuizMode;
  boxName: string;
  cardNumber?: number; // Seulement en mode CARD
  questions: Question[]; // Liste des questions de cette session
  currentQuestionIndex: number;
  startTime: number;
  questionStartTime: number;
  answers: Map<number, string[]>; // Index de question -> liste des joueurs ayant répondu
  totalQuestions: number; // Nombre total de questions dans cette session
};

// Structure d'une boîte (contient plusieurs cartes)
export type TrivialBox = {
  name: string; // Ex: "Cinéma 91"
  cardNumbers: number[]; // Ex: [1, 2, 3, 4, 5]
  totalQuestions: number; // Nombre total de questions dans cette boîte
};

export class QuizData {
  questions: Question[] = [];
  boxes: TrivialBox[] = []; // Liste des boîtes avec leurs cartes
  activeQuiz: ActiveQuiz | null = null;
  completedQuizzes: number = 0;
  syncStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  lastGitHubSync?: string;

  // Settings
  cumulativeScoresInCardMode: boolean = false; // Cumuler les scores entre cartes
  cumulativeScoresInQuizMode: boolean = false; // Cumuler les scores entre quiz
  defaultQuizQuestions: number = 10; // Nombre de questions par défaut en mode QUIZ
}

type Actions = {
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

  // Gestion du quiz actif
  startQuiz: (mode: QuizMode, boxName: string, questions: Question[], cardNumber?: number) => void;
  nextQuestion: () => boolean;
  endQuiz: () => void;
  recordAnswer: (questionIndex: number, playerNick: string) => void;

  // Settings
  setCumulativeScores: (value: boolean) => void;
  setCumulativeScoresQuiz: (value: boolean) => void;
  setDefaultQuizQuestions: (count: number) => void;

  // Migration
  migrateFromV1: () => void;

  // Fusionner les questions depuis GitHub
  loadFromGitHub: () => Promise<void>;
};

// Restore persisted state
const plain: QuizData = JSON.parse(localStorage.getItem(localStorageKey) || '{}');
const restoredState: QuizData = {
  questions: plain.questions || [],
  boxes: plain.boxes || [],
  activeQuiz: null, // On ne restore pas le quiz actif
  completedQuizzes: plain.completedQuizzes || 0,
  syncStatus: 'idle',
  lastGitHubSync: plain.lastGitHubSync,
  cumulativeScoresInCardMode: plain.cumulativeScoresInCardMode || false,
  cumulativeScoresInQuizMode: plain.cumulativeScoresInQuizMode || false,
  defaultQuizQuestions: plain.defaultQuizQuestions || 10,
};

export const useQuizStore = create<QuizData & Actions>()(
  persist(
    (set, get) => ({
      questions: restoredState.questions,
      boxes: restoredState.boxes,
      activeQuiz: restoredState.activeQuiz,
      completedQuizzes: restoredState.completedQuizzes,
      syncStatus: restoredState.syncStatus,
      lastGitHubSync: restoredState.lastGitHubSync,
      cumulativeScoresInCardMode: restoredState.cumulativeScoresInCardMode,
      cumulativeScoresInQuizMode: restoredState.cumulativeScoresInQuizMode,
      defaultQuizQuestions: restoredState.defaultQuizQuestions,

      backup: () => {
        const current = get();
        const backedUp = {
          questions: current.questions,
          boxes: current.boxes,
          completedQuizzes: current.completedQuizzes,
          cumulativeScoresInCardMode: current.cumulativeScoresInCardMode,
          cumulativeScoresInQuizMode: current.cumulativeScoresInQuizMode,
          defaultQuizQuestions: current.defaultQuizQuestions,
        };
        localStorage.setItem(localStorageKey, JSON.stringify(backedUp));
      },

      clear: () => {
        localStorage.removeItem(localStorageKey);
        set({
          questions: [],
          boxes: [],
          activeQuiz: null,
          completedQuizzes: 0,
          cumulativeScoresInCardMode: false,
          cumulativeScoresInQuizMode: false,
          defaultQuizQuestions: 10,
        });
      },

      addQuestion: (question: Question) => {
        set((state) => {
          const newQuestions = [...state.questions, question];
          
          // Mettre à jour la liste des boîtes
          const boxes = get().rebuildBoxes(newQuestions);
          
          return {
            questions: newQuestions,
            boxes,
          };
        });
        get().backup();
      },

      updateQuestion: (questionId: string, updates: Partial<Question>) => {
        set((state) => {
          const newQuestions = state.questions.map((q) =>
            q.id === questionId ? { ...q, ...updates } : q
          );
          
          // Mettre à jour la liste des boîtes
          const boxes = get().rebuildBoxes(newQuestions);
          
          return {
            questions: newQuestions,
            boxes,
          };
        });
        get().backup();
      },

      deleteQuestion: (questionId: string) => {
        set((state) => {
          const newQuestions = state.questions.filter((q) => q.id !== questionId);
          
          // Mettre à jour la liste des boîtes
          const boxes = get().rebuildBoxes(newQuestions);
          
          return {
            questions: newQuestions,
            boxes,
          };
        });
        get().backup();
      },

      // Fonction utilitaire pour reconstruire la liste des boîtes à partir des questions
      rebuildBoxes: (questions: Question[]): TrivialBox[] => {
        const boxMap = new Map<string, Set<number>>();
        
        questions.forEach(q => {
          if (!boxMap.has(q.boxName)) {
            boxMap.set(q.boxName, new Set());
          }
          if (q.cardNumber !== undefined) {
            boxMap.get(q.boxName)!.add(q.cardNumber);
          }
        });
        
        const boxes: TrivialBox[] = [];
        boxMap.forEach((cardNumbers, boxName) => {
          const boxQuestions = questions.filter(q => q.boxName === boxName);
          boxes.push({
            name: boxName,
            cardNumbers: Array.from(cardNumbers).sort((a, b) => a - b),
            totalQuestions: boxQuestions.length,
          });
        });
        
        return boxes.sort((a, b) => a.name.localeCompare(b.name));
      },

      getBoxes: () => {
        return get().boxes;
      },

      getBoxByName: (boxName: string) => {
        return get().boxes.find(b => b.name.toLowerCase() === boxName.toLowerCase());
      },

      addBox: (boxName: string) => {
        set((state) => {
          if (!state.boxes.find(b => b.name === boxName)) {
            return {
              boxes: [...state.boxes, {
                name: boxName,
                cardNumbers: [],
                totalQuestions: 0,
              }].sort((a, b) => a.name.localeCompare(b.name)),
            };
          }
          return state;
        });
        get().backup();
      },

      removeBox: (boxName: string) => {
        set((state) => {
          // Supprimer toutes les questions de cette boîte
          const newQuestions = state.questions.filter(q => q.boxName !== boxName);
          const newBoxes = state.boxes.filter(b => b.name !== boxName);
          
          return {
            questions: newQuestions,
            boxes: newBoxes,
          };
        });
        get().backup();
      },

      getQuestionsByBox: (boxName: string) => {
        return get().questions.filter(q => q.boxName === boxName);
      },

      getQuestionsByCard: (boxName: string, cardNumber: number) => {
        return get().questions.filter(q => 
          q.boxName === boxName && q.cardNumber === cardNumber
        );
      },

      getCardNumbersForBox: (boxName: string) => {
        const box = get().getBoxByName(boxName);
        return box?.cardNumbers || [];
      },

      generateQuizCard: (boxName: string, cardNumber: number) => {
        const cardQuestions = get().getQuestionsByCard(boxName, cardNumber);
        
        // Vérifier qu'on a exactement 6 questions (une par catégorie)
        if (cardQuestions.length !== 6) {
          console.error(`La carte ${boxName} #${cardNumber} doit contenir exactement 6 questions`);
          return null;
        }
        
        // Vérifier qu'on a une question par catégorie
        const categoriesPresent = new Set(cardQuestions.map(q => q.category));
        if (categoriesPresent.size !== 6) {
          console.error(`La carte doit contenir une question de chaque catégorie`);
          return null;
        }
        
        // Trier les questions par catégorie (0 à 5)
        const sortedQuestions = cardQuestions.sort((a, b) => a.category - b.category);
        
        return {
          questions: sortedQuestions,
          boxName,
          cardNumber,
        };
      },

      generateRandomQuiz: (boxName: string, questionCount: number) => {
        const allQuestions = get().getQuestionsByBox(boxName);
        
        if (allQuestions.length === 0) {
          console.error(`Aucune question dans la boîte ${boxName}`);
          return null;
        }
        
        // Piocher aléatoirement les questions (avec possibilité de doublons de catégories)
        const selectedQuestions: Question[] = [];
        const availableQuestions = [...allQuestions];
        
        for (let i = 0; i < questionCount && availableQuestions.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * availableQuestions.length);
          selectedQuestions.push(availableQuestions[randomIndex]);
          // Retirer pour éviter la même question deux fois
          availableQuestions.splice(randomIndex, 1);
        }
        
        return selectedQuestions;
      },

      startQuiz: (mode: QuizMode, boxName: string, questions: Question[], cardNumber?: number) => {
        set({
          activeQuiz: {
            mode,
            boxName,
            cardNumber,
            questions,
            currentQuestionIndex: 0,
            startTime: Date.now(),
            questionStartTime: Date.now(),
            answers: new Map(),
            totalQuestions: questions.length,
          },
        });
      },

      nextQuestion: () => {
        const current = get().activeQuiz;
        if (!current) return false;

        const nextIndex = current.currentQuestionIndex + 1;
        if (nextIndex >= current.questions.length) {
          return false; // Quiz terminé
        }

        set({
          activeQuiz: {
            ...current,
            currentQuestionIndex: nextIndex,
            questionStartTime: Date.now(),
          },
        });
        return true;
      },

      endQuiz: () => {
        set((state) => ({
          activeQuiz: null,
          completedQuizzes: state.completedQuizzes + 1,
        }));
        get().backup();
      },

      recordAnswer: (questionIndex: number, playerNick: string) => {
        const current = get().activeQuiz;
        if (!current) return;

        const answers = new Map(current.answers);
        const questionAnswers = answers.get(questionIndex) || [];
        
        if (!questionAnswers.includes(playerNick)) {
          questionAnswers.push(playerNick);
          answers.set(questionIndex, questionAnswers);

          set({
            activeQuiz: {
              ...current,
              answers,
            },
          });
        }
      },

      setCumulativeScores: (value: boolean) => {
        set({ cumulativeScoresInCardMode: value });
        get().backup();
      },

      setCumulativeScoresQuiz: (value: boolean) => {
        set({ cumulativeScoresInQuizMode: value });
        get().backup();
      },

      setDefaultQuizQuestions: (count: number) => {
        set({ defaultQuizQuestions: Math.max(1, Math.min(100, count)) });
        get().backup();
      },

      // Fonction de migration depuis l'ancien format v1
      migrateFromV1: () => {
        const oldData = localStorage.getItem('quiz_questions_storage_v1');
        if (!oldData) {
          console.log('Aucune donnée v1 à migrer');
          return;
        }

        try {
          const parsed = JSON.parse(oldData);
          const oldQuestions = parsed.questions || [];
          const oldBoxes = parsed.trivialBoxes || [];

          console.log(`Migration de ${oldQuestions.length} questions...`);

          // Convertir les questions
          const newQuestions: Question[] = oldQuestions.map((oldQ: any) => {
            // Extraire boxName et cardNumber depuis "Cinéma 91 #2"
            const match = oldQ.trivialBox.match(/^(.+?)\s*#(\d+)$/);

            if (match) {
              return {
                ...oldQ,
                boxName: match[1].trim(),
                cardNumber: parseInt(match[2]),
              };
            } else {
              // Pas de numéro, c'est une ancienne boîte sans carte
              return {
                ...oldQ,
                boxName: oldQ.trivialBox,
                cardNumber: undefined,
              };
            }
          });

          // Reconstruire les boîtes
          const boxes = get().rebuildBoxes(newQuestions);

          set({
            questions: newQuestions,
            boxes,
          });

          get().backup();
          console.log(`✅ Migration terminée : ${boxes.length} boîtes créées`);
        } catch (error) {
          console.error('❌ Erreur lors de la migration :', error);
        }
      },

      // Synchronisation depuis GitHub
      loadFromGitHub: async () => {
        set({ syncStatus: 'loading' });

        try {
          const githubData = await loadQuestionsFromGitHub();

          if (!githubData) {
            set({ syncStatus: 'error' });
            return;
          }

          const current = get();

          // Fusionner avec les questions locales
          const mergedQuestions = mergeQuestionsFromGitHub(
            githubData,
            current.questions
          );

          // Reconstruire les boîtes
          const boxes = get().rebuildBoxes(mergedQuestions);

          set({
            questions: mergedQuestions,
            boxes,
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
    }),
    {
      name: 'quiz_storage',
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => !['activeQuiz'].includes(key)),
        ),
    },
  ),
);
