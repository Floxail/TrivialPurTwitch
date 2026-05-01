import { cleanValueLight, removeArticles, sorensenDiceScore } from 'helpers';
import { Question, QuestionType } from 'components/store/questions-store';

// Labels pour les options QCM
const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export type ValidationResult =
  | { valid: false }
  | { valid: true; isCorrect: boolean };

/**
 * Vérifie si une proposition de réponse est correcte pour une question donnée.
 *
 * Retourne:
 * - { valid: false } si le message n'est pas une tentative de réponse valide (ex: texte random en QCM)
 * - { valid: true, isCorrect: true/false } sinon
 */
export function verifyAnswer(message: string, question: Question, opts?: { strictSpelling?: boolean }): ValidationResult {
  if (question.questionType === QuestionType.QCM &&
    question.qcmOptions &&
    (question.qcmCorrectIndexes || question.qcmCorrectIndex !== undefined)) {
    return verifyQcmAnswer(message, question);
  }
  return verifyFreeTextAnswer(message, question, opts?.strictSpelling ?? false);
}

function verifyQcmAnswer(message: string, question: Question): ValidationResult {
  const rawAnswer = message.trim().toUpperCase();
  const correctIndexes = question.qcmCorrectIndexes
    ?? (question.qcmCorrectIndex !== undefined ? [question.qcmCorrectIndex] : []);
  const numOptions = question.qcmOptions!.length;
  const validLabels = QCM_LABELS.slice(0, numOptions);
  const validNumbers = Array.from({ length: numOptions }, (_, i) => String(i + 1));

  // QCM mono-réponse : on accepte UNIQUEMENT le message strict "<lettre>" ou "<chiffre>".
  // Pas de mots autour, pas de split, pas de multi-tokens. Tout autre message → ignoré.
  const isMultiAnswer = correctIndexes.length > 1;
  const extracted: string[] = [];

  if (!isMultiAnswer) {
    if (validLabels.includes(rawAnswer)) {
      extracted.push(rawAnswer);
    } else if (validNumbers.includes(rawAnswer)) {
      extracted.push(QCM_LABELS[parseInt(rawAnswer) - 1]);
    }
  } else {
    // Multi-réponses : "A,C" ou "AC" ou "A C" ou "1,3" ou "13"
    const tokens = rawAnswer.split(/[\s,]+/).filter(t => t.length > 0);
    for (const token of tokens) {
      if (validLabels.includes(token)) {
        extracted.push(token);
      } else if (validNumbers.includes(token)) {
        extracted.push(QCM_LABELS[parseInt(token) - 1]);
      } else if (token.length > 1 && token.split('').every(ch => validLabels.includes(ch))) {
        token.split('').forEach(ch => extracted.push(ch));
      }
    }
  }
  const normalizedAnswers = Array.from(new Set(extracted));

  if (normalizedAnswers.length === 0) {
    return { valid: false };
  }

  const correctLabels = correctIndexes.map(i => QCM_LABELS[i]).sort();
  const givenLabels = [...normalizedAnswers].sort();

  const isCorrect = correctLabels.length === givenLabels.length &&
    correctLabels.every((l, i) => l === givenLabels[i]);

  return { valid: true, isCorrect };
}

function verifyFreeTextAnswer(message: string, question: Question, strict: boolean): ValidationResult {
  const proposition = cleanValueLight(message);
  const propositionNoArticles = removeArticles(proposition);

  const correctAnswer = cleanValueLight(question.answer);
  const alternativeAnswers = question.alternativeAnswers?.map(cleanValueLight) || [];

  if (checkMatch(correctAnswer, proposition, propositionNoArticles, strict)) {
    return { valid: true, isCorrect: true };
  }

  for (const altAnswer of alternativeAnswers) {
    if (checkMatch(altAnswer, proposition, propositionNoArticles, strict)) {
      return { valid: true, isCorrect: true };
    }
  }

  return { valid: true, isCorrect: false };
}

function checkMatch(answer: string, prop: string, propNoArticles: string, strict: boolean = false): boolean {
  const answerNoArticles = removeArticles(answer);

  // Vérification exacte (avec et sans articles)
  if (answer === prop || answerNoArticles === propNoArticles) {
    return true;
  }

  // Mode strict : aucune tolérance — seul l'exact match ci-dessus compte.
  if (strict) {
    return false;
  }

  // Si la réponse correcte contient des chiffres, ils doivent correspondre exactement.
  const answerNumbers = answerNoArticles.match(/\d+/g);
  if (answerNumbers) {
    const propNumbers = propNoArticles.match(/\d+/g) || [];
    if (answerNumbers.join(',') !== propNumbers.join(',')) {
      return false;
    }
  }

  // Vérification de sous-chaîne pour réponses similaires
  const minLength = Math.min(answerNoArticles.length, propNoArticles.length);
  const maxLength = Math.max(answerNoArticles.length, propNoArticles.length);

  if (maxLength - minLength <= 2 && minLength >= 4) {
    if (answerNoArticles.includes(propNoArticles) || propNoArticles.includes(answerNoArticles)) {
      return true;
    }
  }

  // Pour les réponses plus longues
  if (minLength >= 5) {
    const requiredLength = Math.ceil(answerNoArticles.length * 0.8);
    if (propNoArticles.length >= requiredLength && answerNoArticles.includes(propNoArticles)) {
      return true;
    }
    if (answerNoArticles.length >= requiredLength && propNoArticles.includes(answerNoArticles)) {
      return true;
    }
  }

  // Score de similarité
  if (sorensenDiceScore(answerNoArticles, propNoArticles) >= 0.70) {
    return true;
  }
  if (sorensenDiceScore(answer, prop) >= 0.75) {
    return true;
  }

  return false;
}
