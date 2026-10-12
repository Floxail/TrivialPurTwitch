import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, type MessageCreateOptions } from 'discord.js';
import { QuestionType, type Question } from '../../src/types/question';
import { answerRows, isGameRunning, qcmButtonRows, startGame, stopGame, type GameChannel } from './game';

const free = (imageUrl?: string): Question => ({ id: 'q1', question: 'Capitale ?', answer: 'Paris', boxName: 'Geo', imageUrl });
const multi: Question = {
  id: 'q2', question: 'Pays ?', answer: '', boxName: 'Geo', questionType: QuestionType.QCM,
  qcmOptions: ['France', 'Lyon', 'Japon'], qcmCorrectIndexes: [0, 2],
};

/** Faux salon : enregistre les envois. `failEmbeds` simule une erreur réseau sur les questions, `holdEmbeds` les met en attente. */
function fakeChannel(id: string, mode: 'normal' | 'failEmbeds' | 'holdEmbeds' = 'normal') {
  const sent: string[] = [];
  const edits: string[] = [];
  const held: Array<() => void> = [];
  const message = { id: 'm1', edit: async () => { edits.push('edit'); return message; } };
  const channel: GameChannel = {
    id,
    send: (options: MessageCreateOptions) => {
      const isQuestion = options.embeds !== undefined;
      if (isQuestion && mode === 'failEmbeds') return Promise.reject(new Error('503 Service Unavailable'));
      sent.push(isQuestion ? 'question' : String(options.content));
      if (isQuestion && mode === 'holdEmbeds') return new Promise(resolve => held.push(() => resolve(message)));
      return Promise.resolve(message);
    },
  };
  return { channel, sent, edits, release: () => held.splice(0).forEach(resolve => resolve()) };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('QCM à 6 options : 2 rangées (5 + 1), labels A à F', () => {
  const rows = qcmButtonRows('s1', 3, 6);
  assert.deepEqual(rows.map(row => row.components.length), [5, 1]);
  const buttons = rows.flatMap(row => row.components.map(button => button.toJSON()));
  assert.deepEqual(buttons.map(b => ('label' in b ? b.label : '')), ['A', 'B', 'C', 'D', 'E', 'F']);
});

test('QCM à 4 options : 1 rangée', () => {
  assert.deepEqual(qcmButtonRows('s1', 1, 4).map(row => row.components.length), [4]);
});

test('QCM à plusieurs bonnes réponses : menu de sélection multiple', () => {
  const [row] = answerRows('s1', 1, multi);
  const component = row.components[0].toJSON();
  assert.equal(component.type, ComponentType.StringSelect);
  assert.ok('max_values' in component && component.max_values === 3);
});

test('deux lancements dans le même tick : un seul démarre', async () => {
  const fake = fakeChannel('c-race');
  const first = startGame(fake.channel, 'g', 'mod', [free()], 30, ['Geo'], 1);
  const second = startGame(fake.channel, 'g', 'mod', [free()], 30, ['Geo'], 1);
  assert.equal(await first, true);
  assert.equal(await second, false);
  assert.equal(fake.sent.length, 1);
  await stopGame('c-race');
});

test('/stop pendant l\'envoi d\'une question : plus rien ne se passe ensuite', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    const fake = fakeChannel('c-stop', 'holdEmbeds');
    await startGame(fake.channel, 'g', 'mod', [free(), free()], 30, ['Geo'], 2);
    mock.timers.tick(10_000);
    await flush();
    await stopGame('c-stop');
    const sentAtStop = fake.sent.length;
    fake.release();
    await flush();
    mock.timers.tick(120_000);
    await flush();
    assert.equal(fake.edits.length, 0);
    assert.equal(fake.sent.length, sentAtStop);
  } finally {
    mock.timers.reset();
  }
});

test('erreur non fatale pendant une question : la partie se termine et libère le salon', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    const fake = fakeChannel('c-fail', 'failEmbeds');
    await startGame(fake.channel, 'g', 'mod', [free()], 30, ['Geo'], 1);
    mock.timers.tick(10_000);
    await flush();
    await flush();
    assert.equal(isGameRunning('c-fail'), false);
  } finally {
    mock.timers.reset();
  }
});

test('URL d\'image invalide : la question part quand même, sans image', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    const fake = fakeChannel('c-image');
    await startGame(fake.channel, 'g', 'mod', [free('imgur.com/sans-schema.png')], 30, ['Geo'], 1);
    mock.timers.tick(10_000);
    await flush();
    assert.ok(fake.sent.includes('question'));
    assert.equal(isGameRunning('c-image'), true);
    await stopGame('c-image');
  } finally {
    mock.timers.reset();
  }
});
