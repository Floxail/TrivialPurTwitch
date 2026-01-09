import { create } from 'zustand';
import { Question } from './questions-store';

// Modes de jeu
export enum QuizMode {
  CARD = 'card',    // Mode Carte : 6 questions (1 par catégorie)
  QUIZ = 'quiz'     // Mode Quiz : X questions aléatoires
}

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

export class GameData {
  activeQuiz: ActiveQuiz | null = null;
  completedQuizzes: number = 0;
}

type GameActions = {
  // Gestion du quiz actif
  startQuiz: (mode: QuizMode, boxName: string, questions: Question[], cardNumber?: number) => void;
  nextQuestion: () => boolean;
  endQuiz: () => void;
  recordAnswer: (questionIndex: number, playerNick: string) => void;

  // Getters
  getCurrentQuestion: () => Question | null;
  isQuizActive: () => boolean;
  getCompletedQuizzes: () => number;
};

export const useGameStore = create<GameData & GameActions>()((set, get) => ({
  // État initial
  activeQuiz: null,
  completedQuizzes: 0,

  // ========== GESTION DU QUIZ ACTIF ==========

  startQuiz: (mode: QuizMode, boxName: string, questions: Question[], cardNumber?: number) => {
    if (questions.length === 0) {
      console.error('Impossible de démarrer un quiz sans questions');
      return;
    }

    const newQuiz: ActiveQuiz = {
      mode,
      boxName,
      cardNumber,
      questions,
      currentQuestionIndex: 0,
      startTime: Date.now(),
      questionStartTime: Date.now(),
      answers: new Map(),
      totalQuestions: questions.length,
    };

    set({ activeQuiz: newQuiz });
    console.log(`✅ Quiz démarré : ${mode} - ${boxName}${cardNumber ? ` #${cardNumber}` : ''} - ${questions.length} questions`);
  },

  nextQuestion: (): boolean => {
    const current = get().activeQuiz;
    if (!current) {
      return false;
    }

    const nextIndex = current.currentQuestionIndex + 1;

    if (nextIndex >= current.questions.length) {
      // Fin du quiz
      return false;
    }

    // Passer à la question suivante
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
    const current = get().activeQuiz;
    if (!current) {
      return;
    }

    set({
      activeQuiz: null,
      completedQuizzes: get().completedQuizzes + 1,
    });

    console.log('✅ Quiz terminé');
  },

  recordAnswer: (questionIndex: number, playerNick: string) => {
    const current = get().activeQuiz;
    if (!current) {
      console.warn('Aucun quiz actif pour enregistrer une réponse');
      return;
    }

    const answers = new Map(current.answers);
    const currentAnswers = answers.get(questionIndex) || [];

    if (!currentAnswers.includes(playerNick)) {
      answers.set(questionIndex, [...currentAnswers, playerNick]);

      set({
        activeQuiz: {
          ...current,
          answers,
        },
      });
    }
  },

  // ========== GETTERS ==========

  getCurrentQuestion: (): Question | null => {
    const current = get().activeQuiz;
    if (!current) {
      return null;
    }

    return current.questions[current.currentQuestionIndex] || null;
  },

  isQuizActive: (): boolean => {
    return get().activeQuiz !== null;
  },

  getCompletedQuizzes: (): number => {
    return get().completedQuizzes;
  },
}));
