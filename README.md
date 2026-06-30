# TrivialPurTwitch

Application web **Quiz Trivial Pursuit** pour streamers Twitch — React, hébergée sur Vercel.

**→ [trivial.floxail.fr](https://trivial.floxail.fr)**

---

## Description

TrivialPurTwitch permet aux streamers d'animer des quiz en direct. Les spectateurs répondent dans le **chat Twitch**. Les questions sont organisées en boîtes thématiques et synchronisées automatiquement depuis une base Turso partagée.

Architecture : 1 seule instance Vercel + 1 seule Turso DB — tous les streamers partagent la même base de questions.

---

## Fonctionnalités

### Jeu
- **Mode Quiz** — texte libre ou QCM (2 à 6 options)
- **QCM multi-réponses** — plusieurs bonnes réponses (`A,C` / `AC`)
- **Timer configurable** — 10 à 60 secondes par question
- **Timer illimité** — révélation manuelle via bouton RÉVÉLER
- **Tolérance orthographique** — Sorensen-Dice + sous-chaînes (désactivable)
- **Images** — image pendant la question et/ou à la révélation (URLs externes)

### Scoring
- **Base** : +1 point par bonne réponse
- **First** : +2 si premier à répondre (fenêtre de clémence configurable)
- **Solo** : +1 si seul à avoir trouvé
- **Combo** : +1/+2/+3 selon la série en cours (max +3)
- **Pénalité** : -1 par mauvaise réponse (appliquée à la révélation, pas en direct)

### Questions & Boîtes
- **Sync automatique** — toutes les 2 minutes depuis Turso DB (silencieux)
- **Questions locales** — créées localement, jamais supprimées par la sync
- **Boîtes thématiques** — Master Box + sous-boîtes, mode ordonné (↓)
- **Tirage intelligent** — RNG crypto-grade, anti-répétition sur 500 questions, échantillonnage stratifié multi-boîtes
- **Ajout en masse** — format `Q:/R:/ALT:/A:/B:...` (texte libre + QCM mixés)
- **Import/Export JSON**

### Communauté & Admin
- **Proposition de questions** — `/contribute` (connectés Twitch)
- **Modération** — `/system-mod-portal` (admin) — approuver / modifier / rejeter
- **Signalement** — bouton drapeau après révélation (4 raisons prédéfinies)
- **Stats** — `/stats` global + `/stats/:username` par joueur (partageable)

---

## Comment jouer (spectateurs)

Répondre directement dans le **chat Twitch** :

| Type | Format |
|------|--------|
| Texte libre | Taper la réponse |
| QCM unique | `A` `B` `C`... ou `1` `2` `3`... |
| QCM multi | `A,C` / `AC` / `A C` / `1,3` |

Multi-réponses : toutes les bonnes réponses requises, aucune mauvaise.

---

## Format d'import en masse

```
Q: Qui a peint la Joconde ?
R: Léonard de Vinci
ALT: De Vinci, Leonard de Vinci

Q: Quelle est la capitale de la France ?
A: Lyon
B: Paris
C: Marseille
D: Bordeaux
R: B

Q: Lesquels sont des langages de programmation ?
A: Python
B: Cobra
C: Java
D: Espresso
R: A,C
```

Séparer chaque question par une ligne vide. Types libres et QCM peuvent être mélangés.

---

## Déploiement

### Prérequis
- Compte [Vercel](https://vercel.com)
- Base [Turso](https://turso.tech)
- App Twitch sur [dev.twitch.tv](https://dev.twitch.tv/console/apps) — Redirect URI : `https://votre-domaine/callback`

### Variables d'environnement Vercel

```env
REACT_APP_TWITCH_CLIENT_ID=   # Client ID app Twitch (public)
TURSO_DATABASE_URL=            # URL Turso
TURSO_AUTH_TOKEN=              # Token Turso
ADMIN_TWITCH_IDS=              # IDs Twitch admins (virgules)
```

### Commandes

```bash
yarn install
yarn start    # dev port 3000
yarn build    # prod
```

Push sur `master` → déploiement Vercel automatique.

---

## Stack technique

| | |
|---|---|
| **Frontend** | React 18 + TypeScript (CRA) |
| **State** | Zustand + persist middleware |
| **UI** | React-Bootstrap + SCSS + Framer Motion |
| **Hébergement** | Vercel (SPA + Serverless Functions) |
| **Base de données** | Turso (LibSQL) |
| **Chat Twitch** | tmi.js |
| **Auth** | OAuth PKCE (Twitch) |

---

## Crédits

Inspiré de [BlindTesTwitch](https://github.com/s-vivien/BlindTesTwitch) par **neumann__**.

## Licence

GPL-3.0

## Support

- **Discord :** floxail
- **Issues :** [github.com/Floxail/TrivialPurTwitch/issues](https://github.com/Floxail/TrivialPurTwitch/issues)
