// Lancer : node --test api/_utils.test.ts
// (Node 24 strippe les types nativement — aucune dépendance de test à installer)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateScorePlayers } from './_utils.ts';

const okPlayer = {
  tid: '123',
  nick: 'viewer1',
  score: 12,
  stats: { answers: 4, firsts: 1, combos: 2, fastestAnswer: 3.5 },
};

function expectError(raw: unknown): string {
  const result = validateScorePlayers(raw);
  assert.ok('error' in result, `attendu une erreur pour ${JSON.stringify(raw)}`);
  return result.error;
}

function expectPlayers(raw: unknown) {
  const result = validateScorePlayers(raw);
  assert.ok(!('error' in result), `attendu un succès, reçu ${JSON.stringify(result)}`);
  return result.players;
}

test('rejette une valeur qui n\'est pas un tableau', () => {
  expectError(undefined);
  expectError({ nick: 'viewer1' });
});

test('rejette un tableau vide', () => {
  expectError([]);
});

test('rejette un nick vide ou non-string', () => {
  expectError([{ ...okPlayer, nick: '' }]);
  expectError([{ ...okPlayer, nick: '   ' }]);
  expectError([{ ...okPlayer, nick: 42 }]);
});

test('rejette un nick trop long', () => {
  expectError([{ ...okPlayer, nick: 'a'.repeat(65) }]);
});

test('rejette un score non fini', () => {
  expectError([{ ...okPlayer, score: Infinity }]);
  expectError([{ ...okPlayer, score: NaN }]);
  expectError([{ ...okPlayer, score: 'beaucoup' }]);
});

test('rejette un score négatif', () => {
  expectError([{ ...okPlayer, score: -1 }]);
});

test('rejette un score au-delà du plafond', () => {
  expectError([{ ...okPlayer, score: 100_001 }]);
});

// answers/firsts/combos alimentent SUM() dans le leaderboard global au même titre
// que score — les laisser non bornés rouvrirait le trou par une autre colonne.
test('rejette une stat non finie', () => {
  expectError([{ ...okPlayer, stats: { ...okPlayer.stats, firsts: Infinity } }]);
  expectError([{ ...okPlayer, stats: { ...okPlayer.stats, answers: NaN } }]);
});

test('rejette une stat négative', () => {
  expectError([{ ...okPlayer, stats: { ...okPlayer.stats, combos: -1 } }]);
});

test('rejette une stat au-delà du plafond', () => {
  expectError([{ ...okPlayer, stats: { ...okPlayer.stats, answers: 100_001 } }]);
});

test('rejette plus de joueurs que le plafond', () => {
  const tooMany = Array.from({ length: 1001 }, (_, i) => ({ ...okPlayer, nick: `v${i}` }));
  expectError(tooMany);
});

test('accepte une entrée valide et normalise les champs', () => {
  const [player] = expectPlayers([okPlayer]);
  assert.equal(player.nick, 'viewer1');
  assert.equal(player.tid, '123');
  assert.equal(player.score, 12);
  assert.equal(player.answers, 4);
  assert.equal(player.firsts, 1);
  assert.equal(player.combos, 2);
  assert.equal(player.fastest, 3.5);
});

test('normalise les stats absentes à 0', () => {
  const [player] = expectPlayers([{ nick: 'viewer2', score: 0 }]);
  assert.equal(player.tid, '');
  assert.equal(player.answers, 0);
  assert.equal(player.firsts, 0);
  assert.equal(player.combos, 0);
  assert.equal(player.fastest, 0);
});

test('convertit fastestAnswer Infinity en 0', () => {
  const [player] = expectPlayers([
    { ...okPlayer, stats: { ...okPlayer.stats, fastestAnswer: Infinity } },
  ]);
  assert.equal(player.fastest, 0);
});

test('trim le nick', () => {
  const [player] = expectPlayers([{ ...okPlayer, nick: '  viewer1  ' }]);
  assert.equal(player.nick, 'viewer1');
});
