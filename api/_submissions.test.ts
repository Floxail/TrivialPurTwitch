// Lancer : yarn test:api
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { APPROVED_SUBMISSIONS_SQL } from './_utils.ts';

test('propositions approuvées : par identifiant, un pseudo Discord identique ne compte pas', async () => {
  const db = createClient({ url: ':memory:' });
  await db.execute('CREATE TABLE pending_questions (submitted_by TEXT, submitted_by_id TEXT, status TEXT)');
  await db.execute(`INSERT INTO pending_questions VALUES
    ('floxail', '42', 'approved'),
    ('Floxail', 'discord:1', 'approved'),
    ('floxail', NULL, 'approved'),
    ('floxail', '42', 'pending')`);
  const result = await db.execute({ sql: APPROVED_SUBMISSIONS_SQL, args: ['42', 'floxail'] });
  assert.equal(Number(result.rows[0].count), 2);
});
