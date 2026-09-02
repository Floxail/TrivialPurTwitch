// Lancer : yarn test:api
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTargetBox, DEFAULT_BOX_NAME } from './_utils.ts';

test('une boîte explicitement choisie par le modérateur gagne', () => {
  assert.equal(resolveTargetBox('Cinéma', 'Culture G'), 'Cinéma');
});

test('à défaut, on garde la boîte proposée par le contributeur', () => {
  assert.equal(resolveTargetBox(undefined, 'Culture G'), 'Culture G');
});

test('sans boîte nulle part, la question tombe dans le bac par défaut', () => {
  assert.equal(resolveTargetBox(undefined, undefined), DEFAULT_BOX_NAME);
  assert.equal(resolveTargetBox(null, null), DEFAULT_BOX_NAME);
});

test('le bac par défaut est bien "Sans boîte"', () => {
  // C'est le nom déjà utilisé par l'ajout direct et l'import. Le chemin de
  // modération doit atterrir au même endroit, pas dans une boîte arbitraire.
  assert.equal(DEFAULT_BOX_NAME, 'Sans boîte');
});

test('une chaîne vide ou blanche compte comme absente', () => {
  assert.equal(resolveTargetBox('', 'Culture G'), 'Culture G');
  assert.equal(resolveTargetBox('   ', 'Culture G'), 'Culture G');
  assert.equal(resolveTargetBox('', ''), DEFAULT_BOX_NAME);
  assert.equal(resolveTargetBox('  ', '  '), DEFAULT_BOX_NAME);
});

test('une valeur non-string est ignorée', () => {
  assert.equal(resolveTargetBox(42, 'Culture G'), 'Culture G');
  assert.equal(resolveTargetBox({}, undefined), DEFAULT_BOX_NAME);
});

test('les espaces autour du nom de boîte sont retirés', () => {
  assert.equal(resolveTargetBox('  Cinéma  ', undefined), 'Cinéma');
});
