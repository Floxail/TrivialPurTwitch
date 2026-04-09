import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { loadQuestionsFromAPI, mergeQuestionsFromDB } from '../../services/github-data-service';
import {
  apiCreateQuestion,
  apiUpdateQuestion,
  apiDeleteQuestion,
  apiBulkAddQuestions,
  apiCreateBox,
  apiDeleteBox,
  apiRenameBox,
  apiUpdateBox,
  apiImportQuestions,
  apiSetBoxOrdered,
} from '../../services/api-service';

const localStorageKey: string = 'quiz_questions_storage_v2';

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Type de question
export enum QuestionType {
  FREE_TEXT = 'free_text',  // Réponse libre (mode actuel)
  QCM = 'qcm'               // Questionnaire à Choix Multiples
}

export type Question = {
  id: string;
  question: string;
  answer: string;
  alternativeAnswers?: string[]; // Réponses alternatives acceptées (mode FREE_TEXT)
  boxName: string; // Nom de la boîte
  cardNumber?: number; // Numéro de carte (pour organisation)
  difficulty?: 'easy' | 'medium' | 'hard';

  // Champs QCM
  questionType?: QuestionType; // Par défaut FREE_TEXT si non spécifié
  qcmOptions?: string[]; // 2-6 options (A à F)
  qcmCorrectIndex?: number; // Index de la bonne réponse (legacy, single answer)
  qcmCorrectIndexes?: number[]; // Index des bonnes réponses (multi-réponses)
  createdAt?: string; // Date de création (pour l'ordre dans les boîtes ordonnées)
  imageUrl?: string; // URL externe d'une image associée (Discord, Imgur, etc.)
};

// Structure d'une boîte (contient plusieurs cartes)
export type TrivialBox = {
  name: string; // Ex: "Cinéma 91"
  cardNumbers: number[]; // Ex: [1, 2, 3, 4, 5]
  totalQuestions: number; // Nombre total de questions dans cette boîte
  ordered?: boolean; // Si true : questions jouées dans l'ordre d'insertion (rowid DB)
  createdBy?: string | null; // Pseudo du créateur de la boîte
  description?: string | null; // Description / info libre de la boîte
  hidden?: boolean; // Si true : boîte masquée pour le public, visible uniquement pour les admins
  parentBox?: string | null; // Nom de la boîte parente (si sous-boîte d'une boîte master)
};


export class QuestionsData {
  questions: Question[] = [];
  boxes: TrivialBox[] = []; // Liste des boîtes avec leurs cartes
  syncStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  lastDBSync?: string;
  lastDBQuestionIds: string[] = []; // IDs des questions BD lors de la dernière sync

  // Settings
cumulativeScoresInQuizMode: boolean = false; // Cumuler les scores entre quiz
  defaultQuizQuestions: number = 10; // Nombre de questions par défaut en mode QUIZ
}

type QuestionsActions = {
  backup: () => void;
  clear: () => void;

  // Gestion des questions (async → API + state local)
  addQuestion: (question: Question) => Promise<void>;
  updateQuestion: (questionId: string, updates: Partial<Question>) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  bulkAddQuestions: (questions: Question[]) => Promise<void>;

  // Gestion des boîtes (async → API + state local)
  getBoxes: () => TrivialBox[];
  getBoxByName: (boxName: string) => TrivialBox | undefined;
  addBox: (boxName: string, ordered?: boolean, description?: string, parentBox?: string) => Promise<void>;
  removeBox: (boxName: string) => Promise<void>;
  renameBox: (oldName: string, newName: string) => Promise<void>;
  updateBox: (boxName: string, updates: { newName?: string; ordered?: boolean; description?: string; hidden?: boolean; parentBox?: string | null }) => Promise<void>;
  rebuildBoxes: (questions: Question[], dbOrderedMap?: Map<string, boolean>) => TrivialBox[];

  // Récupération des questions
  getQuestionsByBox: (boxName: string) => Question[];
  getQuestionsByCard: (boxName: string, cardNumber: number) => Question[];
  // Génération de quiz
  generateRandomQuiz: (boxName: string, questionCount: number) => Question[] | null;
  generateRandomQuizAllBoxes: (questionCount: number) => Question[] | null;
  generateRandomQuizFromBoxes: (boxNames: string[], questionCount: number) => Question[] | null;
  generateOrderedQuiz: (boxName: string) => Question[] | null;
  toggleBoxOrdered: (boxName: string, ordered: boolean) => Promise<void>;

  // Settings
  setCumulativeScoresQuiz: (value: boolean) => void;
  setDefaultQuizQuestions: (count: number) => void;

  // Migration
  migrateFromV1: () => void;

  // Synchroniser les questions depuis la BD Turso (silent = pas de syncStatus 'loading')
  syncFromDB: (silent?: boolean) => Promise<void>;
  // Auto-sync si la dernière sync date de plus de 15 minutes
  autoSyncIfNeeded: () => Promise<void>;

  // Backup complet
  exportFullBackup: () => any;
  importFullBackup: (backupData: any) => Promise<boolean>;

  // Dédoublonnage
  removeDuplicates: () => Promise<number>;
};

