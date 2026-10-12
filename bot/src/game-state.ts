import { QuestionType, type Question } from '../../src/types/question';
import { verifyAnswer } from '../../src/services/answer-validator';
import { DEFAULT_FIRST_GRACE_MS, pointsForCorrectAnswer } from '../../src/services/scoring';

export const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export type Player = {
  userId: string;
  name: string;
  score: number;
  answers: number;
  firsts: number;
  combos: number;
  /** Meilleur temps de réponse en ms, 0 tant qu'aucune bonne réponse. */
  fastest: number;
  streak: number;
};

export type Finder = { name: string; points: number; isFirst: boolean; isCombo: boolean };

export type AnswerOutcome = 'correct' | 'wrong' | 'already-found' | 'no-more-attempts' | 'closed';

type CorrectAnswer = { userId: string; name: string; at: number };

export function correctIndexes(question: Question): number[] {
  return question.qcmCorrectIndexes
    ?? (question.qcmCorrectIndex !== undefined ? [question.qcmCorrectIndex] : []);
}

export function correctAnswerText(question: Question): string {
  if (question.questionType !== QuestionType.QCM) return question.answer;
  return correctIndexes(question)
    .map(i => `${QCM_LABELS[i]}. ${question.qcmOptions?.[i] ?? ''}`)
    .join(', ');
}

/** Une partie, sans Discord : questions, réponses, points. Tout le temps est passé en paramètre. */
export class GameState {
  private readonly players = new Map<string, Player>();
  private index = -1;
  private open = false;
  private startedAt = 0;
  private correct: CorrectAnswer[] = [];
  private attempted = new Set<string>();

  constructor(readonly questions: Question[], private readonly graceMs = DEFAULT_FIRST_GRACE_MS) {}

  get questionNumber(): number {
    return this.index + 1;
  }

  get current(): Question | undefined {
    return this.questions[this.index];
  }

  get isOpen(): boolean {
    return this.open;
  }

  get finderCount(): number {
    return this.correct.length;
  }

  startNextQuestion(now: number): Question | undefined {
    this.index++;
    this.correct = [];
    this.attempted = new Set();
    this.startedAt = now;
    this.open = this.current !== undefined;
    return this.current;
  }

  hasFound(userId: string): boolean {
    return this.correct.some(answer => answer.userId === userId);
  }

  submit(questionNumber: number, userId: string, name: string, text: string, now: number): AnswerOutcome {
    const question = this.current;
    if (!this.open || !question || questionNumber !== this.questionNumber) return 'closed';
    if (this.hasFound(userId)) return 'already-found';

    const isQcm = question.questionType === QuestionType.QCM;
    if (isQcm && this.attempted.has(userId)) return 'no-more-attempts';

    const result = verifyAnswer(text, question);
    if (isQcm) this.attempted.add(userId);
    if (!result.valid || !result.isCorrect) return 'wrong';

    this.correct.push({ userId, name, at: now });
    return 'correct';
  }

  /** Ferme la question, attribue les points, remet à zéro le combo de ceux qui n'ont pas trouvé. */
  reveal(): Finder[] {
    this.open = false;
    const firstAt = this.correct[0]?.at ?? 0;
    const isSolo = this.correct.length === 1;
    const finderIds = new Set(this.correct.map(answer => answer.userId));

    for (const player of this.players.values()) {
      if (!finderIds.has(player.userId)) player.streak = 0;
    }

    return this.correct.map(answer => {
      const player = this.playerFor(answer);
      const isFirst = answer.at - firstAt <= this.graceMs;
      const elapsed = answer.at - this.startedAt;

      player.streak++;
      player.answers++;
      if (isFirst) player.firsts++;
      if (player.streak > 1) player.combos++;
      player.fastest = player.fastest === 0 ? elapsed : Math.min(player.fastest, elapsed);

      const points = pointsForCorrectAnswer(1, isFirst, isSolo, player.streak);
      player.score += points;
      return { name: player.name, points, isFirst, isCombo: player.streak > 1 };
    });
  }

  ranking(): Player[] {
    return [...this.players.values()].sort((a, b) => b.score - a.score);
  }

  private playerFor(answer: CorrectAnswer): Player {
    const existing = this.players.get(answer.userId);
    if (existing) {
      existing.name = answer.name;
      return existing;
    }
    const created: Player = { userId: answer.userId, name: answer.name, score: 0, answers: 0, firsts: 0, combos: 0, fastest: 0, streak: 0 };
    this.players.set(answer.userId, created);
    return created;
  }
}
