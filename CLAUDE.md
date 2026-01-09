# TrivialPurTwitch

## 🌍 Vue d'ensemble

TrivialPurTwitch est une **application web React (client-side)** destinée aux streamers Twitch pour animer des quiz de type *Trivial Pursuit* directement depuis leur navigateur.

Ce n’est **pas un bot backend** : toute la logique s’exécute côté client. L’application se connecte au chat Twitch via WebSocket et persiste les données localement.

---

## 🏗 Architecture Technique

* **Type** : Single Page Application (SPA)
* **Hébergement** : GitHub Pages (statique)
* **Persistence** : `localStorage` (Zustand Persist)
* **Source distante** : GitHub Raw (questions officielles)
* **Connexion Twitch** : `tmi.js` côté navigateur

---

## 📁 Structure des dossiers

```text
src/
├── components/
│   ├── store/
│   │   ├── quiz-store-v2.ts     # Cœur logique : questions, moteur de jeu, persistence
│   │   └── global-store.ts      # État UI global (menus, titres, modales)
│   ├── question-manager-v2.tsx # Interface admin (CRUD, import/export)
│   ├── quiz.tsx                # Interface de jeu (questions, timer)
│   └── ...
├── services/
│   ├── twitch-api.ts           # Appels API Twitch (token, user info)
│   └── github-data-service.ts  # Sync questions officielles (GitHub Raw)
├── data/                       # Données statiques
└── App.tsx                     # Routing & layout global
```

---

## ⚙️ Workflow de développement

### Commandes principales

* **Développement** : `yarn start` (port 3000)
* **Build production** : `yarn build`
* **Déploiement** : `yarn deploy` (branche `gh-pages`)
* **Tests** : `yarn test`

---

## 🔄 Gestion des données

### Flux des questions

1. **Source officielle**
   Stockées dans `public/questions/questions.json` sur le dépôt GitHub.

2. **Chargement**
   Fetch via `raw.githubusercontent.com` (avec fallback vers build local).

   **Stratégie de chargement :**
   * **Priorité 1** : GitHub Raw (`https://raw.githubusercontent.com/...`)
     → Permet les mises à jour sans redéploiement
   * **Fallback** : Build local (`public/questions/questions.json`)
     → Si GitHub est inaccessible

   **Fréquence de synchronisation :**
   * Au démarrage de l'application
   * Toutes les **1 heure** en arrière-plan
   * Manuellement via le bouton "Sync GitHub" (gestionnaire de questions)

3. **Fusion intelligente**
   Le store `quiz-store-v2` fusionne :

   * **Questions GitHub** (distantes) : toujours synchronisées
     - Ajouts : nouvelles questions ajoutées
     - Modifications : questions mises à jour
     - Suppressions : questions retirées sont supprimées

   * **Questions locales** (custom) : **préservées à jamais**
     - Créées manuellement dans l'interface
     - Importées via fichier JSON
     - Identifiées par ID différent de GitHub

   Les doublons sont évités par comparaison des `id` :
   ```typescript
   // Questions locales = celles dont l'ID n'existe PAS dans GitHub
   const localOnlyQuestions = localQuestions.filter(q => !githubIds.has(q.id));
   return [...githubQuestions, ...localOnlyQuestions];
   ```

4. **Persistence**
   Toutes les données sont sauvegardées dans :

   ```text
   localStorage → quiz_questions_storage_v2
   localStorage → quiz_last_github_sync (timestamp)
   ```

---

## 💻 Stack technologique

* **Framework** : React 18 (CRA)
* **Langage** : TypeScript
* **State management** : Zustand (+ persist middleware)
* **UI** : React-Bootstrap + SCSS
* **Twitch** :

  * `tmi.js` (chat)
  * `axios` (API Helix)
* **Routing** : React Router DOM v6

---

## 🧠 Guidelines de code

### State & Store (Zustand)

* Ne jamais muter l’état directement

* Toujours utiliser :

  ```ts
  set((state) => ({ ... }))
  ```

* En cas de modification de structure (Question, TrivialBox, etc.) :

  * Incrémenter la version du store (`v2` → `v3`)
  * Ajouter une fonction de migration (`migrateFromV2`)

---

### React & effets de bord

* **tmi.js** :

  * L’instance Twitch doit être gérée via `useEffect` ou un Context/Store
  * Interdiction de reconnecter à chaque render

* **Performance** :

  * Le `questions[]` peut devenir volumineux
  * Au-delà de ~1000 items : pagination ou virtualisation obligatoire dans le manager

---

## 🚀 Déploiement

* Déploiement automatisé via `gh-pages`
* Le dossier `/build` est publié tel quel

⚠️ Le fichier `.env` contient un `CLIENT_ID` **public** (normal pour une SPA).
Ne jamais y mettre de `CLIENT_SECRET`.

### Workflow de mise à jour

#### **Modification des questions uniquement**

Si vous modifiez uniquement `public/questions/questions.json` :

```bash
git add public/questions/questions.json
git commit -m "Update questions"
git push
```

