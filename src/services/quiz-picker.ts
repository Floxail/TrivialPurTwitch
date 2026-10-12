// Tirage des questions, partagé par le site et le bot Discord. Module pur :
// l'historique anti-répétition est passé en paramètre par l'appelant.

// Entier uniforme dans [0, max) sans biais modulo (rejection sampling sur crypto)
function randomInt(max: number): number {
  if (max <= 1) return 0;
  // Absent dans certains environnements de test (jsdom) : repli sur Math.random
  const cryptoApi = globalThis.crypto;
  if (cryptoApi) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let v: number;
    do {
      cryptoApi.getRandomValues(buf);
      v = buf[0];
    } while (v >= limit);
    return v % max;
  }
  return Math.floor(Math.random() * max);
}

export function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Sélection biaisée "fraîcheur" : priorité aux questions absentes de l'historique,
// sinon on complète avec les plus anciennement jouées (shuffle dans la tranche la plus vieille).
// recentIds : du plus récent au plus ancien.
export function smartPick<T extends { id: string }>(pool: T[], count: number, recentIds: string[]): T[] {
  if (pool.length === 0 || count <= 0) return [];
  if (pool.length <= count) return fisherYatesShuffle(pool);

  const rank = new Map<string, number>();
  recentIds.forEach((id, i) => rank.set(id, i));

  const fresh: T[] = [];
  const seen: T[] = [];
  for (const q of pool) {
    if (rank.has(q.id)) seen.push(q);
    else fresh.push(q);
  }

  const shuffledFresh = fisherYatesShuffle(fresh);
  if (shuffledFresh.length >= count) {
    return shuffledFresh.slice(0, count);
  }

  // Complément : on prend les plus vieilles (rang élevé = vu il y a longtemps)
  seen.sort((a, b) => (rank.get(b.id)! - rank.get(a.id)!));
  const need = count - shuffledFresh.length;
  const sliceSize = Math.min(seen.length, Math.max(need * 2, need));
  const oldestSlice = fisherYatesShuffle(seen.slice(0, sliceSize));
  return [...shuffledFresh, ...oldestSlice.slice(0, need)];
}

// Échantillonnage stratifié : alloue équitablement entre pools non vides,
// redistribue le leftover et compense si un pool est trop petit
export function stratifiedPick<T extends { id: string }>(pools: T[][], totalCount: number, recentIds: string[]): T[] {
  const nonEmpty = pools.filter((p) => p.length > 0).map((p) => [...p]);
  if (nonEmpty.length === 0 || totalCount <= 0) return [];

  const base = Math.floor(totalCount / nonEmpty.length);
  const alloc = Array.from({ length: nonEmpty.length }, () => base);
  const leftover = totalCount - base * nonEmpty.length;
  const order = fisherYatesShuffle(Array.from({ length: nonEmpty.length }, (_, i) => i));
  for (let i = 0; i < leftover; i++) alloc[order[i]]++;

  const result: T[] = [];
  for (let i = 0; i < nonEmpty.length; i++) {
    const picked = smartPick(nonEmpty[i], Math.min(alloc[i], nonEmpty[i].length), recentIds);
    result.push(...picked);
    const pickedIds = new Set(picked.map((q) => q.id));
    nonEmpty[i] = nonEmpty[i].filter((q) => !pickedIds.has(q.id));
  }

  // Compensation si certains pools étaient trop petits
  while (result.length < totalCount) {
    const available = nonEmpty.filter((p) => p.length > 0);
    if (available.length === 0) break;
    const need = totalCount - result.length;
    const perBox = Math.max(1, Math.ceil(need / available.length));
    for (const pool of available) {
      if (result.length >= totalCount) break;
      const take = Math.min(perBox, pool.length, totalCount - result.length);
      const picked = smartPick(pool, take, recentIds);
      result.push(...picked);
      const pickedIds = new Set(picked.map((q) => q.id));
      const idx = nonEmpty.indexOf(pool);
      nonEmpty[idx] = pool.filter((q) => !pickedIds.has(q.id));
    }
  }

  return fisherYatesShuffle(result);
}

/** Ordre des boîtes ordonnées : date de création, puis ID (qui contient un timestamp). */
export function sortByCreation<T extends { id: string; createdAt?: string }>(questions: T[]): T[] {
  return [...questions].sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      const cmp = a.createdAt.localeCompare(b.createdAt);
      if (cmp !== 0) return cmp;
    } else if (a.createdAt) return -1;
    else if (b.createdAt) return 1;
    return a.id.localeCompare(b.id);
  });
}
