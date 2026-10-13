import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROPOSE_MESSAGE, commands } from './commands';

test('/proposer est enregistrée, ouverte à tous', () => {
  const proposer = commands.map(command => command.toJSON()).find(command => command.name === 'proposer');
  assert.ok(proposer);
  assert.equal(proposer.default_member_permissions, undefined);
});

test('/proposer renvoie vers l\'onglet de soumission en masse du site', () => {
  assert.match(PROPOSE_MESSAGE, /https:\/\/trivial\.floxail\.fr\/contribute\?mode=bulk/);
  assert.match(PROPOSE_MESSAGE, /Q:/);
  assert.match(PROPOSE_MESSAGE, /Twitch/);
  assert.match(PROPOSE_MESSAGE, /Twitch, Discord ou Google/);
});
