import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuestionType, type Question } from '../../src/types/question';
import { GameState, correctAnswerText } from './game-state';

const free = (id: string): Question =>
  ({ id, question: 'Capitale ?', answer: 'Paris', alternativeAnswers: ['Lutece'], boxName: 'Geo' });
const qcm = (id: string): Question =>
  ({ id, question: 'Capitale ?', answer: '', boxName: 'Geo', questionType: QuestionType.QCM, qcmOptions: ['Lyon', 'Paris'], qcmCorrectIndex: 1 });

test('bonne et mauvaise réponse en texte libre, plusieurs essais permis', () => {
  const game = new GameState([free('1')]);
  game.startNextQuestion(0);
  assert.equal(game.submit(1, 'u1', 'alice', 'lyon', 100), 'wrong');
  assert.equal(game.submit(1, 'u1', 'alice', 'paris', 200), 'correct');
  assert.equal(game.submit(1, 'u1', 'alice', 'paris', 300), 'already-found');
  assert.equal(game.finderCount, 1);
});

test('QCM : une seule tentative', () => {
  const game = new GameState([qcm('1')]);
  game.startNextQuestion(0);
  assert.equal(game.submit(1, 'u1', 'alice', 'A', 100), 'wrong');
  assert.equal(game.submit(1, 'u1', 'alice', 'B', 200), 'no-more-attempts');
});

test('réponse sur une question périmée ou révélée = closed', () => {
  const game = new GameState([free('1'), free('2')]);
  game.startNextQuestion(0);
  game.reveal();
  assert.equal(game.submit(1, 'u1', 'alice', 'paris', 100), 'closed');
  game.startNextQuestion(1000);
  assert.equal(game.submit(1, 'u1', 'alice', 'paris', 1100), 'closed');
  assert.equal(game.submit(2, 'u1', 'alice', 'paris', 1100), 'correct');
});

test('FIRST partagé dans la clémence, seul bonus si un seul trouveur', () => {
  const game = new GameState([free('1'), free('2')], 700);
  game.startNextQuestion(0);
  game.submit(1, 'u1', 'alice', 'paris', 1000);
  game.submit(1, 'u2', 'bob', 'paris', 1600);
  game.submit(1, 'u3', 'carl', 'paris', 1800);
  const finders = game.reveal();
  assert.deepEqual(finders.map(f => [f.name, f.isFirst, f.points]), [
    ['alice', true, 3], ['bob', true, 3], ['carl', false, 1],
  ]);

  game.startNextQuestion(10_000);
  game.submit(2, 'u3', 'carl', 'paris', 11_000);
  const [solo] = game.reveal();
  // base 1 + FIRST 2 + seul 1 + combo 1
  assert.equal(solo.points, 5);
  assert.equal(solo.isCombo, true);
});

test('combo remis à zéro pour qui ne trouve pas', () => {
  const game = new GameState([free('1'), free('2'), free('3')]);
  game.startNextQuestion(0); game.submit(1, 'u1', 'alice', 'paris', 10); game.reveal();
  game.startNextQuestion(100); game.reveal();
  game.startNextQuestion(200); game.submit(3, 'u1', 'alice', 'paris', 210);
  const [finder] = game.reveal();
  assert.equal(finder.isCombo, false);
});

test('ranking trié par score, fastest = meilleur temps', () => {
  const game = new GameState([free('1'), free('2')]);
  game.startNextQuestion(0); game.submit(1, 'u1', 'alice', 'paris', 900); game.submit(1, 'u2', 'bob', 'paris', 5000); game.reveal();
  game.startNextQuestion(10_000); game.submit(2, 'u1', 'alice', 'lutece', 10_400); game.reveal();
  const [first, second] = game.ranking();
  assert.equal(first.name, 'alice');
  assert.equal(first.fastest, 400);
  assert.equal(second.name, 'bob');
  assert.equal(game.startNextQuestion(20_000), undefined);
});

test('correctAnswerText : texte libre et QCM', () => {
  assert.equal(correctAnswerText(free('1')), 'Paris');
  assert.equal(correctAnswerText(qcm('1')), 'B. Paris');
});
