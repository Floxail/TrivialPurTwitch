import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuestionType, type Question } from '../../src/types/question';
import { applyMenuSelection, boxListText, listRootBoxes, narrowRoot, pickQuestions, splitIntoMenus, subBoxSelection, type Catalog } from './catalog';

const q = (id: string, boxName: string, createdAt?: string): Question =>
  ({ id, question: `Q${id}`, answer: 'r', boxName, questionType: QuestionType.FREE_TEXT, createdAt });

/** Résumé léger lu pour le menu : métadonnées des boîtes + nombre de questions par boîte. */
const catalog: Catalog = {
  boxes: [
    { name: 'Cinéma', ordered: false, hidden: false, parentBox: null },
    { name: 'Cinéma 80s', ordered: false, hidden: false, parentBox: 'Cinéma' },
    { name: 'Secret', ordered: false, hidden: true, parentBox: null },
    { name: 'Pilotes', ordered: true, hidden: false, parentBox: null },
    { name: 'Vide', ordered: false, hidden: false, parentBox: null },
  ],
  counts: [
    { boxName: 'Cinéma', count: 1 },
    { boxName: 'Cinéma 80s', count: 2 },
    { boxName: 'Secret', count: 1 },
    { boxName: 'Pilotes', count: 2 },
    { boxName: 'Sans ligne boxes', count: 1 },
  ],
};

/** Questions chargées au lancement, seulement pour les boîtes choisies. */
const questions = [
  q('1', 'Cinéma'), q('2', 'Cinéma 80s'), q('3', 'Cinéma 80s'),
  q('5', 'Pilotes', '2026-01-02'), q('6', 'Pilotes', '2026-01-01'),
];

test('listRootBoxes : racines visibles, sous-boîtes comptées dans la parente', () => {
  const roots = listRootBoxes(catalog);
  assert.deepEqual(roots.map(r => [r.name, r.questionCount]), [
    ['Cinéma', 3], ['Pilotes', 2], ['Sans ligne boxes', 1],
  ]);
  assert.deepEqual(roots[0].memberNames.sort(), ['Cinéma', 'Cinéma 80s']);
});

test('listRootBoxes : boîte cachée et boîte vide exclues', () => {
  const names = listRootBoxes(catalog).map(r => r.name);
  assert.ok(!names.includes('Secret'));
  assert.ok(!names.includes('Vide'));
});

test('listRootBoxes : sous-boîtes visibles avec leur nombre de questions', () => {
  const cinema = listRootBoxes(catalog).find(r => r.name === 'Cinéma');
  assert.deepEqual(cinema?.subBoxes, [{ name: 'Cinéma 80s', questionCount: 2 }]);
  assert.deepEqual(listRootBoxes(catalog).find(r => r.name === 'Pilotes')?.subBoxes, []);
});

test('splitIntoMenus : 38 boîtes = 2 menus équilibrés, contigus, 25 max', () => {
  const menus = splitIntoMenus(38);
  assert.deepEqual(menus.map(m => m.length), [19, 19]);
  assert.deepEqual(menus.flat(), Array.from({ length: 38 }, (_, i) => i));
  assert.deepEqual(splitIntoMenus(25).map(m => m.length), [25]);
  assert.deepEqual(splitIntoMenus(26).map(m => m.length), [13, 13]);
  assert.ok(splitIntoMenus(100).every(m => m.length <= 25));
});

test('applyMenuSelection : remplace le menu touché, garde les autres', () => {
  const next = applyMenuSelection(new Set([2, 30]), [0, 1, 2, 3, 4, 5, 6, 7], [5, 7]);
  assert.deepEqual([...next].sort((a, b) => a - b), [5, 7, 30]);
});

test('subBoxSelection : cocher une sous-boîte quand « Toute la boîte » était cochée garde la sous-boîte', () => {
  assert.deepEqual(subBoxSelection(true, ['*', '2']), ['2']);
});

test('subBoxSelection : recocher « Toute la boîte » efface les sous-boîtes', () => {
  assert.deepEqual(subBoxSelection(false, ['*', '2']), []);
  assert.deepEqual(subBoxSelection(false, ['*']), []);
  assert.deepEqual(subBoxSelection(false, ['0', '2']), ['0', '2']);
});

test('narrowRoot : seulement les sous-boîtes choisies', () => {
  const cinema = listRootBoxes(catalog).find(r => r.name === 'Cinéma');
  assert.ok(cinema);
  const narrowed = narrowRoot(cinema, ['Cinéma 80s']);
  assert.deepEqual(narrowed.memberNames, ['Cinéma 80s']);
  assert.equal(narrowed.questionCount, 2);
  assert.equal(narrowRoot(cinema, []), cinema);
});

test('pickQuestions : boîte resserrée sur une sous-boîte ne tire que dedans', () => {
  const cinema = listRootBoxes(catalog).find(r => r.name === 'Cinéma');
  assert.ok(cinema);
  const ids = pickQuestions(questions, [narrowRoot(cinema, ['Cinéma 80s'])], 10, []).map(x => x.id).sort();
  assert.deepEqual(ids, ['2', '3']);
});

test('pickQuestions : boîte ordonnée seule = toutes, dans l\'ordre', () => {
  const pilotes = listRootBoxes(catalog).filter(r => r.name === 'Pilotes');
  assert.deepEqual(pickQuestions(questions, pilotes, 1, []).map(x => x.id), ['6', '5']);
});

test('pickQuestions : boîte normale inclut ses sous-boîtes', () => {
  const cinema = listRootBoxes(catalog).filter(r => r.name === 'Cinéma');
  assert.deepEqual(pickQuestions(questions, cinema, 10, []).map(x => x.id).sort(), ['1', '2', '3']);
});

test('pickQuestions : plusieurs boîtes = répartition entre elles', () => {
  const roots = listRootBoxes(catalog).filter(r => r.name !== 'Sans ligne boxes');
  const picked = pickQuestions(questions, roots, 4, []);
  assert.equal(picked.length, 4);
  assert.equal(picked.filter(x => x.boxName === 'Pilotes').length, 2);
});

test('boxListText : reste sous la limite d\'un message Discord, avec « … et N autres »', () => {
  const roots = Array.from({ length: 120 }, (_, i) => ({ name: `Boîte au nom assez long numéro ${i}`, ordered: false, questionCount: 42, memberNames: [], subBoxes: [] }));
  const text = boxListText(roots, 1900);
  assert.ok(text.length <= 1900, `longueur ${text.length}`);
  assert.match(text, /… et \d+ autres$/);
});
