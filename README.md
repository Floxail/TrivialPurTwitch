# TrivialPurTwitch

Une application web de **Quiz Trivial Pursuit** pour streamers Twitch, écrite en React et hébergée sur Vercel.

**Application disponible sur :** [trivialpurtwitch.vercel.app](https://trivialpurtwitch.vercel.app)

---

## Description

TrivialPurTwitch permet aux streamers d'animer des quiz de type Trivial Pursuit directement depuis leur navigateur. Les spectateurs répondent en direct dans le **chat Twitch**. Les questions sont organisées en boîtes thématiques et synchronisées automatiquement depuis GitHub.

---

## Fonctionnalités

### Jeu
- **Mode Quiz** — Questions texte libre ou QCM (2 à 6 options)
- **QCM multi-réponses** — Plusieurs réponses correctes possibles (`A,C` / `AC`)
- **Timer configurable** — 15 à 60 secondes par question
- **Tolérance aux fautes** — Détection intelligente des réponses
- **Leaderboard** — Classement session en temps réel + scores persistants all-time

### Questions
- **Synchronisation Turso DB** — Questions officielles mises à jour automatiquement (toutes les heures)
- **Questions locales** — Créez vos propres questions, jamais supprimées par la sync
- **Ajout en masse** — Format texte `Q:/R:/ALT:` + QCM `A:/B:/C:/D:` avec support multi-réponses
- **Import/Export JSON** — Sauvegarde et restauration complète
- **Gestion par boîtes** — Organisez vos questions par thème
- **Mode ordonné** — Jouez les questions d'une boîte dans l'ordre d'insertion (↓ dans l'UI)

### Communauté
- **Proposition de questions** — Les viewers connectés peuvent soumettre des questions via `/contribute`
- **Modération admin** — Dashboard dédié pour approuver/rejeter les questions proposées
- **Signalement** — Bouton drapeau pour signaler une question incorrecte après révélation

### Interface
- **Effet MDR fisheye** — Animation loupe au survol des boîtes sur l'accueil
- **Style terminal Lumon** — Interface inspirée de la série Severance
- **Changelog intégré** — Historique des versions dans l'application

---

## Comment jouer (côté spectateurs)

Les spectateurs répondent directement dans le **chat Twitch** :

| Type de question | Format de réponse |
|---|---|
| Texte libre | Taper la réponse directement |
| QCM réponse unique | `A`, `B`, `C`... ou `1`, `2`, `3`... |
| QCM multi-réponses | `A,C` / `AC` / `A C` / `1,3` |

Pour les QCM multi-réponses, il faut donner **toutes** les bonnes réponses et **aucune** mauvaise.

---

## Format des questions (ajout en masse)

### Texte libre
```
Q: Qui a peint la Joconde ?
R: Léonard de Vinci
ALT: De Vinci, Leonard de Vinci
```

### QCM réponse unique
```
Q: Quelle est la capitale de la France ?
A: Lyon
B: Paris
C: Marseille
D: Bordeaux
R: B
```

### QCM réponses multiples
```
Q: Lesquels sont des langages de programmation ?
A: Python
B: Cobra
C: Java
D: Espresso
R: A,C
```

---

## Déploiement (votre propre instance)

### Prérequis
- Compte [Vercel](https://vercel.com)
- Base de données [Turso](https://turso.tech) (scores, questions serveur, modération)
- Application Twitch sur [dev.twitch.tv](https://dev.twitch.tv/console/apps)

### Variables d'environnement Vercel

```env
REACT_APP_TWITCH_CLIENT_ID=   # Client ID de votre app Twitch (public)
TURSO_DATABASE_URL=            # URL de votre base Turso
TURSO_AUTH_TOKEN=              # Token d'authentification Turso
ADMIN_TWITCH_IDS=              # IDs Twitch des admins (séparés par virgules)
```

### Application Twitch

Créez une application sur [dev.twitch.tv](https://dev.twitch.tv/console/apps/) :
- **Redirect URI :** `https://votre-domaine.vercel.app/callback`
- **Category :** Website Integration

### Commandes

```bash
yarn install      # Installer les dépendances
yarn start        # Développement (port 3000)
yarn build        # Build production
```

Le déploiement sur Vercel est **automatique** à chaque push sur la branche principale.

---

## Architecture

```
src/
├── components/
│   ├── store/          # Zustand stores (questions, game, player, auth, settings)
│   ├── quiz.tsx        # Interface de jeu principale
│   ├── leaderboard.tsx # Classement session + all-time
│   ├── contribution-page.tsx  # Soumission de questions (communauté)
│   ├── admin-dashboard.tsx    # Modération des questions proposées
│   └── ...
├── services/
│   ├── github-data-service.ts # Sync questions depuis Turso DB (+ fallback build local)
│   ├── api-scores-service.ts  # Scores persistants
│   ├── api-reports-service.ts # Signalement de questions
│   └── ...
api/
├── questions.ts        # CRUD questions
├── scores.ts           # Scores persistants (Turso)
├── reports.ts          # Signalements de questions
├── submit-question.ts  # Soumission communauté
└── admin/
    └── questions-review.ts  # Modération admin
```

---

## Stack technique

| | |
|---|---|
| **Frontend** | React 18 + TypeScript |
| **State** | Zustand + persist middleware |
| **UI** | React-Bootstrap + SCSS + Framer Motion |
| **Hébergement** | Vercel (frontend + serverless functions) |
| **Base de données** | Turso (LibSQL) |
| **Chat Twitch** | tmi.js |
| **Auth** | OAuth PKCE (Twitch) |

---

## Catégories

| # | Catégorie | Couleur |
|---|-----------|---------|
| 0 | Géographie | Bleu |
| 1 | Divertissement | Rose |
| 2 | Histoire | Jaune |
| 3 | Arts & Littérature | Marron |
| 4 | Sciences & Nature | Vert |
| 5 | Sports & Loisirs | Orange |

---

## Crédits

Projet basé sur [BlindTesTwitch](https://github.com/s-vivien/BlindTesTwitch) par **neumann__**.

---

## Licence

GPL-3.0

---

## Support

- **Discord :** floxail
- **GitHub Issues :** [Créer une issue](https://github.com/Floxail/TrivialPurTwitch/issues)
