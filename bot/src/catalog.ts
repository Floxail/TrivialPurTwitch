import type { Question } from '../../src/types/question';
import { smartPick, sortByCreation, stratifiedPick } from '../../src/services/quiz-picker';

export type BoxMeta = { name: string; ordered: boolean; hidden: boolean; parentBox: string | null };
export type BoxCount = { boxName: string; count: number };
/**
 * Résumé léger pour le menu (≈ 100 ms) : métadonnées des boîtes et nombre de questions par boîte.
 * Les questions elles-mêmes ne sont chargées qu'au lancement, pour les boîtes choisies.
 */
export type Catalog = { boxes: BoxMeta[]; counts: BoxCount[] };
export type SubBox = { name: string; questionCount: number };
/** Boîte proposée dans le menu : une racine et ses sous-boîtes visibles. */
export type RootBox = { name: string; ordered: boolean; questionCount: number; memberNames: string[]; subBoxes: SubBox[] };

/** Limite Discord : 25 options par menu déroulant. */
export const MENU_SIZE = 25;

/**
 * Boîtes de premier niveau jouables, triées par nom.
 * Comme sur le site, une boîte existe dès qu'une question la référence, même
 * sans ligne dans la table `boxes`.
 */
export function listRootBoxes(catalog: Catalog): RootBox[] {
  const meta = new Map(catalog.boxes.map(b => [b.name, b]));
  const counts = new Map(catalog.counts.map(c => [c.boxName, c.count]));

  const names = new Set([...counts.keys(), ...meta.keys()]);
  const visible = [...names].filter(name => !meta.get(name)?.hidden);
  const visibleSet = new Set(visible);
  const parentOf = (name: string) => {
    const parent = meta.get(name)?.parentBox ?? null;
    return parent !== null && visibleSet.has(parent) ? parent : null;
  };

  return visible
    .filter(name => parentOf(name) === null)
    .map(name => {
      const subBoxes = visible
        .filter(child => parentOf(child) === name && (counts.get(child) ?? 0) > 0)
        .map(child => ({ name: child, questionCount: counts.get(child) ?? 0 }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      const memberNames = [name, ...subBoxes.map(sub => sub.name)];
      const questionCount = memberNames.reduce((sum, member) => sum + (counts.get(member) ?? 0), 0);
      return { name, ordered: meta.get(name)?.ordered ?? false, questionCount, memberNames, subBoxes };
    })
    .filter(root => root.questionCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Place gardée pour « … et N autres » en fin de liste. */
const OVERFLOW_ROOM = 30;

/** Liste lisible des boîtes, coupée pour tenir dans `maxLength` caractères. */
export function boxListText(roots: RootBox[], maxLength: number): string {
  const lines = roots.map(root => `${root.name} : ${root.questionCount} questions${root.ordered ? ' (ordonnée)' : ''}`);
  const kept: string[] = [];
  let length = 0;
  for (const [i, line] of lines.entries()) {
    if (length + line.length + 1 + OVERFLOW_ROOM > maxLength) {
      kept.push(`… et ${lines.length - i} autres`);
      break;
    }
    kept.push(line);
    length += line.length + 1;
  }
  return kept.join('\n') || 'Aucune boîte disponible.';
}

/** Découpe `total` boîtes (déjà triées) en menus contigus et équilibrés de 25 au plus. */
export function splitIntoMenus(total: number): number[][] {
  const menuCount = Math.max(1, Math.ceil(total / MENU_SIZE));
  const size = Math.ceil(total / menuCount);
  return Array.from({ length: menuCount }, (_, m) =>
    Array.from({ length: Math.max(0, Math.min(size, total - m * size)) }, (_, i) => m * size + i));
}

/** Discord ne renvoie que les valeurs du menu touché : on remplace ce menu, on garde les autres. */
export function applyMenuSelection(selected: Set<number>, menuIndexes: number[], chosen: number[]): Set<number> {
  const inMenu = new Set(menuIndexes);
  return new Set([...[...selected].filter(index => !inMenu.has(index)), ...chosen]);
}

/** Boîte limitée aux sous-boîtes choisies. Aucune sous-boîte choisie = la boîte entière. */
export function narrowRoot(root: RootBox, chosenSubBoxes: string[]): RootBox {
  if (chosenSubBoxes.length === 0) return root;
  const chosen = root.subBoxes.filter(sub => chosenSubBoxes.includes(sub.name));
  return {
    ...root,
    memberNames: chosen.map(sub => sub.name),
    questionCount: chosen.reduce((sum, sub) => sum + sub.questionCount, 0),
  };
}

/** `questions` : celles des boîtes choisies (voir loadQuestions), sous-boîtes comprises. */
export function pickQuestions(questions: Question[], roots: RootBox[], count: number, recentIds: string[]): Question[] {
  const questionsOf = (root: RootBox) => {
    const members = new Set(root.memberNames);
    return questions.filter(question => members.has(question.boxName));
  };

  if (roots.length === 1 && roots[0].ordered) return sortByCreation(questionsOf(roots[0]));
  if (roots.length === 1) return smartPick(questionsOf(roots[0]), count, recentIds);
  return stratifiedPick(roots.map(questionsOf), count, recentIds);
}
