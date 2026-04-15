/**
 * Reset complet de la table question_stats.
 *
 * Usage:
 *   npx tsx scripts/reset-question-stats.ts
 *
 * Nécessite TURSO_DATABASE_URL + TURSO_AUTH_TOKEN dans .env.local
 */
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    console.error('❌ TURSO_DATABASE_URL ou TURSO_AUTH_TOKEN manquant dans .env.local');
    process.exit(1);
  }

  const db = createClient({ url, authToken });

  const before = await db.execute('SELECT COUNT(*) as c FROM question_stats').catch(() => null);
  const count = before ? Number(before.rows[0].c) : 0;
  console.log(`📊 ${count} lignes dans question_stats avant reset`);

  if (count === 0) {
    console.log('✅ Rien à supprimer.');
    return;
  }

  await db.execute('DELETE FROM question_stats');
  console.log(`🗑️  ${count} lignes supprimées.`);

  const after = await db.execute('SELECT COUNT(*) as c FROM question_stats');
  console.log(`✅ Vérif post-reset : ${Number(after.rows[0].c)} lignes restantes.`);
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
