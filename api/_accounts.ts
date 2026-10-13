import type { Client, Row } from '@libsql/client';

export type AccountProvider = 'twitch' | 'discord' | 'google';
export type AccountProfile = { providerId: string; name: string; avatar: string | null };
export type AccountRow = AccountProfile & { primaryId: string };
export type GroupRef = { primaryId: string; name: string };
export type LinkResult = 'linked' | 'already_linked';
export type UnlinkResult = 'unlinked' | 'forbidden';
export type DiscordTotals = { score: number; games: number; answers: number; firsts: number; bestCombo: number; fastest: number | null };

export const ACCOUNT_LINKS_SQL = [
  `CREATE TABLE IF NOT EXISTS account_links (
    provider_id TEXT PRIMARY KEY,
    primary_id  TEXT NOT NULL,
    name        TEXT,
    avatar      TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  )`,
  'CREATE INDEX IF NOT EXISTS idx_account_links_primary ON account_links(primary_id)',
];

/** Les ID Twitch n'ont pas de préfixe ; Discord et Google sont `discord:…` / `google:…`. */
export const isTwitchId = (id: string) => !id.includes(':');

export function providerOf(id: string): AccountProvider {
  if (id.startsWith('discord:')) return 'discord';
  if (id.startsWith('google:')) return 'google';
  return 'twitch';
}

const toAccount = (row: Row): AccountRow => ({
  providerId: String(row.provider_id),
  primaryId: String(row.primary_id),
  name: String(row.name ?? ''),
  avatar: row.avatar == null ? null : String(row.avatar),
});

const SELECT_ACCOUNT = 'SELECT provider_id, primary_id, name, avatar FROM account_links';

/** Crée la ligne du compte (identité principale = lui-même) ou rafraîchit nom et avatar. */
export async function upsertAccount(db: Client, profile: AccountProfile): Promise<void> {
  await db.execute({
    sql: `INSERT INTO account_links (provider_id, primary_id, name, avatar) VALUES (?, ?, ?, ?)
          ON CONFLICT(provider_id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar`,
    args: [profile.providerId, profile.providerId, profile.name, profile.avatar],
  });
}

export async function findAccount(db: Client, providerId: string): Promise<AccountRow | null> {
  const result = await db.execute({ sql: `${SELECT_ACCOUNT} WHERE provider_id = ?`, args: [providerId] });
  return result.rows.length > 0 ? toAccount(result.rows[0]) : null;
}

/** Identité principale d'un compte : lui-même s'il n'a pas de ligne. */
export async function resolvePrimary(db: Client, providerId: string): Promise<string> {
  return (await findAccount(db, providerId))?.primaryId ?? providerId;
}

export async function listGroup(db: Client, primaryId: string): Promise<AccountRow[]> {
  const result = await db.execute({ sql: `${SELECT_ACCOUNT} WHERE primary_id = ? ORDER BY created_at`, args: [primaryId] });
  return result.rows.map(toAccount);
}

const REATTRIBUTE_SQL = [
  'UPDATE pending_questions SET submitted_by_id = ? WHERE submitted_by_id = ?',
  'UPDATE boxes SET created_by_id = ? WHERE created_by_id = ?',
  'UPDATE question_reports SET reported_by_id = ? WHERE reported_by_id = ?',
];

export async function linkAccounts(db: Client, group: GroupRef, added: AccountProfile): Promise<LinkResult> {
  // Un ticket de liaison peut dater d'avant un changement d'identité principale (Twitch lié entre-temps)
  const current = { ...group, primaryId: await resolvePrimary(db, group.primaryId) };
  if (added.providerId === current.primaryId) return 'linked';
  const existing = await findAccount(db, added.providerId);
  if (existing?.primaryId === current.primaryId) return 'linked';
  if (existing && existing.primaryId !== added.providerId) return 'already_linked';
  const members = await listGroup(db, added.providerId);
  if (members.some(member => member.providerId !== added.providerId)) return 'already_linked';

  // Un Twitch devient l'identité principale : scores, historique et admin restent rattachés à son ID.
  const newPrimary = isTwitchId(added.providerId) && !isTwitchId(current.primaryId) ? added.providerId : current.primaryId;
  const replacedId = newPrimary === current.primaryId ? added.providerId : current.primaryId;
  await db.batch([
    { sql: 'INSERT OR IGNORE INTO account_links (provider_id, primary_id, name) VALUES (?, ?, ?)', args: [current.primaryId, current.primaryId, current.name] },
    {
      sql: `INSERT INTO account_links (provider_id, primary_id, name, avatar) VALUES (?, ?, ?, ?)
            ON CONFLICT(provider_id) DO UPDATE SET primary_id = excluded.primary_id, name = excluded.name, avatar = excluded.avatar`,
      args: [added.providerId, newPrimary, added.name, added.avatar],
    },
    { sql: 'UPDATE account_links SET primary_id = ? WHERE primary_id = ?', args: [newPrimary, current.primaryId] },
    ...REATTRIBUTE_SQL.map(sql => ({ sql, args: [newPrimary, replacedId] })),
  ], 'write');
  return 'linked';
}

export async function unlinkAccount(db: Client, primaryId: string, providerId: string, currentProviderId: string): Promise<UnlinkResult> {
  if (providerId === primaryId || providerId === currentProviderId) return 'forbidden';
  const account = await findAccount(db, providerId);
  if (!account || account.primaryId !== primaryId) return 'forbidden';
  // Un Discord/Google délié redevient un compte autonome ; un Twitch sans liaison n'a pas de ligne.
  await db.execute(isTwitchId(providerId)
    ? { sql: 'DELETE FROM account_links WHERE provider_id = ?', args: [providerId] }
    : { sql: 'UPDATE account_links SET primary_id = provider_id WHERE provider_id = ?', args: [providerId] });
  return 'unlinked';
}

/** ID Discord brut (celui de `discord_scores`) du compte connecté ou de son groupe. */
export async function discordIdInGroup(db: Client, primaryId: string, providerId: string): Promise<string | null> {
  const prefix = 'discord:';
  if (providerId.startsWith(prefix)) return providerId.slice(prefix.length);
  const result = await db.execute({
    sql: "SELECT provider_id FROM account_links WHERE primary_id = ? AND provider_id LIKE 'discord:%' LIMIT 1",
    args: [primaryId],
  });
  return result.rows.length > 0 ? String(result.rows[0].provider_id).slice(prefix.length) : null;
}

export async function discordTotals(db: Client, discordId: string): Promise<DiscordTotals> {
  const result = await db.execute({
    sql: `SELECT COALESCE(SUM(score), 0) AS score, COUNT(DISTINCT session_id) AS games,
                 COALESCE(SUM(answers), 0) AS answers, COALESCE(SUM(firsts), 0) AS firsts,
                 COALESCE(MAX(combos), 0) AS best_combo, MIN(NULLIF(fastest, 0)) AS fastest
          FROM discord_scores WHERE user_id = ?`,
    args: [discordId],
  });
  const row = result.rows[0];
  return {
    score: Number(row.score),
    games: Number(row.games),
    answers: Number(row.answers),
    firsts: Number(row.firsts),
    bestCombo: Number(row.best_combo),
    fastest: row.fastest == null ? null : Number(row.fastest),
  };
}
