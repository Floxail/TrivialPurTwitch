// Règles de points partagées par le site et le bot Discord. Module pur.

/** Délai pendant lequel une bonne réponse partage la place de FIRST. */
export const DEFAULT_FIRST_GRACE_MS = 700;

const FIRST_BONUS = 2;
const SOLO_BONUS = 1;
const MAX_COMBO_BONUS = 3;

/**
 * Points d'une bonne réponse.
 * `streak` compte les bonnes réponses consécutives, question en cours incluse (1 = pas de combo).
 */
export function pointsForCorrectAnswer(basePoints: number, isFirst: boolean, isSolo: boolean, streak: number): number {
  let points = basePoints;
  if (isFirst) points += FIRST_BONUS;
  if (isSolo) points += SOLO_BONUS;
  if (streak > 1) points += Math.min(streak - 1, MAX_COMBO_BONUS);
  return points;
}