✅ **Pas besoin de `yarn deploy` !**
Les utilisateurs recevront la mise à jour automatiquement via GitHub Raw (max 1h).

#### **Modification du code (React, CSS, etc.)**

Si vous modifiez le code source de l'application :

```bash
git add .
git commit -m "Fix bug xyz"
git push

yarn build
yarn deploy  # Déploie sur GitHub Pages
```

⚠️ **Nécessaire** car le code React doit être compilé et déployé.

### Forcer une synchronisation immédiate

Pour tester immédiatement après avoir modifié les questions :

1. Ouvrir la console du navigateur (F12)
2. Exécuter : `localStorage.removeItem('quiz_last_github_sync')`
3. Recharger la page

Ou cliquer sur le bouton "Sync GitHub" dans le gestionnaire de questions.

---

## 🔧 Détails techniques de la synchronisation

### Architecture du système de sync

```
┌─────────────────────────────────────────────────────┐
│                   App.tsx (useEffect)               │
│  • Sync au démarrage (si > 1h)                      │
│  • setInterval toutes les heures                    │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│         services/github-data-service.ts             │
│  loadQuestionsFromGitHub()                          │
│    1. Try: GitHub Raw                               │
│    2. Fallback: Build local                         │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│         services/github-data-service.ts             │
│  mergeQuestionsFromGitHub()                         │
│    • Garde toutes les questions GitHub              │
│    • Préserve les questions locales uniquement      │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│         store/quiz-store-v2.ts                      │
│  loadFromGitHub()                                   │
│    • Appelle les services                           │
│    • Met à jour le state                            │
│    • Backup dans localStorage                       │
└─────────────────────────────────────────────────────┘
```

### Fichiers impliqués

