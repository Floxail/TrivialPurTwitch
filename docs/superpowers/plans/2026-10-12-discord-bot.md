# Bot Discord TrivialPurTwitch — Plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUIS : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** un bot Discord multi-serveurs qui fait jouer les quiz TrivialPurTwitch (boîtes Turso) dans un salon, avec réponses privées par boutons et fenêtres, et un classement par serveur.

**Architecture :** le site partage trois modules purs avec le bot (`src/types/question.ts`, `src/services/scoring.ts`, `src/services/quiz-picker.ts`, plus l'existant `answer-validator.ts`). Le bot vit dans `bot/` (projet npm autonome, exécuté par `tsx`) : `catalog.ts` et `game-state.ts` contiennent toute la logique pure et testée ; `db.ts`, `setup.ts`, `game.ts` et `index.ts` font l'I/O Turso et Discord.

**Stack :** discord.js 14.27.0, @libsql/client 0.18.0, tsx 4.23.15, Node 24 (`--env-file`, `node:test`), TypeScript 5 (typecheck du bot), Jest de CRA (modules partagés).

**Spec :** `docs/superpowers/specs/2026-10-12-discord-bot-design.md`

## Contraintes globales

- Aucun intent privilégié : `GatewayIntentBits.Guilds` uniquement.
- Réponses privées : `flags: MessageFlags.Ephemeral` (l'option `ephemeral: true` est dépréciée dans 14.27).
- Modals : `LabelBuilder` + `ModalBuilder.addLabelComponents` (`addActionRowComponents` est déprécié pour les modals).
- Commandes : `setContexts(InteractionContextType.Guild)` (pas `setDMPermission`). `/quiz` et `/stop` : `setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)`.
- Tout message public du bot : `allowedMentions: { parse: [] }`.
- Aucun emoji dans les messages du bot ni dans le code (demande explicite de l'utilisateur).
- Jamais d'ID Discord dans la table `scores`. Le bot n'écrit que dans `discord_scores`.
- Le code doit passer `yarn lint` (Oxlint + règles anti-slop) : pas de `typeof` à l'exécution, pas de paramètres `unknown`, pas de cast `as` sans commentaire `SAFETY:`, pas de « shape » dans les noms.
- Valeurs fixées par la spec : 10 questions et 30 s par défaut ; `questions` 1–50 ; `temps` 10–60 s ; décompte 10 s ; révélation puis 5 s avant la question suivante ; compteur rafraîchi au plus toutes les 3 s ; clémence FIRST 700 ms ; modal 300 caractères max ; cache catalogue 60 s ; historique 500 IDs par serveur ; config expirée après 5 min ; 25 boîtes par page.
- Pas de commit dans les étapes : l'utilisateur gère git lui-même. Chaque tâche se termine par un point de contrôle qui liste les fichiers modifiés.

## Points de vigilance (Review Focus)

1. **Fenêtre de réponse soumise trop tard** (ouverte à la question 3, envoyée après la révélation ou pendant la question 4) : elle doit recevoir « Cette question est terminée » sans compter de point. Test dans la tâche 5 (`submit` avec un numéro de question périmé).
2. **Plus de 25 boîtes** : pages de 25, sélection conservée en changeant de page, une boîte de la page 2 jouable. Test dans la tâche 4 (`pageOf`, `applyPageSelection`).
3. **QCM à 6 options** : une rangée Discord contient 5 boutons maximum, donc 2 rangées (5 + 1). Test dans la tâche 8 (`qcmButtonRows`).
4. **Deux configurations lancées dans le même salon** (deux modérateurs) : la seconde reçoit « Un quiz est déjà en cours ici ». Vérification au clic sur Lancer (tâche 7) et test manuel (tâche 9).
5. **Salon ou message supprimé, ou droits retirés pendant la partie** : la partie s'arrête sans planter le process et les scores sont enregistrés. Gestion dans la tâche 8, test manuel dans la tâche 9.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/types/question.ts` (créé) | `Question`, `QuestionType` |
| `src/components/store/questions-store.ts` (modifié) | ré-exporte les types, utilise `quiz-picker` |
| `src/services/answer-validator.ts` (modifié) | imports relatifs |
| `src/services/scoring.ts` (créé) | `pointsForCorrectAnswer`, `DEFAULT_FIRST_GRACE_MS` |
| `src/services/quiz-picker.ts` (créé) | `fisherYatesShuffle`, `smartPick`, `stratifiedPick`, `sortByCreation` |
| `src/components/store/player-store.ts`, `settings-store.ts` (modifiés) | utilisent `scoring` |
| `bot/package.json`, `bot/tsconfig.json`, `bot/.env.example`, `bot/README.md` (créés) | projet du bot |
| `bot/src/env.ts` | `requireEnv` |
| `bot/src/catalog.ts` | boîtes racines, pagination, tirage (pur) |
| `bot/src/game-state.ts` | état d'une partie, réponses, points, révélation (pur) |
| `bot/src/db.ts` | Turso : schéma, catalogue en cache, scores, classement |
| `bot/src/commands.ts`, `bot/src/register.ts` | définition et enregistrement des commandes |
| `bot/src/setup.ts` | `/quiz` : message de configuration |
| `bot/src/game.ts` | déroulé d'une partie dans le salon |
| `bot/src/index.ts` | client, routage, cycle de vie |

---

### Task 1 : Extraire les types de question

**Fichiers :**
- Créer : `src/types/question.ts`
- Modifier : `src/components/store/questions-store.ts:165-190` (définitions de `QuestionType` et `Question`)
- Modifier : `src/services/answer-validator.ts:1-2`

**Interfaces :**
- Produit : `export enum QuestionType { FREE_TEXT = 'free_text', QCM = 'qcm' }` et `export type Question` dans `src/types/question.ts`. `questions-store.ts` continue d'exporter les deux noms.

- [ ] **Étape 1 : créer `src/types/question.ts`** en y déplaçant les définitions telles quelles :

```ts
// Types partagés entre le site et le bot Discord : aucun import ici,
// pour que Node puisse charger ce fichier sans React ni zustand.

export enum QuestionType {
  FREE_TEXT = 'free_text',  // Réponse libre (mode actuel)
  QCM = 'qcm'               // Questionnaire à Choix Multiples
}

export type Question = {
  id: string;
  question: string;
  answer: string;
  alternativeAnswers?: string[]; // Réponses alternatives acceptées (mode FREE_TEXT)
  boxName: string; // Nom de la boîte
  cardNumber?: number; // Numéro de carte (pour organisation)
  difficulty?: 'easy' | 'medium' | 'hard';

  // Champs QCM
  questionType?: QuestionType; // Par défaut FREE_TEXT si non spécifié
  qcmOptions?: string[]; // 2-6 options (A à F)
  qcmCorrectIndex?: number; // Index de la bonne réponse (legacy, single answer)
  qcmCorrectIndexes?: number[]; // Index des bonnes réponses (multi-réponses)
  createdAt?: string; // Date de création (pour l'ordre dans les boîtes ordonnées)
  imageUrl?: string; // URL externe d'une image associée à la question (Discord, Imgur, etc.)
  answerImageUrl?: string; // URL externe d'une image affichée au moment de la révélation
};
```

- [ ] **Étape 2 : dans `questions-store.ts`**, supprimer le bloc `// Type de question` → fin de `export type Question = {...};`, et ajouter après les imports existants :

```ts
import { Question, QuestionType } from '../../types/question';

export { QuestionType };
export type { Question };
```

- [ ] **Étape 3 : dans `answer-validator.ts`**, remplacer les deux premières lignes par :

```ts
import { cleanValueLight, removeArticles, sorensenDiceScore } from '../helpers';
import { Question, QuestionType } from '../types/question';
```

- [ ] **Étape 4 : vérifier**

Run : `npx tsc -p tsconfig.json --noEmit` → aucune sortie.
Run : `CI=true yarn test --watchAll=false` → `Tests: 11 passed`.

- [ ] **Étape 5 : point de contrôle** — fichiers : `src/types/question.ts`, `src/components/store/questions-store.ts`, `src/services/answer-validator.ts`.

---

### Task 2 : Module de calcul des points

**Fichiers :**
- Créer : `src/services/scoring.ts`, `src/services/scoring.test.ts`
- Modifier : `src/components/store/player-store.ts` (`recordAnswers`, lignes ~201-216)
- Modifier : `src/components/store/settings-store.ts:40` (`gracePeriodMs: 700`)

**Interfaces :**
- Produit : `pointsForCorrectAnswer(basePoints: number, isFirst: boolean, isSolo: boolean, streak: number): number` et `DEFAULT_FIRST_GRACE_MS = 700`. `streak` compte la question en cours (1 = pas de combo).

- [ ] **Étape 1 : écrire le test qui échoue** — `src/services/scoring.test.ts` :

```ts
import { pointsForCorrectAnswer } from './scoring';

describe('pointsForCorrectAnswer', () => {
  it('base seule', () => {
    expect(pointsForCorrectAnswer(1, false, false, 1)).toBe(1);
  });

  it('FIRST ajoute 2', () => {
    expect(pointsForCorrectAnswer(1, true, false, 1)).toBe(3);
  });

  it('seul à trouver ajoute 1', () => {
    expect(pointsForCorrectAnswer(1, false, true, 1)).toBe(2);
  });

  it('combo : +1 par question enchaînée, plafonné à +3', () => {
    expect(pointsForCorrectAnswer(1, false, false, 2)).toBe(2);
    expect(pointsForCorrectAnswer(1, false, false, 4)).toBe(4);
    expect(pointsForCorrectAnswer(1, false, false, 9)).toBe(4);
  });

  it('cumule base 3, FIRST, seul et combo', () => {
    expect(pointsForCorrectAnswer(3, true, true, 3)).toBe(3 + 2 + 1 + 2);
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Run : `CI=true yarn test --watchAll=false src/services/scoring.test.ts` → FAIL, `Cannot find module './scoring'`.

- [ ] **Étape 3 : implémenter** — `src/services/scoring.ts` :

```ts
// Règles de points partagées par le site et le bot Discord. Module pur.

/** Délai pendant lequel une bonne réponse partage la place de FIRST. */
export const DEFAULT_FIRST_GRACE_MS = 700;

const FIRST_BONUS = 2;
const SOLO_BONUS = 1;
const MAX_COMBO_BONUS = 3;

/**
 * Points d'une bonne réponse.
 * `streak` compte les bonnes réponses consécutives, question en cours incluse (1 = pas de combo).
 */
export function pointsForCorrectAnswer(basePoints: number, isFirst: boolean, isSolo: boolean, streak: number): number {
  let points = basePoints;
  if (isFirst) points += FIRST_BONUS;
  if (isSolo) points += SOLO_BONUS;
  if (streak > 1) points += Math.min(streak - 1, MAX_COMBO_BONUS);
  return points;
}
```

- [ ] **Étape 4 : brancher `player-store.ts`** — ajouter `import { pointsForCorrectAnswer } from 'services/scoring';` et remplacer le corps de la boucle `for (const answer of answers)` de `recordAnswers` par :

```ts
          const player = updated[answer.nick];
          if (!player) continue;

          player.currentStreak = (player.currentStreak || 0) + 1;

          if (answer.isFirst) player.stats.firsts++;
          if (player.currentStreak > 1) {
            player.stats.combos++;
            player.stats.maxCombo = Math.max(player.stats.maxCombo || 0, player.currentStreak);
          }

          player.stats.answers++;
          player.stats.fastestAnswer = Math.min(player.stats.fastestAnswer, answer.timer);
          player.score += pointsForCorrectAnswer(answer.basePoints, answer.isFirst, answers.length === 1, player.currentStreak);
```

- [ ] **Étape 5 : brancher `settings-store.ts`** — ajouter `import { DEFAULT_FIRST_GRACE_MS } from '../../services/scoring';` et remplacer `gracePeriodMs: 700,` par `gracePeriodMs: DEFAULT_FIRST_GRACE_MS,`.

- [ ] **Étape 6 : vérifier**

Run : `CI=true yarn test --watchAll=false` → tous verts, dont les 3 tests `recordAnswers` de `answer-validator.test.ts` (non-régression).
Run : `npx tsc -p tsconfig.json --noEmit` → aucune sortie.

- [ ] **Étape 7 : point de contrôle** — fichiers : `src/services/scoring.ts`, `src/services/scoring.test.ts`, `player-store.ts`, `settings-store.ts`.

---

### Task 3 : Module de tirage des questions

**Fichiers :**
- Créer : `src/services/quiz-picker.ts`, `src/services/quiz-picker.test.ts`
- Modifier : `src/components/store/questions-store.ts` (retirer `randomInt`, `fisherYatesShuffle`, `smartPick`, `stratifiedPick` ; appels lignes ~538, 552, 567, 573-585)

**Interfaces :**
- Produit :
  - `fisherYatesShuffle<T>(arr: T[]): T[]`
  - `smartPick<T extends { id: string }>(pool: T[], count: number, recentIds: string[]): T[]`
  - `stratifiedPick<T extends { id: string }>(pools: T[][], totalCount: number, recentIds: string[]): T[]`
  - `sortByCreation<T extends { id: string; createdAt?: string }>(questions: T[]): T[]`
  - `recentIds` : IDs du plus récent au plus ancien.

- [ ] **Étape 1 : écrire le test qui échoue** — `src/services/quiz-picker.test.ts` :

```ts
import { smartPick, sortByCreation, stratifiedPick } from './quiz-picker';

const items = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));

describe('smartPick', () => {
  it('retourne le nombre demandé, sans doublon', () => {
    const picked = smartPick(items('q', 20), 7, []);
    expect(picked).toHaveLength(7);
    expect(new Set(picked.map(q => q.id)).size).toBe(7);
  });

  it('priorise les questions absentes de l\'historique', () => {
    const pool = items('q', 10);
    const recent = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
    const picked = smartPick(pool, 3, recent).map(q => q.id).sort();
    expect(picked).toEqual(['q7', 'q8', 'q9']);
  });

  it('complète avec les plus anciennement jouées', () => {
    const pool = items('q', 4);
    // q0 = le plus récent, q3 = le plus ancien
    const picked = smartPick(pool, 1, ['q0', 'q1', 'q2', 'q3']).map(q => q.id);
    expect(['q2', 'q3']).toContain(picked[0]);
  });

  it('pool plus petit que la demande : tout le pool', () => {
    expect(smartPick(items('q', 3), 10, [])).toHaveLength(3);
  });
});

describe('stratifiedPick', () => {
  it('répartit équitablement entre les pools', () => {
    const picked = stratifiedPick([items('a', 10), items('b', 10)], 4, []);
    expect(picked.filter(q => q.id.startsWith('a'))).toHaveLength(2);
    expect(picked.filter(q => q.id.startsWith('b'))).toHaveLength(2);
  });

  it('compense un pool trop petit', () => {
    const picked = stratifiedPick([items('a', 1), items('b', 10)], 6, []);
    expect(picked).toHaveLength(6);
    expect(picked.filter(q => q.id.startsWith('a'))).toHaveLength(1);
  });
});

describe('sortByCreation', () => {
  it('trie par createdAt puis id, les dates manquantes en dernier', () => {
    const sorted = sortByCreation([
      { id: 'c' },
      { id: 'b', createdAt: '2026-01-02' },
      { id: 'a', createdAt: '2026-01-02' },
      { id: 'd', createdAt: '2026-01-01' },
    ]);
    expect(sorted.map(q => q.id)).toEqual(['d', 'a', 'b', 'c']);
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Run : `CI=true yarn test --watchAll=false src/services/quiz-picker.test.ts` → FAIL, `Cannot find module './quiz-picker'`.

- [ ] **Étape 3 : implémenter** — `src/services/quiz-picker.ts`. On déplace le code existant ; seul changement : l'historique devient le paramètre `recentIds`, et les types deviennent génériques (ce qui supprime les casts `as Question[]`).

```ts
// Tirage des questions, partagé par le site et le bot Discord. Module pur :
// l'historique anti-répétition est passé en paramètre par l'appelant.

// Entier uniforme dans [0, max) sans biais modulo (rejection sampling sur crypto)
function randomInt(max: number): number {
  if (max <= 1) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let v: number;
    do {
      crypto.getRandomValues(buf);
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
  const alloc = new Array(nonEmpty.length).fill(base);
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
```

- [ ] **Étape 4 : brancher `questions-store.ts`**
  1. Supprimer `randomInt`, `fisherYatesShuffle`, `smartPick` et `stratifiedPick` (lignes ~20-44 et ~96-164). Garder `getRecentHistory`, `addToHistory`, `mergeServerHistory`, `countFreshInPool`.
  2. Ajouter : `import { smartPick, sortByCreation, stratifiedPick } from '../../services/quiz-picker';`
  3. Remplacer les appels :

```ts
        // generateRandomQuiz
        const picked = smartPick(allQuestions, Math.min(questionCount, allQuestions.length), getRecentHistory());

        // generateRandomQuizAllBoxes
        const picked = stratifiedPick(Array.from(byBox.values()), questionCount, getRecentHistory());

        // generateRandomQuizFromBoxes
        const picked = stratifiedPick(pools, questionCount, getRecentHistory());
```

  4. Dans `generateOrderedQuiz`, remplacer le `questions.sort(...)` et le `return questions;` par `return sortByCreation(questions);`.
  5. Supprimer les casts `as Question[]` devenus inutiles sur les deux `stratifiedPick`.

- [ ] **Étape 5 : vérifier**

Run : `CI=true yarn test --watchAll=false` → tous verts.
Run : `npx tsc -p tsconfig.json --noEmit` → aucune sortie.
Run : `grep -n "fisherYatesShuffle\|function smartPick\|function stratifiedPick" src/components/store/questions-store.ts` → aucune ligne.

- [ ] **Étape 6 : point de contrôle** — fichiers : `src/services/quiz-picker.ts`, `src/services/quiz-picker.test.ts`, `questions-store.ts`.

---

### Task 4 : Projet `bot/` et catalogue des boîtes

**Fichiers :**
- Créer : `bot/package.json`, `bot/tsconfig.json`, `bot/.env.example`, `bot/src/env.ts`, `bot/src/catalog.ts`, `bot/src/catalog.test.ts`
- Modifier : `.gitignore`

**Interfaces :**
- Consomme : `Question`, `QuestionType` (tâche 1) ; `smartPick`, `stratifiedPick`, `sortByCreation` (tâche 3).
- Produit :
  - `type BoxMeta = { name: string; ordered: boolean; hidden: boolean; parentBox: string | null }`
  - `type Catalog = { boxes: BoxMeta[]; questions: Question[] }`
  - `type RootBox = { name: string; ordered: boolean; questionCount: number; memberNames: string[] }`
  - `listRootBoxes(catalog: Catalog): RootBox[]`
  - `PAGE_SIZE = 25`, `pageCount(total: number): number`, `pageOf(page: number, total: number): number[]` (index globaux des boîtes de la page)
  - `applyPageSelection(selected: Set<number>, page: number, total: number, chosen: number[]): Set<number>`
  - `pickQuestions(catalog: Catalog, roots: RootBox[], count: number, recentIds: string[]): Question[]`
  - `requireEnv(name: string): string`

- [ ] **Étape 1 : créer le projet**

`bot/package.json` :

```json
{
  "name": "trivialpurtwitch-bot",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx --env-file=.env src/index.ts",
    "register": "tsx --env-file=.env src/register.ts",
    "test": "tsx --test src/*.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@libsql/client": "0.18.0",
    "discord.js": "14.27.0",
    "tsx": "4.23.15"
  },
  "devDependencies": {
    "@types/node": "^24",
    "typescript": "^5"
  }
}
```

`bot/tsconfig.json` (la lib `DOM` est requise parce que `src/helpers.ts` référence `window`, même si le bot n'appelle jamais ces fonctions) :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

`bot/.env.example` :

```
# Portail développeur Discord > ton application
DISCORD_TOKEN=
DISCORD_APP_ID=
# Turso : token dédié au bot (turso db tokens create <db>)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

Ajouter à la fin de `.gitignore` :

```
# Bot Discord
bot/node_modules
bot/.env
```

`bot/src/env.ts` :

```ts
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}
```

Run : `cd bot && npm install` → crée `bot/package-lock.json`, sans erreur. On utilise npm et non yarn : le `packageManager` yarn de la racine ferait traiter `bot/` comme une partie du projet du site.

- [ ] **Étape 2 : écrire le test qui échoue** — `bot/src/catalog.test.ts` :

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuestionType, type Question } from '../../src/types/question';
import { applyPageSelection, listRootBoxes, pageCount, pageOf, pickQuestions, type Catalog } from './catalog';

const q = (id: string, boxName: string, createdAt?: string): Question =>
  ({ id, question: `Q${id}`, answer: 'r', boxName, questionType: QuestionType.FREE_TEXT, createdAt });

const catalog: Catalog = {
  boxes: [
    { name: 'Cinéma', ordered: false, hidden: false, parentBox: null },
    { name: 'Cinéma 80s', ordered: false, hidden: false, parentBox: 'Cinéma' },
    { name: 'Secret', ordered: false, hidden: true, parentBox: null },
    { name: 'Pilotes', ordered: true, hidden: false, parentBox: null },
    { name: 'Vide', ordered: false, hidden: false, parentBox: null },
  ],
  questions: [
    q('1', 'Cinéma'), q('2', 'Cinéma 80s'), q('3', 'Cinéma 80s'),
    q('4', 'Secret'),
    q('5', 'Pilotes', '2026-01-02'), q('6', 'Pilotes', '2026-01-01'),
    q('7', 'Sans ligne boxes'),
  ],
};

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

test('pagination : 26 boîtes = 2 pages, la page 2 contient l\'index 25', () => {
  assert.equal(pageCount(26), 2);
  assert.equal(pageCount(25), 1);
  assert.deepEqual(pageOf(1, 26), [25]);
  assert.equal(pageOf(0, 26).length, 25);
});

test('applyPageSelection : remplace la page courante, garde les autres pages', () => {
  const selected = new Set([2, 30]);
  const next = applyPageSelection(selected, 0, 31, [5, 7]);
  assert.deepEqual([...next].sort((a, b) => a - b), [5, 7, 30]);
});

test('pickQuestions : boîte ordonnée seule = toutes, dans l\'ordre', () => {
  const pilotes = listRootBoxes(catalog).filter(r => r.name === 'Pilotes');
  assert.deepEqual(pickQuestions(catalog, pilotes, 1, []).map(x => x.id), ['6', '5']);
});

test('pickQuestions : boîte normale inclut ses sous-boîtes', () => {
  const cinema = listRootBoxes(catalog).filter(r => r.name === 'Cinéma');
  assert.deepEqual(pickQuestions(catalog, cinema, 10, []).map(x => x.id).sort(), ['1', '2', '3']);
});

test('pickQuestions : plusieurs boîtes = répartition entre elles', () => {
  const roots = listRootBoxes(catalog).filter(r => r.name !== 'Sans ligne boxes');
  const picked = pickQuestions(catalog, roots, 4, []);
  assert.equal(picked.length, 4);
  assert.equal(picked.filter(x => x.boxName === 'Pilotes').length, 2);
});
```

- [ ] **Étape 3 : vérifier l'échec**

Run : `cd bot && npm test` → FAIL, module `./catalog` introuvable.

- [ ] **Étape 4 : implémenter** — `bot/src/catalog.ts` :

```ts
import type { Question } from '../../src/types/question';
import { smartPick, sortByCreation, stratifiedPick } from '../../src/services/quiz-picker';

export type BoxMeta = { name: string; ordered: boolean; hidden: boolean; parentBox: string | null };
export type Catalog = { boxes: BoxMeta[]; questions: Question[] };
/** Boîte proposée dans le menu : une racine et ses sous-boîtes visibles. */
export type RootBox = { name: string; ordered: boolean; questionCount: number; memberNames: string[] };

export const PAGE_SIZE = 25;

/**
 * Boîtes de premier niveau jouables, triées par nom.
 * Comme sur le site, une boîte existe dès qu'une question la référence, même
 * sans ligne dans la table `boxes`.
 */
export function listRootBoxes(catalog: Catalog): RootBox[] {
  const meta = new Map(catalog.boxes.map(b => [b.name, b]));
  const counts = new Map<string, number>();
  for (const question of catalog.questions) {
    counts.set(question.boxName, (counts.get(question.boxName) ?? 0) + 1);
  }

  const names = new Set([...counts.keys(), ...meta.keys()]);
  const visible = [...names].filter(name => !meta.get(name)?.hidden);
  const visibleSet = new Set(visible);
  const parentOf = (name: string) => {
    const parent = meta.get(name)?.parentBox ?? null;
    return parent !== null && visibleSet.has(parent) ? parent : null;
  };

  return visible
    .filter(name => parentOf(name) === null)
    .map(name => {
      const memberNames = [name, ...visible.filter(child => parentOf(child) === name)];
      const questionCount = memberNames.reduce((sum, member) => sum + (counts.get(member) ?? 0), 0);
      return { name, ordered: meta.get(name)?.ordered ?? false, questionCount, memberNames };
    })
    .filter(root => root.questionCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** Index globaux des boîtes affichées sur `page`. */
export function pageOf(page: number, total: number): number[] {
  const start = page * PAGE_SIZE;
  return Array.from({ length: Math.max(0, Math.min(PAGE_SIZE, total - start)) }, (_, i) => start + i);
}

/** Le menu Discord ne renvoie que la page affichée : on remplace cette page, on garde les autres. */
export function applyPageSelection(selected: Set<number>, page: number, total: number, chosen: number[]): Set<number> {
  const onPage = new Set(pageOf(page, total));
  return new Set([...[...selected].filter(index => !onPage.has(index)), ...chosen]);
}

export function pickQuestions(catalog: Catalog, roots: RootBox[], count: number, recentIds: string[]): Question[] {
  const questionsOf = (root: RootBox) => {
    const members = new Set(root.memberNames);
    return catalog.questions.filter(question => members.has(question.boxName));
  };

  if (roots.length === 1 && roots[0].ordered) return sortByCreation(questionsOf(roots[0]));
  if (roots.length === 1) return smartPick(questionsOf(roots[0]), count, recentIds);
  return stratifiedPick(roots.map(questionsOf), count, recentIds);
}
```

- [ ] **Étape 5 : vérifier**

Run : `cd bot && npm test` → 7 tests `pass`.
Run : `cd bot && npm run typecheck` → aucune sortie. Ça prouve aussi que les modules partagés de `src/` se chargent dans Node, sans React.
Run (racine) : `yarn lint 2>&1 | grep "bot/"` → aucune ligne.

- [ ] **Étape 6 : point de contrôle** — fichiers : `bot/package.json`, `bot/package-lock.json`, `bot/tsconfig.json`, `bot/.env.example`, `bot/src/env.ts`, `bot/src/catalog.ts`, `bot/src/catalog.test.ts`, `.gitignore`.

---

### Task 5 : État d'une partie (logique pure)

**Fichiers :**
- Créer : `bot/src/game-state.ts`, `bot/src/game-state.test.ts`

**Interfaces :**
- Consomme : `verifyAnswer` (`src/services/answer-validator.ts`), `pointsForCorrectAnswer`, `DEFAULT_FIRST_GRACE_MS` (tâche 2), `Question`, `QuestionType`.
- Produit :
  - `type Player = { userId: string; name: string; score: number; answers: number; firsts: number; combos: number; fastest: number; streak: number }`
  - `type Finder = { name: string; points: number; isFirst: boolean; isCombo: boolean }`
  - `type AnswerOutcome = 'correct' | 'wrong' | 'already-found' | 'no-more-attempts' | 'closed'`
  - `class GameState` avec `constructor(questions: Question[], graceMs?: number)` et :
    - `questionNumber: number` (1-based, 0 avant la première question)
    - `current: Question | undefined`
    - `isOpen: boolean`
    - `finderCount: number`
    - `startNextQuestion(now: number): Question | undefined`
    - `hasFound(userId: string): boolean`
    - `submit(questionNumber: number, userId: string, name: string, text: string, now: number): AnswerOutcome`
    - `reveal(): Finder[]`
    - `ranking(): Player[]`
  - `correctAnswerText(question: Question): string`
  - `QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']`

- [ ] **Étape 1 : écrire le test qui échoue** — `bot/src/game-state.test.ts` :

```ts
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
```

- [ ] **Étape 2 : vérifier l'échec**

Run : `cd bot && npm test` → FAIL, module `./game-state` introuvable.

- [ ] **Étape 3 : implémenter** — `bot/src/game-state.ts` :

```ts
import { QuestionType, type Question } from '../../src/types/question';
import { verifyAnswer } from '../../src/services/answer-validator';
import { DEFAULT_FIRST_GRACE_MS, pointsForCorrectAnswer } from '../../src/services/scoring';

export const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export type Player = {
  userId: string;
  name: string;
  score: number;
  answers: number;
  firsts: number;
  combos: number;
  /** Meilleur temps de réponse en ms, 0 tant qu'aucune bonne réponse. */
  fastest: number;
  streak: number;
};

export type Finder = { name: string; points: number; isFirst: boolean; isCombo: boolean };

export type AnswerOutcome = 'correct' | 'wrong' | 'already-found' | 'no-more-attempts' | 'closed';

type CorrectAnswer = { userId: string; name: string; at: number };

export function correctIndexes(question: Question): number[] {
  return question.qcmCorrectIndexes
    ?? (question.qcmCorrectIndex !== undefined ? [question.qcmCorrectIndex] : []);
}

export function correctAnswerText(question: Question): string {
  if (question.questionType !== QuestionType.QCM) return question.answer;
  return correctIndexes(question)
    .map(i => `${QCM_LABELS[i]}. ${question.qcmOptions?.[i] ?? ''}`)
    .join(', ');
}

/** Une partie, sans Discord : questions, réponses, points. Tout le temps est passé en paramètre. */
export class GameState {
  private readonly players = new Map<string, Player>();
  private index = -1;
  private open = false;
  private startedAt = 0;
  private correct: CorrectAnswer[] = [];
  private attempted = new Set<string>();

  constructor(readonly questions: Question[], private readonly graceMs = DEFAULT_FIRST_GRACE_MS) {}

  get questionNumber(): number {
    return this.index + 1;
  }

  get current(): Question | undefined {
    return this.questions[this.index];
  }

  get isOpen(): boolean {
    return this.open;
  }

  get finderCount(): number {
    return this.correct.length;
  }

  startNextQuestion(now: number): Question | undefined {
    this.index++;
    this.correct = [];
    this.attempted = new Set();
    this.startedAt = now;
    this.open = this.current !== undefined;
    return this.current;
  }

  hasFound(userId: string): boolean {
    return this.correct.some(answer => answer.userId === userId);
  }

  submit(questionNumber: number, userId: string, name: string, text: string, now: number): AnswerOutcome {
    const question = this.current;
    if (!this.open || !question || questionNumber !== this.questionNumber) return 'closed';
    if (this.hasFound(userId)) return 'already-found';

    const isQcm = question.questionType === QuestionType.QCM;
    if (isQcm && this.attempted.has(userId)) return 'no-more-attempts';

    const result = verifyAnswer(text, question);
    if (isQcm) this.attempted.add(userId);
    if (!result.valid || !result.isCorrect) return 'wrong';

    this.correct.push({ userId, name, at: now });
    return 'correct';
  }

  /** Ferme la question, attribue les points, remet à zéro le combo de ceux qui n'ont pas trouvé. */
  reveal(): Finder[] {
    this.open = false;
    const firstAt = this.correct[0]?.at ?? 0;
    const isSolo = this.correct.length === 1;
    const finderIds = new Set(this.correct.map(answer => answer.userId));

    for (const player of this.players.values()) {
      if (!finderIds.has(player.userId)) player.streak = 0;
    }

    return this.correct.map(answer => {
      const player = this.playerFor(answer);
      const isFirst = answer.at - firstAt <= this.graceMs;
      const elapsed = answer.at - this.startedAt;

      player.streak++;
      player.answers++;
      if (isFirst) player.firsts++;
      if (player.streak > 1) player.combos++;
      player.fastest = player.fastest === 0 ? elapsed : Math.min(player.fastest, elapsed);

      const points = pointsForCorrectAnswer(1, isFirst, isSolo, player.streak);
      player.score += points;
      return { name: player.name, points, isFirst, isCombo: player.streak > 1 };
    });
  }

  ranking(): Player[] {
    return [...this.players.values()].sort((a, b) => b.score - a.score);
  }

  private playerFor(answer: CorrectAnswer): Player {
    const existing = this.players.get(answer.userId);
    if (existing) {
      existing.name = answer.name;
      return existing;
    }
    const created: Player = { userId: answer.userId, name: answer.name, score: 0, answers: 0, firsts: 0, combos: 0, fastest: 0, streak: 0 };
    this.players.set(answer.userId, created);
    return created;
  }
}
```

- [ ] **Étape 4 : vérifier**

Run : `cd bot && npm test` → 14 tests `pass` (7 catalog + 7 game-state).
Run : `cd bot && npm run typecheck` → aucune sortie.
Run (racine) : `yarn lint 2>&1 | grep "bot/"` → aucune ligne.

- [ ] **Étape 5 : point de contrôle** — fichiers : `bot/src/game-state.ts`, `bot/src/game-state.test.ts`.

---

### Task 6 : Turso, commandes, `/boites` et `/classement`

**Fichiers :**
- Créer : `bot/src/db.ts`, `bot/src/commands.ts`, `bot/src/register.ts`, `bot/src/index.ts`

**Interfaces :**
- Consomme : `Catalog`, `BoxMeta`, `listRootBoxes` (tâche 4), `Player` (tâche 5), `requireEnv`.
- Produit :
  - `ensureSchema(): Promise<void>`
  - `loadCatalog(): Promise<Catalog>` (cache 60 s)
  - `saveScores(guildId: string, channelId: string, sessionId: string, boxNames: string[], players: Player[]): Promise<void>` (un nouvel essai, puis exception)
  - `type LeaderboardEntry = { name: string; score: number; answers: number; firsts: number }`
  - `leaderboard(guildId: string): Promise<LeaderboardEntry[]>`
  - `deleteGuildScores(guildId: string): Promise<void>`
  - `commands` (tableau de `SlashCommandBuilder`)
  - `index.ts` : `handleInteraction(interaction: Interaction): Promise<void>` (routage, complété aux tâches 7 et 8)

- [ ] **Étape 1 : `bot/src/db.ts`**

```ts
import { createClient, type Client, type Row, type Value } from '@libsql/client';
import { QuestionType, type Question } from '../../src/types/question';
import type { BoxMeta, Catalog } from './catalog';
import type { Player } from './game-state';
import { requireEnv } from './env';

let client: Client | undefined;

function db(): Client {
  client ??= createClient({ url: requireEnv('TURSO_DATABASE_URL'), authToken: requireEnv('TURSO_AUTH_TOKEN') });
  return client;
}

export async function ensureSchema(): Promise<void> {
  await db().batch([
    `CREATE TABLE IF NOT EXISTS discord_scores (
      guild_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      username   TEXT NOT NULL,
      score      INTEGER NOT NULL DEFAULT 0,
      answers    INTEGER NOT NULL DEFAULT 0,
      firsts     INTEGER NOT NULL DEFAULT 0,
      combos     INTEGER NOT NULL DEFAULT 0,
      fastest    INTEGER NOT NULL DEFAULT 0,
      session_id TEXT NOT NULL,
      box_names  TEXT,
      channel_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    'CREATE INDEX IF NOT EXISTS idx_discord_scores_guild ON discord_scores(guild_id, user_id)',
  ], 'write');
}

// ponytail: même mapping que rowToQuestion de api/questions.ts, dupliqué pour que
// le bot n'ait pas besoin des dépendances de la racine. À factoriser si un 3e lecteur apparaît.
const optionalText = (value: Value | undefined) => (value == null ? undefined : String(value));

function parseList(value: Value | undefined): string[] | undefined {
  if (value == null) return undefined;
  const parsed: unknown = JSON.parse(String(value));
  return Array.isArray(parsed) ? parsed.map(String) : undefined;
}

function questionFromRow(row: Row): Question {
  return {
    id: String(row.id),
    question: String(row.question),
    answer: String(row.answer),
    alternativeAnswers: parseList(row.alternative_answers),
    boxName: String(row.box_name),
    questionType: row.question_type === 'qcm' ? QuestionType.QCM : QuestionType.FREE_TEXT,
    qcmOptions: parseList(row.qcm_options),
    qcmCorrectIndex: row.qcm_correct_index == null ? undefined : Number(row.qcm_correct_index),
    qcmCorrectIndexes: parseList(row.qcm_correct_indexes)?.map(Number),
    createdAt: optionalText(row.created_at),
    imageUrl: optionalText(row.image_url),
    answerImageUrl: optionalText(row.answer_image_url),
  };
}

function boxFromRow(row: Row): BoxMeta {
  return {
    name: String(row.name),
    ordered: Number(row.ordered) === 1,
    hidden: Number(row.hidden) === 1,
    parentBox: optionalText(row.parent_box) ?? null,
  };
}

const CATALOG_TTL_MS = 60_000;
let catalogCache: { catalog: Catalog; expiresAt: number } | undefined;

export async function loadCatalog(): Promise<Catalog> {
  if (catalogCache && Date.now() < catalogCache.expiresAt) return catalogCache.catalog;
  const [boxRows, questionRows] = await db().batch([
    'SELECT name, ordered, hidden, parent_box FROM boxes',
    'SELECT * FROM questions ORDER BY rowid',
  ], 'read');
  const catalog = { boxes: boxRows.rows.map(boxFromRow), questions: questionRows.rows.map(questionFromRow) };
  catalogCache = { catalog, expiresAt: Date.now() + CATALOG_TTL_MS };
  return catalog;
}

export async function saveScores(guildId: string, channelId: string, sessionId: string, boxNames: string[], players: Player[]): Promise<void> {
  if (players.length === 0) return;
  const statements = players.map(player => ({
    sql: `INSERT INTO discord_scores (guild_id, user_id, username, score, answers, firsts, combos, fastest, session_id, box_names, channel_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [guildId, player.userId, player.name, player.score, player.answers, player.firsts, player.combos, player.fastest, sessionId, JSON.stringify(boxNames), channelId],
  }));
  try {
    await db().batch(statements, 'write');
  } catch {
    await db().batch(statements, 'write');
  }
}

export type LeaderboardEntry = { name: string; score: number; answers: number; firsts: number };

export async function leaderboard(guildId: string): Promise<LeaderboardEntry[]> {
  const result = await db().execute({
    sql: `SELECT
            (SELECT d2.username FROM discord_scores d2
             WHERE d2.guild_id = d.guild_id AND d2.user_id = d.user_id
             ORDER BY d2.created_at DESC, d2.rowid DESC LIMIT 1) AS username,
            SUM(score) AS score, SUM(answers) AS answers, SUM(firsts) AS firsts
          FROM discord_scores d
          WHERE guild_id = ?
          GROUP BY user_id
          ORDER BY score DESC
          LIMIT 10`,
    args: [guildId],
  });
  return result.rows.map(row => ({
    name: String(row.username),
    score: Number(row.score),
    answers: Number(row.answers),
    firsts: Number(row.firsts),
  }));
}

export async function deleteGuildScores(guildId: string): Promise<void> {
  await db().execute({ sql: 'DELETE FROM discord_scores WHERE guild_id = ?', args: [guildId] });
}
```

- [ ] **Étape 2 : `bot/src/commands.ts`**

```ts
import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const DEFAULT_QUESTION_COUNT = 10;
export const DEFAULT_SECONDS = 30;

export const commands = [
  new SlashCommandBuilder()
    .setName('quiz')
    .setDescription('Lancer un quiz dans ce salon')
    .addIntegerOption(option => option.setName('questions').setDescription(`Nombre de questions (${DEFAULT_QUESTION_COUNT} par défaut)`).setMinValue(1).setMaxValue(50))
    .addIntegerOption(option => option.setName('temps').setDescription(`Secondes par question (${DEFAULT_SECONDS} par défaut)`).setMinValue(10).setMaxValue(60))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Arrêter le quiz en cours dans ce salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Top 10 du serveur')
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('boites')
    .setDescription('Boîtes de questions disponibles')
    .setContexts(InteractionContextType.Guild),
];
```

- [ ] **Étape 3 : `bot/src/register.ts`**

```ts
import { REST, Routes } from 'discord.js';
import { commands } from './commands';
import { requireEnv } from './env';

// Usage : npm run register              -> commandes globales (jusqu'à ~1 h pour apparaître)
//         npm run register -- --guild ID -> serveur de test uniquement (immédiat)
const appId = requireEnv('DISCORD_APP_ID');
const guildFlag = process.argv.indexOf('--guild');
const guildId = guildFlag === -1 ? undefined : process.argv[guildFlag + 1];

const route = guildId ? Routes.applicationGuildCommands(appId, guildId) : Routes.applicationCommands(appId);
await new REST().setToken(requireEnv('DISCORD_TOKEN')).put(route, { body: commands.map(command => command.toJSON()) });
console.log(`${commands.length} commandes enregistrées ${guildId ? `sur le serveur ${guildId}` : 'globalement'}.`);
```

- [ ] **Étape 4 : `bot/src/index.ts`** (version de départ : `/boites` et `/classement`. Les tâches 7 et 8 ajoutent `/quiz`, `/stop` et les composants.)

```ts
import { Client, Events, GatewayIntentBits, MessageFlags, type ChatInputCommandInteraction, type Interaction } from 'discord.js';
import { listRootBoxes } from './catalog';
import { ensureSchema, leaderboard, loadCatalog } from './db';
import { requireEnv } from './env';

const MAX_DESCRIPTION = 4000;

async function showBoxes(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const roots = listRootBoxes(await loadCatalog());
  const lines = roots.map(root => `${root.name} : ${root.questionCount} questions${root.ordered ? ' (ordonnée)' : ''}`);
  let text = '';
  for (const [i, line] of lines.entries()) {
    if (text.length + line.length > MAX_DESCRIPTION) {
      text += `… et ${lines.length - i} autres`;
      break;
    }
    text += `${line}\n`;
  }
  await interaction.editReply(text || 'Aucune boîte disponible.');
}

async function showLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) return;
  await interaction.deferReply();
  const entries = await leaderboard(interaction.guildId);
  const text = entries
    .map((entry, i) => `${i + 1}. ${entry.name} : ${entry.score} pts · ${entry.answers} bonnes réponses · ${entry.firsts} FIRST`)
    .join('\n');
  await interaction.editReply({ content: text || 'Aucun score sur ce serveur pour l\'instant.', allowedMentions: { parse: [] } });
}

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'boites') return showBoxes(interaction);
  if (interaction.commandName === 'classement') return showLeaderboard(interaction);
}

async function reportError(interaction: Interaction, error: Error): Promise<void> {
  console.error(`Interaction ${interaction.id} :`, error);
  if (!interaction.isRepliable()) return;
  const content = 'Erreur inattendue, réessaie dans un instant.';
  const sent = interaction.replied || interaction.deferred
    ? interaction.followUp({ content, flags: MessageFlags.Ephemeral })
    : interaction.reply({ content, flags: MessageFlags.Ephemeral });
  await sent.catch(() => {});
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, ready => {
  console.log(`Connecté en tant que ${ready.user.tag} sur ${ready.guilds.cache.size} serveurs.`);
});

client.on(Events.InteractionCreate, interaction => {
  handleInteraction(interaction).catch((error: Error) => reportError(interaction, error));
});

await ensureSchema();
await client.login(requireEnv('DISCORD_TOKEN'));
```

- [ ] **Étape 5 : vérifier**

Run : `cd bot && npm run typecheck && npm test` → aucune erreur, 14 tests `pass`.
Run (racine) : `yarn lint 2>&1 | grep "bot/"` → aucune ligne.

Vérification manuelle (nécessite l'application Discord, voir tâche 9 étape 1) :
1. Remplir `bot/.env`.
2. `cd bot && npm run register -- --guild <ID du serveur de test>` → « 4 commandes enregistrées sur le serveur … ».
3. `npm start` → « Connecté en tant que … ».
4. Sur Discord, `/boites` affiche la liste avec les nombres de questions, visible par toi seul.
5. `/classement` affiche « Aucun score sur ce serveur pour l'instant. ».

- [ ] **Étape 6 : point de contrôle** — fichiers : `bot/src/db.ts`, `bot/src/commands.ts`, `bot/src/register.ts`, `bot/src/index.ts`.

---

### Task 7 : `/quiz` — message de configuration

**Fichiers :**
- Créer : `bot/src/setup.ts`
- Modifier : `bot/src/index.ts` (`handleInteraction`)

**Interfaces :**
- Consomme : `listRootBoxes`, `pageCount`, `pageOf`, `applyPageSelection`, `pickQuestions`, `RootBox`, `Catalog` (tâche 4) ; `loadCatalog` (tâche 6) ; `DEFAULT_QUESTION_COUNT`, `DEFAULT_SECONDS` (tâche 6) ; `displayName(interaction: RepliableInteraction): string`, `isGameRunning(channelId: string): boolean` et `startGame(channel: SendableChannels, guildId: string, launcherName: string, questions: Question[], seconds: number, boxNames: string[], requestedCount: number): Promise<void>` (tâche 8).
- Produit :
  - `REQUIRED_PERMISSIONS`
  - `missingPermissions(interaction: ChatInputCommandInteraction | ButtonInteraction): string[]`
  - `openSetup(interaction: ChatInputCommandInteraction): Promise<void>`
  - `handleSetupComponent(interaction: StringSelectMenuInteraction | ButtonInteraction): Promise<void>`
  - préfixe de `customId` : `setup:`

Note d'ordre : `setup.ts` importe `displayName`, `isGameRunning` et `startGame` depuis `game.ts`, créé à la tâche 8 (sens unique : `game.ts` n'importe jamais `setup.ts`). Pour que la tâche 7 compile seule, créer à l'étape 1 un `bot/src/game.ts` minimal :

```ts
import { GuildMember, type RepliableInteraction, type SendableChannels } from 'discord.js';
import type { Question } from '../../src/types/question';

/** Pseudo sur le serveur, à défaut nom global, à défaut nom d'utilisateur. */
export function displayName(interaction: RepliableInteraction): string {
  const member = interaction.member;
  if (member instanceof GuildMember) return member.displayName;
  return member?.nick ?? interaction.user.displayName;
}

export function isGameRunning(channelId: string): boolean {
  return channelId === '';
}

export async function startGame(channel: SendableChannels, guildId: string, launcherName: string, questions: Question[], seconds: number, boxNames: string[], requestedCount: number): Promise<void> {
  await channel.send({ content: `[provisoire] ${launcherName} lance ${questions.length}/${requestedCount} questions (${boxNames.join(', ')}), ${seconds} s, serveur ${guildId}`, allowedMentions: { parse: [] } });
}
```

La tâche 8 remplace entièrement ce fichier.

- [ ] **Étape 1 : créer le `game.ts` provisoire ci-dessus.**

- [ ] **Étape 2 : `bot/src/setup.ts`**

```ts
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  type ButtonInteraction, type ChatInputCommandInteraction, type StringSelectMenuInteraction,
} from 'discord.js';
import { applyPageSelection, listRootBoxes, pageCount, pageOf, pickQuestions, type Catalog, type RootBox } from './catalog';
import { DEFAULT_QUESTION_COUNT, DEFAULT_SECONDS } from './commands';
import { loadCatalog } from './db';
import { displayName, isGameRunning, startGame } from './game';

const SETUP_TTL_MS = 5 * 60_000;
const HISTORY_SIZE = 500;

export const REQUIRED_PERMISSIONS = [
  { flag: PermissionFlagsBits.ViewChannel, label: 'Voir le salon' },
  { flag: PermissionFlagsBits.SendMessages, label: 'Envoyer des messages' },
  { flag: PermissionFlagsBits.EmbedLinks, label: 'Intégrer des liens' },
];

type SetupSession = {
  id: string;
  interaction: ChatInputCommandInteraction;
  catalog: Catalog;
  roots: RootBox[];
  selected: Set<number>;
  page: number;
  questionCount: number;
  seconds: number;
  expiry: NodeJS.Timeout;
};

const sessions = new Map<string, SetupSession>();
// ponytail: historique anti-répétition en mémoire, perdu au redémarrage (spec §4). Table Turso si ça gêne.
const guildHistory = new Map<string, string[]>();

export function missingPermissions(interaction: ChatInputCommandInteraction | ButtonInteraction): string[] {
  return REQUIRED_PERMISSIONS.filter(p => !interaction.appPermissions.has(p.flag)).map(p => p.label);
}

function render(session: SetupSession) {
  const pages = pageCount(session.roots.length);
  const indexes = pageOf(session.page, session.roots.length);
  const chosen = [...session.selected].map(i => session.roots[i]);
  const available = chosen.reduce((sum, root) => sum + root.questionCount, 0);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`setup:${session.id}:select`)
    .setPlaceholder('Choisis une ou plusieurs boîtes')
    .setMinValues(0)
    .setMaxValues(indexes.length)
    .addOptions(indexes.map(i => new StringSelectMenuOptionBuilder()
      .setLabel(session.roots[i].name.slice(0, 100))
      .setValue(String(i))
      .setDescription(`${session.roots[i].questionCount} questions${session.roots[i].ordered ? ' (ordonnée)' : ''}`)
      .setDefault(session.selected.has(i))));

  const buttons = new ActionRowBuilder<ButtonBuilder>();
  if (pages > 1) {
    buttons.addComponents(
      new ButtonBuilder().setCustomId(`setup:${session.id}:prev`).setLabel('Précédent').setStyle(ButtonStyle.Secondary).setDisabled(session.page === 0),
      new ButtonBuilder().setCustomId(`setup:${session.id}:next`).setLabel('Suivant').setStyle(ButtonStyle.Secondary).setDisabled(session.page === pages - 1),
    );
  }
  buttons.addComponents(
    new ButtonBuilder().setCustomId(`setup:${session.id}:launch`).setLabel('Lancer').setStyle(ButtonStyle.Success).setDisabled(chosen.length === 0),
    new ButtonBuilder().setCustomId(`setup:${session.id}:cancel`).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
  );

  const selection = chosen.length === 0
    ? 'Aucune boîte sélectionnée'
    : `Sélection : ${chosen.map(root => root.name).join(', ')} · ${available} questions disponibles`;

  return {
    content: [
      `**Configurer le quiz** · ${session.questionCount} questions · ${session.seconds} s par question`,
      selection,
      pages > 1 ? `Page ${session.page + 1}/${pages}` : '',
    ].filter(Boolean).join('\n'),
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select), buttons],
  };
}

export async function openSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  const missing = missingPermissions(interaction);
  if (missing.length > 0) {
    await interaction.reply({ content: `Il me manque des droits dans ce salon : ${missing.join(', ')}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (isGameRunning(interaction.channelId)) {
    await interaction.reply({ content: 'Un quiz est déjà en cours ici (/stop pour l\'arrêter).', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const catalog = await loadCatalog().catch((error: Error) => {
    console.error('Lecture du catalogue :', error);
    return undefined;
  });
  if (!catalog) {
    await interaction.editReply('Questions indisponibles, réessaie dans un instant.');
    return;
  }
  const roots = listRootBoxes(catalog);
  if (roots.length === 0) {
    await interaction.editReply('Aucune boîte disponible.');
    return;
  }

  const id = interaction.id;
  const session: SetupSession = {
    id,
    interaction,
    catalog,
    roots,
    selected: new Set(),
    page: 0,
    questionCount: interaction.options.getInteger('questions') ?? DEFAULT_QUESTION_COUNT,
    seconds: interaction.options.getInteger('temps') ?? DEFAULT_SECONDS,
    expiry: setTimeout(() => {
      sessions.delete(id);
      interaction.editReply({ content: 'Configuration expirée.', components: [] }).catch(() => {});
    }, SETUP_TTL_MS),
  };
  sessions.set(id, session);
  await interaction.editReply(render(session));
}

async function launch(interaction: ButtonInteraction, session: SetupSession): Promise<void> {
  const channel = interaction.channel;
  if (!interaction.guildId || !channel?.isSendable()) {
    await interaction.update({ content: 'Ce salon ne permet pas de lancer un quiz.', components: [] });
    return;
  }
  if (isGameRunning(interaction.channelId)) {
    await interaction.update({ content: 'Un quiz est déjà en cours ici (/stop pour l\'arrêter).', components: [] });
    return;
  }
  const missing = missingPermissions(interaction);
  if (missing.length > 0) {
    await interaction.update({ content: `Il me manque des droits dans ce salon : ${missing.join(', ')}.`, components: [] });
    return;
  }

  const roots = [...session.selected].map(i => session.roots[i]);
  const recent = guildHistory.get(interaction.guildId) ?? [];
  const questions = pickQuestions(session.catalog, roots, session.questionCount, recent);
  guildHistory.set(interaction.guildId, [...questions.map(q => q.id), ...recent].slice(0, HISTORY_SIZE));

  await interaction.update({ content: 'Quiz lancé.', components: [] });
  await startGame(channel, interaction.guildId, displayName(interaction), questions, session.seconds, roots.map(root => root.name), session.questionCount);
}

export async function handleSetupComponent(interaction: StringSelectMenuInteraction | ButtonInteraction): Promise<void> {
  const [, id, action] = interaction.customId.split(':');
  const session = sessions.get(id);
  if (!session) {
    await interaction.update({ content: 'Configuration expirée.', components: [] });
    return;
  }

  if (interaction.isStringSelectMenu()) {
    session.selected = applyPageSelection(session.selected, session.page, session.roots.length, interaction.values.map(Number));
  } else if (action === 'prev') {
    session.page = Math.max(0, session.page - 1);
  } else if (action === 'next') {
    session.page = Math.min(pageCount(session.roots.length) - 1, session.page + 1);
  } else {
    clearTimeout(session.expiry);
    sessions.delete(id);
    if (action === 'launch') return launch(interaction, session);
    await interaction.update({ content: 'Configuration annulée.', components: [] });
    return;
  }
  await interaction.update(render(session));
}
```

- [ ] **Étape 3 : router dans `index.ts`** — remplacer `handleInteraction` par :

```ts
export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'quiz') return openSetup(interaction);
    if (interaction.commandName === 'boites') return showBoxes(interaction);
    if (interaction.commandName === 'classement') return showLeaderboard(interaction);
    return;
  }
  if ((interaction.isStringSelectMenu() || interaction.isButton()) && interaction.customId.startsWith('setup:')) {
    return handleSetupComponent(interaction);
  }
}
```

et ajouter `import { handleSetupComponent, openSetup } from './setup';`.

- [ ] **Étape 4 : vérifier**

Run : `cd bot && npm run typecheck && npm test` → aucune erreur, 14 tests `pass`.
Run (racine) : `yarn lint 2>&1 | grep "bot/"` → aucune ligne.

Vérification manuelle (`npm run register -- --guild <ID>` puis `npm start`) :
1. `/quiz` → message visible par toi seul, avec le menu et « Lancer » grisé.
2. Choisir 2 boîtes → le résumé affiche leurs noms et la somme des questions, « Lancer » s'active.
3. Avec plus de 25 boîtes : « Suivant », cocher une boîte de la page 2, « Précédent » → la sélection de la page 1 est toujours cochée.
4. « Lancer » → message provisoire `[provisoire] …` dans le salon.
5. `/quiz` puis attendre 5 min → « Configuration expirée. ».
6. Avec un compte sans « Gérer le serveur » : `/quiz` n'apparaît pas dans la liste des commandes.

- [ ] **Étape 5 : point de contrôle** — fichiers : `bot/src/setup.ts`, `bot/src/game.ts` (provisoire), `bot/src/index.ts`.

---

### Task 8 : Déroulé d'une partie dans le salon

**Fichiers :**
- Remplacer : `bot/src/game.ts`
- Créer : `bot/src/game.test.ts`
- Modifier : `bot/src/index.ts` (routage `/stop` et `game:`)

**Interfaces :**
- Consomme : `GameState`, `Player`, `Finder`, `AnswerOutcome`, `QCM_LABELS`, `correctAnswerText` (tâche 5) ; `saveScores` (tâche 6).
- Produit :
  - `displayName(interaction: RepliableInteraction): string` (identique au fichier provisoire)
  - `isGameRunning(channelId: string): boolean`
  - `startGame(channel: SendableChannels, guildId: string, launcherName: string, questions: Question[], seconds: number, boxNames: string[], requestedCount: number): Promise<void>`
  - `stopGame(channelId: string): Promise<boolean>`
  - `stopAllGames(): Promise<void>`
  - `handleGameComponent(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void>`
  - `qcmButtonRows(sessionId: string, questionNumber: number, optionCount: number): ActionRowBuilder<ButtonBuilder>[]`
  - `customId` : `game:<sessionId>:qcm:<questionNumber>:<optionIndex>`, `game:<sessionId>:answer:<questionNumber>`, `game:<sessionId>:modal:<questionNumber>`

- [ ] **Étape 1 : écrire le test qui échoue** — `bot/src/game.test.ts` :

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qcmButtonRows } from './game';

test('QCM à 6 options : 2 rangées (5 + 1), labels A à F', () => {
  const rows = qcmButtonRows('s1', 3, 6);
  assert.deepEqual(rows.map(row => row.components.length), [5, 1]);
  const ids = rows.flatMap(row => row.components.map(button => button.toJSON()));
  assert.deepEqual(ids.map(b => ('label' in b ? b.label : '')), ['A', 'B', 'C', 'D', 'E', 'F']);
});

test('QCM à 4 options : 1 rangée', () => {
  assert.deepEqual(qcmButtonRows('s1', 1, 4).map(row => row.components.length), [4]);
});
```

Run : `cd bot && npm test` → FAIL : `qcmButtonRows` n'existe pas dans le `game.ts` provisoire.

- [ ] **Étape 2 : remplacer `bot/src/game.ts`**

```ts
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, DiscordAPIError, EmbedBuilder, GuildMember, LabelBuilder, MessageFlags,
  ModalBuilder, RESTJSONErrorCodes, TextInputBuilder, TextInputStyle,
  type ButtonInteraction, type Message, type ModalSubmitInteraction, type RepliableInteraction, type SendableChannels,
} from 'discord.js';
import { QuestionType, type Question } from '../../src/types/question';
import { saveScores } from './db';
import { GameState, QCM_LABELS, correctAnswerText, type AnswerOutcome, type Finder } from './game-state';

const COUNTDOWN_MS = 10_000;
const NEXT_QUESTION_DELAY_MS = 5_000;
const COUNTER_REFRESH_MS = 3_000;
const MAX_ANSWER_LENGTH = 300;
const BUTTONS_PER_ROW = 5;
const SHOWN_FINDERS = 10;
const NO_MENTIONS = { parse: [] };

/** Erreurs qui signifient : salon ou message disparu, ou droits retirés. La partie s'arrête. */
const FATAL_CODES = new Set<number | string>([
  RESTJSONErrorCodes.UnknownChannel,
  RESTJSONErrorCodes.UnknownMessage,
  RESTJSONErrorCodes.MissingAccess,
  RESTJSONErrorCodes.MissingPermissions,
]);

const OUTCOME_TEXT = {
  'correct': 'Bonne réponse !',
  'wrong': 'Faux.',
  'already-found': 'Tu as déjà trouvé.',
  'no-more-attempts': 'Tu as déjà répondu à cette question.',
  'closed': 'Cette question est terminée.',
} satisfies Record<AnswerOutcome, string>;

const unix = (ms: number) => Math.floor(ms / 1000);

/** Pseudo sur le serveur, à défaut nom global, à défaut nom d'utilisateur. */
export function displayName(interaction: RepliableInteraction): string {
  const member = interaction.member;
  if (member instanceof GuildMember) return member.displayName;
  return member?.nick ?? interaction.user.displayName;
}

export function qcmButtonRows(sessionId: string, questionNumber: number, optionCount: number): ActionRowBuilder<ButtonBuilder>[] {
  const buttons = QCM_LABELS.slice(0, optionCount).map((label, i) =>
    new ButtonBuilder().setCustomId(`game:${sessionId}:qcm:${questionNumber}:${i}`).setLabel(label).setStyle(ButtonStyle.Primary));
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += BUTTONS_PER_ROW) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + BUTTONS_PER_ROW)));
  }
  return rows;
}

function answerRows(sessionId: string, questionNumber: number, question: Question): ActionRowBuilder<ButtonBuilder>[] {
  if (question.questionType === QuestionType.QCM) return qcmButtonRows(sessionId, questionNumber, question.qcmOptions?.length ?? 0);
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`game:${sessionId}:answer:${questionNumber}`).setLabel('Répondre').setStyle(ButtonStyle.Primary))];
}

function finderLine(finder: Finder): string {
  const bonuses = [finder.isFirst ? 'FIRST' : '', finder.isCombo ? 'combo' : ''].filter(Boolean);
  return `${finder.name} +${finder.points}${bonuses.length ? ` (${bonuses.join(', ')})` : ''}`;
}

class Game {
  readonly sessionId = `discord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  readonly state: GameState;
  private message: Message | undefined;
  private embed: EmbedBuilder | undefined;
  private timer: NodeJS.Timeout | undefined;
  private counter: NodeJS.Timeout | undefined;
  private shownFinders = 0;
  private finished = false;

  constructor(
    private readonly channel: SendableChannels,
    private readonly guildId: string,
    private readonly seconds: number,
    private readonly boxNames: string[],
    questions: Question[],
  ) {
    this.state = new GameState(questions);
  }

  async start(launcherName: string, requestedCount: number): Promise<void> {
    const total = this.state.questions.length;
    const shortage = total < requestedCount ? ` (seulement ${total} disponibles)` : '';
    await this.send(`Quiz lancé par ${launcherName} · ${this.boxNames.join(', ')} · ${total} questions${shortage} · début <t:${unix(Date.now() + COUNTDOWN_MS)}:R>`);
    this.timer = setTimeout(() => this.run(() => this.nextQuestion()), COUNTDOWN_MS);
  }

  private async nextQuestion(): Promise<void> {
    const question = this.state.startNextQuestion(Date.now());
    if (!question) return this.finish('Quiz terminé');

    const number = this.state.questionNumber;
    const options = question.questionType === QuestionType.QCM
      ? `\n\n${(question.qcmOptions ?? []).map((option, i) => `**${QCM_LABELS[i]}.** ${option}`).join('\n')}`
      : '';
    this.embed = new EmbedBuilder()
      .setTitle(`Question ${number}/${this.state.questions.length} · ${question.boxName}`)
      .setDescription(`${question.question}${options}\n\nFin <t:${unix(Date.now() + this.seconds * 1000)}:R>`)
      .setFooter({ text: '0 joueur a trouvé' });
    if (question.imageUrl) this.embed.setImage(question.imageUrl);

    this.shownFinders = 0;
    this.message = await this.channel.send({ embeds: [this.embed], components: answerRows(this.sessionId, number, question), allowedMentions: NO_MENTIONS });
    this.counter = setInterval(() => this.run(() => this.refreshCounter()), COUNTER_REFRESH_MS);
    this.timer = setTimeout(() => this.run(() => this.revealQuestion()), this.seconds * 1000);
  }

  private async refreshCounter(): Promise<void> {
    const count = this.state.finderCount;
    if (!this.message || !this.embed || count === this.shownFinders) return;
    this.shownFinders = count;
    this.embed.setFooter({ text: `${count} joueur${count > 1 ? 's ont' : ' a'} trouvé` });
    await this.message.edit({ embeds: [this.embed] });
  }

  private async revealQuestion(): Promise<void> {
    clearInterval(this.counter);
    const question = this.state.current;
    const finders = this.state.reveal();
    if (!question || !this.message) return;

    const shown = finders.slice(0, SHOWN_FINDERS).map(finderLine).join('\n');
    const more = finders.length > SHOWN_FINDERS ? `\n… et ${finders.length - SHOWN_FINDERS} autres` : '';
    const revealed = new EmbedBuilder()
      .setTitle(`Question ${this.state.questionNumber}/${this.state.questions.length} · ${question.boxName}`)
      .setDescription(`${question.question}\n\nRéponse : **${correctAnswerText(question)}**\n\n${shown ? shown + more : 'Personne n\'a trouvé.'}`);
    const image = question.answerImageUrl ?? question.imageUrl;
    if (image) revealed.setImage(image);

    await this.message.edit({ embeds: [revealed], components: [], allowedMentions: NO_MENTIONS });
    this.timer = setTimeout(() => this.run(() => this.nextQuestion()), NEXT_QUESTION_DELAY_MS);
  }

  /** Arrêt normal, /stop ou arrêt du bot : podium (si possible) puis enregistrement des scores. */
  async finish(title: string, postPodium = true): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    clearTimeout(this.timer);
    clearInterval(this.counter);
    games.delete(this.channel.id);

    const ranking = this.state.ranking();
    if (postPodium) {
      const lines = ranking.slice(0, SHOWN_FINDERS).map((player, i) =>
        i < 3 ? `**${i + 1}. ${player.name} : ${player.score} pts**` : `${i + 1}. ${player.name} : ${player.score} pts`);
      await this.send(`**${title}**\n${lines.join('\n') || 'Personne n\'a marqué de point.'}`).catch(() => {});
    }
    await saveScores(this.guildId, this.channel.id, this.sessionId, this.boxNames, ranking)
      .catch((error: Error) => console.error(`Scores non enregistrés (${this.sessionId}) :`, error));
  }

  async answer(interaction: ButtonInteraction | ModalSubmitInteraction, kind: string, questionNumber: number, optionIndex: number): Promise<void> {
    if (kind === 'answer') {
      if (questionNumber !== this.state.questionNumber || !this.state.isOpen) {
        await interaction.reply({ content: OUTCOME_TEXT.closed, flags: MessageFlags.Ephemeral });
        return;
      }
      if (this.state.hasFound(interaction.user.id)) {
        await interaction.reply({ content: OUTCOME_TEXT['already-found'], flags: MessageFlags.Ephemeral });
        return;
      }
      if (!interaction.isButton()) return;
      await interaction.showModal(new ModalBuilder()
        .setCustomId(`game:${this.sessionId}:modal:${questionNumber}`)
        .setTitle(`Question ${questionNumber}`)
        .addLabelComponents(new LabelBuilder()
          .setLabel('Ta réponse')
          .setTextInputComponent(new TextInputBuilder().setCustomId('answer').setStyle(TextInputStyle.Short).setMaxLength(MAX_ANSWER_LENGTH))));
      return;
    }

    const text = interaction.isModalSubmit() ? interaction.fields.getTextInputValue('answer') : QCM_LABELS[optionIndex];
    const outcome = this.state.submit(questionNumber, interaction.user.id, displayName(interaction), text, Date.now());
    await interaction.reply({ content: OUTCOME_TEXT[outcome], flags: MessageFlags.Ephemeral });
  }

  private send(content: string): Promise<Message> {
    return this.channel.send({ content, allowedMentions: NO_MENTIONS });
  }

  /** Exécute une étape planifiée. Salon ou message disparu : la partie s'arrête sans planter le process. */
  private run(step: () => Promise<void>): void {
    step().catch((error: Error) => {
      const fatal = error instanceof DiscordAPIError && FATAL_CODES.has(error.code);
      console.error(`Partie ${this.sessionId}${fatal ? ' arrêtée' : ''} :`, error);
      if (fatal) this.finish('Quiz arrêté', false);
    });
  }
}

const games = new Map<string, Game>();

export function isGameRunning(channelId: string): boolean {
  return games.has(channelId);
}

export async function startGame(channel: SendableChannels, guildId: string, launcherName: string, questions: Question[], seconds: number, boxNames: string[], requestedCount: number): Promise<void> {
  const game = new Game(channel, guildId, seconds, boxNames, questions);
  games.set(channel.id, game);
  await game.start(launcherName, requestedCount).catch((error: Error) => {
    games.delete(channel.id);
    throw error;
  });
}

export async function stopGame(channelId: string): Promise<boolean> {
  const game = games.get(channelId);
  if (!game) return false;
  await game.finish('Quiz arrêté');
  return true;
}

export async function stopAllGames(): Promise<void> {
  await Promise.all([...games.values()].map(game => game.finish('Quiz arrêté (redémarrage du bot)')));
}

export async function handleGameComponent(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  const [, sessionId, kind, questionNumber, optionIndex] = interaction.customId.split(':');
  const game = interaction.channelId ? games.get(interaction.channelId) : undefined;
  if (!game || game.sessionId !== sessionId) {
    await interaction.reply({ content: OUTCOME_TEXT.closed, flags: MessageFlags.Ephemeral });
    return;
  }
  await game.answer(interaction, kind, Number(questionNumber), Number(optionIndex ?? 0));
}
```

- [ ] **Étape 3 : router dans `index.ts`** — ajouter `import { handleGameComponent, stopGame } from './game';`, la fonction :

```ts
async function stop(interaction: ChatInputCommandInteraction): Promise<void> {
  const stopped = await stopGame(interaction.channelId);
  await interaction.reply({ content: stopped ? 'Quiz arrêté.' : 'Aucun quiz en cours dans ce salon.', flags: MessageFlags.Ephemeral });
}
```

et compléter `handleInteraction` :

```ts
export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'quiz') return openSetup(interaction);
    if (interaction.commandName === 'stop') return stop(interaction);
    if (interaction.commandName === 'boites') return showBoxes(interaction);
    if (interaction.commandName === 'classement') return showLeaderboard(interaction);
    return;
  }
  if ((interaction.isStringSelectMenu() || interaction.isButton()) && interaction.customId.startsWith('setup:')) {
    return handleSetupComponent(interaction);
  }
  if ((interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith('game:')) {
    return handleGameComponent(interaction);
  }
}
```

- [ ] **Étape 4 : vérifier**

Run : `cd bot && npm test` → 16 tests `pass`.
Run : `cd bot && npm run typecheck` → aucune sortie.
Run (racine) : `yarn lint 2>&1 | grep "bot/"` → aucune ligne. `OUTCOME_TEXT` utilise `satisfies Record<AnswerOutcome, string>` : chaque issue a son texte, sans élargir le type. Si le lint signale quand même quelque chose, corriger le code au lieu de désactiver la règle.

- [ ] **Étape 5 : point de contrôle** — fichiers : `bot/src/game.ts`, `bot/src/game.test.ts`, `bot/src/index.ts`.

---

### Task 9 : Cycle de vie, déploiement et recette

**Fichiers :**
- Modifier : `bot/src/index.ts` (fin du fichier)
- Créer : `bot/README.md`
- Modifier : `CLAUDE.md` (Roadmap → Bot Discord)

**Interfaces :**
- Consomme : `deleteGuildScores` (tâche 6), `stopAllGames` (tâche 8).

- [ ] **Étape 1 : cycle de vie dans `index.ts`** — ajouter `import { deleteGuildScores, ensureSchema, leaderboard, loadCatalog } from './db';` (`deleteGuildScores` en plus) et `stopAllGames` dans l'import de `./game`, puis, avant `await ensureSchema();` :

```ts
// Bot retiré d'un serveur : ses scores sont supprimés (politique développeur Discord).
client.on(Events.GuildDelete, guild => {
  deleteGuildScores(guild.id).catch((error: Error) => console.error(`Suppression des scores de ${guild.id} :`, error));
});

process.on('unhandledRejection', error => console.error('Promesse rejetée non gérée :', error));

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} reçu : arrêt des parties en cours.`);
  await stopAllGames();
  await client.destroy();
  process.exit(0);
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
```

- [ ] **Étape 2 : `bot/README.md`**

````markdown
# Bot Discord TrivialPurTwitch

Quiz TrivialPurTwitch jouables dans Discord. Spec : `docs/superpowers/specs/2026-10-12-discord-bot-design.md`.

## Installation sur le serveur

1. Discord Developer Portal > New Application > onglet Bot : copier le token. Ne cocher aucun « Privileged Gateway Intent ».
2. Lien d'invitation (OAuth2 > URL Generator) : scopes `bot` et `applications.commands`, permissions View Channels, Send Messages, Embed Links.
3. Token Turso dédié : `turso db tokens create <nom-de-la-db>`.
4. Sur le serveur :

   ```bash
   git pull
   cd bot
   npm ci
   cp .env.example .env   # puis remplir les 4 variables
   npm run register       # commandes globales : jusqu'à ~1 h pour apparaître
   pm2 start npm --name trivial-bot -- start
   pm2 save
   pm2 startup            # suivre la commande affichée
   ```

## Mise à jour

```bash
git pull && cd bot && npm ci && pm2 restart trivial-bot
```

Relancer `npm run register` seulement si `src/commands.ts` a changé.

## Développement

- `npm run register -- --guild <id>` : commandes sur un serveur de test, immédiat.
- `npm start` : lance le bot avec `bot/.env`.
- `npm test` / `npm run typecheck`.
````

- [ ] **Étape 3 : mettre à jour la roadmap dans `CLAUDE.md`** — remplacer le bloc « Bot Discord » de la Roadmap active par :

```markdown
* **Bot Discord** (livré) — dossier `bot/` (voir `bot/README.md`, spec `docs/superpowers/specs/2026-10-12-discord-bot-design.md`). Multi-serveurs, aucun intent privilégié : réponses par boutons (QCM) et fenêtre (texte libre), toutes privées. Classement par serveur dans `discord_scores` (jamais d'ID Discord dans `scores`). Code partagé avec le site : `src/types/question.ts`, `services/answer-validator.ts`, `services/scoring.ts`, `services/quiz-picker.ts` — garder ces modules purs (pas de React/zustand/localStorage, imports relatifs). Hébergé sur le serveur du propriétaire via pm2.
```

- [ ] **Étape 4 : vérifications automatiques**

Run : `cd bot && npm test && npm run typecheck` → 16 tests `pass`, aucune erreur.
Run (racine) : `CI=true yarn test --watchAll=false` → tous verts.
Run (racine) : `npx tsc -p tsconfig.json --noEmit` → aucune sortie.
Run (racine) : `yarn lint 2>&1 | grep -E "bot/|src/services/(scoring|quiz-picker)|src/types/"` → aucune ligne.

- [ ] **Étape 5 : recette manuelle sur le serveur de test** (`npm run register -- --guild <ID>`, `npm start`) :
  1. `/quiz questions:3 temps:15`, une boîte, Lancer → annonce avec « début dans 10 secondes », puis question 1 après 10 s.
  2. Texte libre : « Répondre » → fenêtre ; mauvaise réponse → « Faux. » ; bonne → « Bonne réponse ! » ; nouveau clic → « Tu as déjà trouvé. ».
  3. Compteur en bas de la question mis à jour après une bonne réponse (en 3 s au plus).
  4. QCM à 6 options (s'il y en a une) : 2 rangées de boutons ; second clic → « Tu as déjà répondu à cette question. ».
  5. Ouvrir la fenêtre, attendre la révélation, envoyer → « Cette question est terminée. », aucun point.
  6. Révélation : bonne réponse, liste des trouveurs avec points et bonus, boutons retirés, aucune notification reçue.
  7. Fin : podium, puis `/classement` affiche les points.
  8. Deux `/quiz` ouverts en parallèle, lancer le premier puis le second → le second répond « Un quiz est déjà en cours ici ».
  9. `/stop` pendant une partie → « Quiz arrêté » + podium, et `/classement` inclut les points gagnés.
  10. Supprimer le message de la question en cours → le bot logue « arrêtée », le process continue, `/quiz` fonctionne de nouveau dans le salon.
  11. `Ctrl+C` pendant une partie → « Quiz arrêté (redémarrage du bot) » dans le salon, le process se termine.
  12. Retirer le bot du serveur de test, puis le réinviter → `/classement` est vide.

- [ ] **Étape 6 : point de contrôle** — fichiers : `bot/src/index.ts`, `bot/README.md`, `CLAUDE.md`. Ensuite, déploiement sur le serveur de production en suivant `bot/README.md`, et enregistrement global des commandes.