// Restore persisted state (support ancien champ lastGitHubSync pour migration transparente)
const plain: any = JSON.parse(localStorage.getItem(localStorageKey) || '{}');
const restoredState: QuestionsData = {
  questions: plain.questions || [],
  boxes: plain.boxes || [],
  syncStatus: 'idle',
  lastDBSync: plain.lastDBSync ?? plain.lastGitHubSync,
  lastDBQuestionIds: plain.lastDBQuestionIds ?? plain.lastGitHubQuestionIds ?? [],
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
          lastDBSync: current.lastDBSync,
          lastDBQuestionIds: current.lastDBQuestionIds,
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
          lastDBSync: undefined,
          lastDBQuestionIds: [],
          cumulativeScoresInQuizMode: false,
          defaultQuizQuestions: 10,
        });
        get().backup();
      },

      // ========== GESTION DES QUESTIONS ==========

      addQuestion: async (question: Question) => {
        // Optimistic UI : mise à jour locale immédiate, rollback si API échoue
        const prevQuestions = get().questions;
        const prevBoxes = get().boxes;

        const newQuestions = [...prevQuestions, question];
        const boxes = get().rebuildBoxes(newQuestions);
        set({ questions: newQuestions, boxes });
        get().backup();

        try {
          await apiCreateQuestion(question);
        } catch (err) {
          console.warn('⚠️ API addQuestion échouée — rollback', err);
          set({ questions: prevQuestions, boxes: prevBoxes });
          get().backup();
          throw err;
        }
      },

      updateQuestion: async (questionId: string, updates: Partial<Question>) => {
        // Optimistic UI : mise à jour locale immédiate, rollback si API échoue
        const prevQuestions = get().questions;
        const prevBoxes = get().boxes;

        const newQuestions = prevQuestions.map((q) =>
          q.id === questionId ? { ...q, ...updates } : q
        );
        const boxes = get().rebuildBoxes(newQuestions);
        set({ questions: newQuestions, boxes });
        get().backup();

        try {
          await apiUpdateQuestion(questionId, updates);
        } catch (err) {
          console.warn('⚠️ API updateQuestion échouée — rollback', err);
          set({ questions: prevQuestions, boxes: prevBoxes });
          get().backup();
          throw err;
        }
      },

      deleteQuestion: async (questionId: string) => {
        // Optimistic UI : suppression locale immédiate, rollback si API échoue
        const prevQuestions = get().questions;
        const prevBoxes = get().boxes;

        const newQuestions = prevQuestions.filter((q) => q.id !== questionId);
        const boxes = get().rebuildBoxes(newQuestions);
        set({ questions: newQuestions, boxes });
        get().backup();

        try {
          await apiDeleteQuestion(questionId);
        } catch (err) {
          console.warn('⚠️ API deleteQuestion échouée — rollback', err);
          set({ questions: prevQuestions, boxes: prevBoxes });
          get().backup();
          throw err;
        }
      },

      bulkAddQuestions: async (questions: Question[]) => {
        // Optimistic UI : ajout local immédiat, rollback si API échoue
        const prevQuestions = get().questions;
        const prevBoxes = get().boxes;

        const newQuestions = [...prevQuestions, ...questions];
        const boxes = get().rebuildBoxes(newQuestions);
        set({ questions: newQuestions, boxes });
        get().backup();

        try {
          await apiBulkAddQuestions(questions);
        } catch (err) {
          console.warn('⚠️ API bulkAddQuestions échouée — rollback', err);
          set({ questions: prevQuestions, boxes: prevBoxes });
          get().backup();
          throw err;
        }
      },

      // ========== GESTION DES BOÎTES ==========

      rebuildBoxes: (questions: Question[], dbOrderedMap?: Map<string, boolean>): TrivialBox[] => {
        const existingBoxes = get().boxes;
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
          // Priorité : DB > état local (fallback si pas de sync)
          const ordered = dbOrderedMap?.has(boxName)
            ? dbOrderedMap.get(boxName)
            : existingBoxes.find(b => b.name === boxName)?.ordered;
          boxes.push({
            name: boxName,
            cardNumbers,
            totalQuestions,
            ordered,
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

      addBox: async (boxName: string, ordered?: boolean, description?: string, parentBox?: string) => {
        const currentBoxes = get().boxes;
        if (currentBoxes.find((box) => box.name === boxName)) {
          return; // La boîte existe déjà
        }

        // Optimistic UI : ajout local immédiat, rollback si API échoue
        const newBox: TrivialBox = {
          name: boxName,
          cardNumbers: [],
          totalQuestions: 0,
          ordered,
          description: description || null,
          parentBox: parentBox || null,
        };
        set({ boxes: [...currentBoxes, newBox] });
        get().backup();

        try {
          await apiCreateBox(boxName, ordered, description, parentBox);
        } catch (err) {
          console.warn('⚠️ API addBox échouée — rollback', err);
          set({ boxes: currentBoxes });
          get().backup();
          throw err;
        }
      },

      removeBox: async (boxName: string) => {
        // Optimistic UI : suppression locale immédiate, rollback si API échoue
        const prevQuestions = get().questions;
        const prevBoxes = get().boxes;

        const newQuestions = prevQuestions.filter((q) => q.boxName !== boxName);
        const newBoxes = prevBoxes.filter((b) => b.name !== boxName);
        set({ questions: newQuestions, boxes: newBoxes });
        get().backup();

        try {
          await apiDeleteBox(boxName);
        } catch (err) {
          console.warn('⚠️ API removeBox échouée — rollback', err);
          set({ questions: prevQuestions, boxes: prevBoxes });
          get().backup();
          throw err;
        }
      },

      renameBox: async (oldName: string, newName: string) => {
        // Optimistic UI : renommage local immédiat, rollback si API échoue
        const prevQuestions = get().questions;
        const prevBoxes = get().boxes;

        const newQuestions = prevQuestions.map((q) =>
          q.boxName === oldName ? { ...q, boxName: newName } : q
        );
        const newBoxes = prevBoxes.map((b) =>
          b.name === oldName ? { ...b, name: newName } : b
        );
        set({ questions: newQuestions, boxes: newBoxes });
        get().backup();

        try {
          await apiRenameBox(oldName, newName);
        } catch (err) {
          console.warn('⚠️ API renameBox échouée — rollback', err);
          set({ questions: prevQuestions, boxes: prevBoxes });
          get().backup();
          throw err;
        }
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

      // ========== GÉNÉRATION DE QUIZ ==========

      generateRandomQuiz: (boxName: string, questionCount: number): Question[] | null => {
        const allQuestions = get().getQuestionsByBox(boxName);

        if (allQuestions.length === 0) {
          return null;
        }

        // Mélanger et prendre N questions
        const shuffled = fisherYatesShuffle(allQuestions);
        return shuffled.slice(0, Math.min(questionCount, shuffled.length));
      },

      generateRandomQuizAllBoxes: (questionCount: number): Question[] | null => {
        const allQuestions = get().questions;

        if (allQuestions.length === 0) {
          return null;
        }

        const shuffled = fisherYatesShuffle(allQuestions);
        return shuffled.slice(0, Math.min(questionCount, shuffled.length));
      },

      generateRandomQuizFromBoxes: (boxNames: string[], questionCount: number): Question[] | null => {
        const allQuestions = get().questions.filter((q) => boxNames.includes(q.boxName));

        if (allQuestions.length === 0) {
          return null;
        }

        const shuffled = fisherYatesShuffle(allQuestions);
        return shuffled.slice(0, Math.min(questionCount, shuffled.length));
      },

      generateOrderedQuiz: (boxName: string): Question[] | null => {
        const questions = get().questions.filter(q => q.boxName === boxName);
        if (questions.length === 0) return null;
        // Trier par date de création, puis par ID comme tiebreaker (l'ID contient un timestamp)
        questions.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            const cmp = a.createdAt.localeCompare(b.createdAt);
            if (cmp !== 0) return cmp;
          } else if (a.createdAt) return -1;
          else if (b.createdAt) return 1;
          return a.id.localeCompare(b.id);
        });
        return questions;
      },

      toggleBoxOrdered: async (boxName: string, ordered: boolean) => {
        const boxes = get().boxes.map(b => b.name === boxName ? { ...b, ordered } : b);
        set({ boxes });
        get().backup();
        try {
          await apiSetBoxOrdered(boxName, ordered);
        } catch (err) {
          console.warn('⚠️ API toggleBoxOrdered échouée, flag local uniquement', err);
        }
      },

      updateBox: async (boxName: string, updates: { newName?: string; ordered?: boolean; description?: string; hidden?: boolean; parentBox?: string | null }) => {
        // Rename si nécessaire (renameBox est déjà optimistic avec rollback)
        if (updates.newName && updates.newName !== boxName) {
          await get().renameBox(boxName, updates.newName);
          boxName = updates.newName;
        }

        // Optimistic UI : mise à jour locale immédiate, rollback si API échoue
        const prevBoxes = get().boxes;
        const newBoxes = prevBoxes.map(b => {
          if (b.name !== boxName) return b;
          return {
            ...b,
            ...(updates.ordered !== undefined && { ordered: updates.ordered }),
            ...(updates.description !== undefined && { description: updates.description }),
            ...(updates.hidden !== undefined && { hidden: updates.hidden }),
            ...(updates.parentBox !== undefined && { parentBox: updates.parentBox }),
          };
        });
        set({ boxes: newBoxes });
        get().backup();

        // Patch API
        const patchPayload: any = { name: boxName };
        let hasPatch = false;
        if (updates.ordered !== undefined) { patchPayload.ordered = updates.ordered; hasPatch = true; }
        if (updates.description !== undefined) { patchPayload.description = updates.description; hasPatch = true; }
        if (updates.hidden !== undefined) { patchPayload.hidden = updates.hidden; hasPatch = true; }
        if (updates.parentBox !== undefined) { patchPayload.parentBox = updates.parentBox; hasPatch = true; }

        if (hasPatch) {
          try {
            await apiUpdateBox(boxName, patchPayload);
          } catch (err) {
            console.warn('⚠️ API updateBox échouée — rollback', err);
            set({ boxes: prevBoxes });
            get().backup();
            throw err;
          }
        }
      },

      // ========== SETTINGS ==========

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

      // ========== SYNCHRONISATION DEPUIS LA BD TURSO ==========

      syncFromDB: async (silent = false) => {
        try {
          if (!silent) set({ syncStatus: 'loading' });

          const dbData = await loadQuestionsFromAPI();

          if (!dbData) {
            set({ syncStatus: 'error' });
            return;
          }

          // Fetch ordered flags + createdBy depuis la DB boxes
          let dbBoxMetaMap = new Map<string, { ordered: boolean; createdBy?: string | null; description?: string | null; hidden?: boolean; parentBox?: string | null }>();
          try {
            const boxesRes = await fetch('/api/boxes');
            if (boxesRes.ok) {
              const boxesData = await boxesRes.json();
              for (const b of (boxesData.boxes || [])) {
                dbBoxMetaMap.set(b.name, { ordered: !!b.ordered, createdBy: b.createdBy || null, description: b.description || null, hidden: !!b.hidden, parentBox: b.parentBox || null });
              }
            }
          } catch { /* ignore, on garde les flags locaux */ }
          // Compat: rebuildBoxes attend dbOrderedMap
          const dbOrderedMap = new Map<string, boolean>();
          dbBoxMetaMap.forEach((meta, name) => {
            dbOrderedMap.set(name, meta.ordered);
          });

          const currentQuestions = get().questions;
          const previousDBIds = get().lastDBQuestionIds.length > 0
            ? new Set(get().lastDBQuestionIds)
            : undefined;

          const mergedQuestions = mergeQuestionsFromDB(
            dbData,
            currentQuestions,
            previousDBIds
          );

          // Sauvegarder les IDs BD actuels pour la prochaine sync
          const currentDBIds = dbData.questions.map((q: any) => q.id);

          const enrichedBoxes: TrivialBox[] = get().rebuildBoxes(mergedQuestions, dbOrderedMap).map(box => ({
            ...box,
            createdBy: dbBoxMetaMap.get(box.name)?.createdBy ?? box.createdBy ?? null,
            description: dbBoxMetaMap.get(box.name)?.description ?? box.description ?? null,
            hidden: dbBoxMetaMap.get(box.name)?.hidden ?? box.hidden ?? false,
            parentBox: dbBoxMetaMap.get(box.name)?.parentBox ?? box.parentBox ?? null,
          }));

          // Ajouter les boîtes BD sans questions (ex: boîtes master vides)
          const enrichedNames = new Set(enrichedBoxes.map(b => b.name));
          dbBoxMetaMap.forEach((meta, name) => {
            if (!enrichedNames.has(name)) {
              enrichedBoxes.push({
                name,
                cardNumbers: [],
                totalQuestions: 0,
                ordered: meta.ordered,
                createdBy: meta.createdBy ?? null,
                description: meta.description ?? null,
                hidden: meta.hidden ?? false,
                parentBox: meta.parentBox ?? null,
              });
            }
          });
          enrichedBoxes.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'fr', { sensitivity: 'base' }));

          set({
            questions: mergedQuestions,
            lastDBQuestionIds: currentDBIds,
            boxes: enrichedBoxes,
            syncStatus: 'success',
            lastDBSync: new Date().toISOString(),
          });

          get().backup();

          console.log(`✅ ${mergedQuestions.length} questions chargées depuis la BD`);
        } catch (error) {
          console.error('❌ Erreur lors de la synchronisation BD:', error);
          if (!silent) set({ syncStatus: 'error' });
        }
      },

      autoSyncIfNeeded: async () => {
        const lastSync = get().lastDBSync;
        const fifteenMinutes = 15 * 60 * 1000;
        if (!lastSync || (Date.now() - new Date(lastSync).getTime()) > fifteenMinutes) {
          console.log('🔄 Auto-sync silencieux (>15min depuis la dernière sync)...');
          await get().syncFromDB(true);
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
            cumulativeScoresInQuizMode: current.cumulativeScoresInQuizMode,
            defaultQuizQuestions: current.defaultQuizQuestions,
          },
          players: playerData,
          settings: settingsData,
        };
      },

      importFullBackup: async (backupData: any): Promise<boolean> => {
        try {
          // Validation basique
          if (!backupData || !backupData.version) {
            console.error('Format de backup invalide');
            return false;
          }

          // Restaurer les données du quiz
          if (backupData.quiz) {
            const questions = backupData.quiz.questions || [];
            const boxes = get().rebuildBoxes(questions);

            // Envoyer à l'API
            try {
              await apiImportQuestions({
                boxes: backupData.quiz.boxes || boxes,
                questions,
              });
            } catch (err) {
              console.warn('⚠️ API importFullBackup échouée, restauration locale uniquement', err);
            }

            set({
              questions,
              boxes,
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

      removeDuplicates: async (): Promise<number> => {
        const currentQuestions = get().questions;
        const seen = new Map<string, Question>();
        const duplicateIds: string[] = [];

        // On garde la première occurrence de chaque question unique
        // Critère d'unicité: question + answer + boxName
        currentQuestions.forEach((q) => {
          const key = `${q.question.trim().toLowerCase()}|${q.answer.trim().toLowerCase()}|${q.boxName}`;
          if (!seen.has(key)) {
            seen.set(key, q);
          } else {
            duplicateIds.push(q.id);
          }
        });

        const uniqueQuestions = Array.from(seen.values());
        const removedCount = currentQuestions.length - uniqueQuestions.length;

        if (removedCount > 0) {
          // Supprimer les doublons de la DB Turso
          const deleteResults = await Promise.allSettled(
            duplicateIds.map(id => apiDeleteQuestion(id))
          );
          const dbDeleted = deleteResults.filter(r => r.status === 'fulfilled' && r.value).length;
          const dbFailed = deleteResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)).length;

          if (dbFailed > 0) {
            console.warn(`⚠️ ${dbFailed} doublon(s) n'ont pas pu être supprimés de la DB`);
          }
          console.log(`✅ ${removedCount} doublon(s) supprimé(s) (${dbDeleted} de la DB)`);

          const boxes = get().rebuildBoxes(uniqueQuestions);
          set({
            questions: uniqueQuestions,
            boxes: boxes,
          });
          get().backup();
        }

        return removedCount;
      },
    }),
    {
      name: 'quiz_storage',
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) =>
            ['questions', 'boxes', 'lastDBSync', 'lastDBQuestionIds',
             'cumulativeScoresInQuizMode',
             'defaultQuizQuestions'].includes(key)
          ),
        ),
    },
  ),
);