* **[src/app.tsx](src/app.tsx#L44-L74)** : Orchestration de la sync auto
* **[src/services/github-data-service.ts](src/services/github-data-service.ts)** : Fetch et fusion
* **[src/components/store/quiz-store-v2.ts](src/components/store/quiz-store-v2.ts#L492-L528)** : Action `loadFromGitHub()`
* **[src/components/question-manager-v2.tsx](src/components/question-manager-v2.tsx#L126-L142)** : Bouton manuel

### Cache-busting

Toutes les requêtes incluent un timestamp pour éviter le cache navigateur :

```typescript
fetch(`${url}?t=${Date.now()}`)
```

### Gestion des erreurs

* GitHub Raw inaccessible → Fallback vers build local
* Build local inaccessible → `syncStatus = 'error'`
* L'application reste fonctionnelle avec les questions en cache

---

## 🛣 Roadmap / évolutions prévues

* **Split du store**
  Séparer :

  * `questions-data` (base de données)
  * `game-engine` (session de jeu)

* **IndexedDB**
  Remplacer `localStorage` pour supporter de grosses bases de questions

* **Mode Streamer sécurisé**
  Option pour masquer les réponses dans l’interface Admin

---

## ❓ FAQ - Questions fréquentes

### Q1 : Que se passe-t-il si je supprime des questions de GitHub ?

**R :** Les questions supprimées seront automatiquement retirées lors de la prochaine synchronisation (max 1h). Les questions locales créées par les utilisateurs ne seront jamais supprimées.

### Q2 : Les viewers doivent-ils mettre à jour quelque chose ?

**R :** Non. Les viewers jouent uniquement via le chat Twitch. Seul le streamer (qui ouvre l'app dans son navigateur) reçoit les mises à jour.

### Q3 : Comment différencier une question GitHub d'une question locale ?

**R :** Par l'ID :
* Questions GitHub : IDs générés lors de leur création dans `questions.json`
* Questions locales : IDs différents, générés lors de l'import/création manuelle

La fonction de fusion compare les IDs pour préserver les questions locales.

### Q4 : Combien de temps avant qu'un streamer reçoive ma mise à jour ?

**R :** Maximum 1 heure (sync auto). Il peut forcer immédiatement via le bouton "Sync GitHub".

### Q5 : Si GitHub est down, l'app fonctionne-t-elle encore ?

**R :** Oui. Fallback automatique vers le build local + questions déjà en cache dans `localStorage`.

### Q6 : Puis-je modifier directement le fichier local pour tester ?

**R :** Oui en dev (`yarn start`), mais les modifications ne seront pas déployées tant que vous ne faites pas `yarn build && yarn deploy`.

Pour les tests, mieux vaut :
1. Modifier `questions.json` dans GitHub
2. Commit/push
3. Forcer la sync dans l'app (bouton ou console)

---

## ⚠️ Points Négatifs & Risques (Dette Technique)

### 1. Le "God Store" (quiz-store-v2.ts)

**Problème :** Ce fichier fait tout. Il gère :
* La base de données (CRUD questions)
* La logique métier (générer un quiz)
* L'état UI (quiz actif)
* La synchronisation

**Risque :** Il va devenir impossible à maintenir. Si vous modifiez la logique de sauvegarde, vous risquez de casser le quiz en cours.

**Solution recommandée :**
Séparer en deux stores ou slices :
* `QuestionsStore` : Base de données, CRUD, Sync
* `GameStore` : État de la partie en cours, timer, scores

```typescript
// Exemple de séparation
const useQuestionsStore = create<QuestionsData & QuestionsActions>(...)
const useGameStore = create<GameState & GameActions>(...)
```

### 2. Fragilité des Données (LocalStorage)

**Problème :** Tout repose sur `localStorage`. Si l'utilisateur vide son cache navigateur ou change de navigateur (Chrome → Firefox), il perd tout :
* Questions custom
* Historique
* Scores

**Amélioration :**
Ajouter une fonction **"Exporter/Importer Sauvegarde complète"** (un gros JSON qui dump tout le state) pour permettre à l'utilisateur de migrer ses données.

```typescript
// Fonction à ajouter
exportFullBackup() {
  return {
    questions: state.questions,
    boxes: state.boxes,
    scores: playerStore.getState(),
    settings: settingsStore.getState(),
    version: '2.0',
    exportDate: new Date().toISOString()
  }
}
```

⚠️ **Actuellement** : L'export existe mais exporte seulement les questions, pas les scores ni les settings.

### 3. Sécurité des Tokens (Implicit Flow)

**Contexte :** Puisque tout est côté client, l'application utilise probablement l'Implicit Grant Flow de Twitch (le token est dans l'URL).

**Attention :**
* Assurer que le `access_token` ne traîne jamais dans le `localStorage` de manière non sécurisée
* Ne pas afficher le token en clair lors d'un stream (page de settings visible à l'écran)

**Recommandation :**
* Stocker le token de manière obfusquée ou chiffrée
* Ajouter un avertissement dans l'interface si la page de settings est ouverte pendant un stream

### 4. Performance à l'échelle

**Problème :**
* `localStorage` est **synchrone** et limité (souvent 5MB max)
* Si un utilisateur importe 10 000 questions, l'application va "freezer" au chargement
* Chaque opération CRUD bloque le thread principal

**Amélioration future :**
Passer sur **IndexedDB** (via la lib `idb-keyval` qui s'intègre bien avec Zustand) pour le stockage des questions.

Avantages :
* Asynchrone (pas de freeze)
* Supporte des centaines de méga-octets
* Meilleure performance pour les grosses bases de données

```typescript
// Exemple avec idb-keyval
import { get, set } from 'idb-keyval';

const storage = {
  getItem: async (name) => await get(name),
  setItem: async (name, value) => await set(name, value),
  removeItem: async (name) => await del(name),
}
```

**Seuil critique :** Au-delà de ~1000 questions, envisager sérieusement la migration vers IndexedDB.

### 5. Logique de Jeu dans le Store

**Problème :**
Dans `quiz-store-v2.ts`, la fonction `nextQuestion()` met à jour l'index. C'est bien, mais la logique de "Timer" ou de "Points" semble éparpillée entre le store et les composants.

**Recommandation :**
Le store ne devrait stocker que l'**état**, pas la **logique métier complexe**.

**Solution :**
Extraire la logique de jeu dans un service ou un hook dédié :

```typescript
// hooks/useGameLogic.ts
export const useGameLogic = () => {
  const quizStore = useQuizStore();
  const playerStore = usePlayerStore();

  const calculateScore = (timeElapsed: number) => {
    // Logique de calcul des points
  }

  const handleCorrectAnswer = (player: string) => {
    const score = calculateScore(Date.now() - quizStore.activeQuiz.questionStartTime);
    playerStore.addScore(player, score);
    quizStore.recordAnswer(...);
  }

  return { handleCorrectAnswer, calculateScore };
}
```

Cela rend le code plus testable et maintenable.

---

## 📌 Recommandations stratégiques

### Priorités à court terme

1. **Backup utilisateur complet** 🔴 **CRITIQUE**
   Ajouter un bouton *"Sauvegarder tout"* :
   * Export `.json` complet (questions + scores + settings)
   * Import pour restauration complète
   * Protection contre la perte de données

2. **Monitoring des syncs** 🟡 **IMPORTANT**
   Ajouter un indicateur visuel de la dernière sync réussie dans l'interface.

### Priorités à moyen terme

3. **Refactoring du God Store** 🟡 **IMPORTANT**
   * Séparer `quiz-store-v2.ts` en deux stores
   * Améliore la maintenabilité et réduit les risques de bugs

4. **Migration vers IndexedDB** 🟢 **NICE TO HAVE**
   * Uniquement si la base dépasse ~1000 questions
   * Prévoit une migration en douceur

5. **Sécurité des tokens** 🟡 **IMPORTANT**
   * Audit de la gestion des tokens Twitch
   * Avertissement si settings ouverts pendant stream

### Ce qu'il ne faut PAS faire

❌ **Refactoring massif immédiat** : La version `v2` est suffisamment robuste pour l'usage actuel.

❌ **Optimisation prématurée** : Attendre d'avoir des problèmes de performance réels avant de migrer vers IndexedDB.

❌ **Changer l'architecture sans raison** : Les choix actuels (SPA, localStorage, GitHub Raw) sont adaptés à l'usage.
