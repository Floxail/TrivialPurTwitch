// Types partagés entre le site et le bot Discord : aucun import ici,
// pour que Node puisse charger ce fichier sans React ni zustand.

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
  imageUrl?: string; // URL externe d'une image associée à la question (Discord, Imgur, etc.)
  answerImageUrl?: string; // URL externe d'une image affichée au moment de la révélation
};
