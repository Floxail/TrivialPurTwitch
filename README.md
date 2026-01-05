# TrivialQuiz pour Twitch

Une application web de **Quiz Trivial Pursuit** pour Twitch, écrite en React, utilisant les API Twitch et les récompenses de points de chaîne.

**Application déployée et prête à l'emploi !**  
Accédez directement à : **https://floxail.github.io/TrivialPurTwitch/**

---

##  Description

TrivialQuiz est une application de quiz interactive pour Twitch qui permet à vos spectateurs de jouer à un quiz de type Trivial Pursuit directement depuis votre chat.

### Fonctionnalités principales

- **Mode Carte** : Quiz de 6 questions (1 par catégorie) depuis une boîte spécifique
- **Mode Quiz** : Quiz avec un nombre de questions au choix (1-100)
- **Récompenses de points de chaîne** : Les spectateurs rachètent des quiz avec leurs points
- **Leaderboard en temps réel** : Classement des meilleurs joueurs
- **Tolérance aux fautes** : Détection intelligente des réponses même avec des fautes de frappe
- **Podium de fin** : Affichage des 3 meilleurs joueurs à la fin du quiz
- **Gestion des questions** : Interface complète pour créer, modifier et organiser vos questions
- **Synchronisation GitHub** : Questions centralisées et mises à jour automatiques
- **Question en local** : pour crée des quiz adapter a votre audience 

---

## 🎮 Modes de jeu

### 🎲 Mode Carte (1000 points de chaîne)

- **6 questions** : 1 par catégorie (Géographie, Divertissement, Histoire, Arts & Littérature, Sciences & Nature, Sports & Loisirs)
- Le spectateur **choisit la boîte** de questions (ex: "Géographie", "Cinéma", etc.)
- Idéal pour tester ses connaissances sur un thème spécifique

**Exemple d'utilisation :**
```
Spectateur rachète "Quiz Carte" (1000 points)
→ Entre "Géographie" dans le champ texte
→ Le quiz démarre avec 6 questions de géographie
```

### Mode quiz (1500 points de chaîne)

- **1 à 100+ questions** : Le spectateur choisit le nombre
- Questions **aléatoires** parmi toute la base de données
- Idéal pour des quiz plus longs ou plus courts

**Exemple d'utilisation :**
```
Spectateur rachète "Quiz Personnalisé" (1500 points)
→ Entre "10" dans le champ texte
→ Le quiz démarre avec 10 questions aléatoires
```

---

## Récompenses de points de chaîne

L'application fonctionne avec les **récompenses de points de chaîne Twitch** (Channel Points).

### Configuration des récompenses

Créez deux récompenses personnalisées dans votre dashboard Twitch (EXEMPLE):

**Récompense 1 : Quiz Carte**
- **Nom :** `Quiz Carte`
- **Coût :** 1000 points
- **Saisie de texte :** OUI
- **Description :** "Lance un quiz de 6 questions depuis une boîte. Entrez le nom de la boîte (ex: Géographie)"

**Récompense 2 : Quiz Personnalisé**
- **Nom :** `Quiz Personnalisé`
- **Coût :** 1500 points
- **Saisie de texte :** OUI
- **Description :** "Lance un quiz avec le nombre de questions de votre choix (1-100). Entrez un nombre (ex: 10)"

📖 **Guide complet :** Voir [CHANNEL_POINT_SETUP.md](./docs/CHANNEL_POINT_SETUP.md)

---

## Gestion des questions

### Organisation par boîtes

Les questions sont organisées en **boîtes** (comme les éditions de Trivial Pursuit) :
- Genius II
- Cinema 91
- ... et toutes celles que vous créez !

### Interface de gestion

L'application inclut une **interface complète** pour :
-  Créer et modifier des questions
-  Organiser les questions en boîtes
- Importer/Exporter en JSON
- Vérifier les doublons

### Outils

**Convertisseur** - Pour créer vos propres questions :
- Interface simple et intuitive
- Export en JSON

---

### Structure

```
public/data/
├── index.json          ← Liste des fichiers à charger
├── geographie.json     ← Questions de géographie
├── histoire.json       ← Questions d'histoire
├── cinema.json         ← Questions de cinéma
└── ...
```

📖 **Guide complet :** Voir [GITHUB_SYNC.md](./docs/GITHUB_SYNC.md)

---

## Utilisation

### Pour les streamers

1. **Accédez à l'application** : https://floxail.github.io/TrivialPurTwitch/
2. **Connectez-vous** avec votre compte Twitch
3. **Configurez vos récompenses** de points de chaîne (voir ci-dessus)
4. **Ajoutez des questions** via l'interface de gestion
5. **Lancez votre stream** !

### Pour les spectateurs

1. **Regardez le stream** du streamer
2. **Rachetez** "Quiz Carte" ou "Quiz Personnalisé" avec vos points de chaîne
3. **Entrez** le nom de la boîte ou le nombre de questions
4. **Jouez** en répondant dans le chat Twitch !

### Commande de test (streamer uniquement)

Le streamer peut tester sans dépenser de points avec la commande :

```
!quiz carte Géographie    → Lance une carte depuis la boîte "Géographie"
!quiz 10                   → Lance un quiz de 10 questions aléatoires
```

⚠️ Cette commande ne fonctionne QUE pour le streamer (votre pseudo Twitch).

---

## Catégories

Le quiz utilise les **6 catégories** classiques du Trivial Pursuit :

| # | Catégorie | Couleur | Exemples de questions |
|---|-----------|---------|----------------------|
| 0 |  Géographie | Bleu | Capitales, pays, fleuves... |
| 1 |  Divertissement | Rose | Cinéma, musique, télévision... |
| 2 |  Histoire | Jaune | Dates, événements, personnages... |
| 3 |  Arts & Littérature | Marron | Peinture, livres, auteurs... |
| 4 |  Sciences & Nature | Vert | Physique, chimie, biologie... |
| 5 |  Sports & Loisirs | Orange | Football, jeux, records... |

---

## 🔧 Configuration (si vous voulez déployer votre propre version)

### Variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
REACT_APP_TWITCH_CLIENT_ID=votre_client_id_twitch
PUBLIC_URL=/TrivialPurTwitch
```

### Application Twitch

Créez une application sur https://dev.twitch.tv/console/apps/

**Paramètres :**
- **Redirect URI :** `https://votre-domaine.github.io/TrivialPurTwitch/callback`
- **Category :** Website Integration

### Déploiement sur GitHub Pages

L'application utilise [spa-github-pages](https://github.com/rafgraph/spa-github-pages) pour le routing React.

**Étapes :**

1. Installez les dépendances : `npm install`
2. Configurez le déploiement : `npm install --save-dev gh-pages`
3. Activez GitHub Pages dans les paramètres du repo (branche `gh-pages`)
4. Déployez : `npm run deploy`

**Guide complet de déploiement :** Voir les fichiers fournis dans la session précédente

---

## 📦 Documentation

| Fichier | Description |
|---------|-------------|
| `CHANNEL_POINT_SETUP.md` | Configuration des récompenses de points de chaîne |
| `GITHUB_SYNC.md` | Synchronisation des questions avec GitHub |
| `OCR_TOOLS.md` | Outils de numérisation de cartes |

---

### Réponses alternatives

Ajoutez des réponses alternatives pour plus de tolérance :

```json
{
  "question": "Quelle est la capitale de la France ?",
  "answer": "Paris",
  "alternativeAnswers": ["paris", "capitale française"]
}
```
---

## Technologies utilisées

- **React** - Framework frontend
- **TypeScript** - Typage statique
- **Zustand** - Gestion d'état
- **Bootstrap** - UI components
- **Twitch IRC (tmi.js)** - Intégration chat Twitch
- **GitHub Pages** - Hébergement
- **Gemini AI et Claude** - OCR et HTML pour le convetiseur de question

---

##  Crédits

Ce projet est basé sur [BlindTesTwitch](https://github.com/s-vivien/BlindTesTwitch) créé par **neumann__**.

**Modifications principales :**
- Remplacement du système de Blind-Test Spotify par un Quiz Trivial Pursuit
- Ajout des récompenses de points de chaîne Twitch
- Ajout de la synchronisation GitHub pour les questions
- Ajout des outils OCR pour numériser les cartes physiques
- Ajout du formatage Markdown dans les questions
- Ajout du système de boîtes et de gestion des questions

**Merci à Neumann pour le code de base solide et l'infrastructure Twitch/React !**

---

## 📝 Licence

GPL-3.0 (comme le projet original BlindTesTwitch)

---

## 💬 Support

Des questions ? Des bugs ? Des suggestions ?

- **Discord :** floxail
- **GitHub Issues :** [Créer une issue](https://github.com/Floxail/TrivialPurTwitch/issues)

---

##  Amusez-vous bien !

Bon quiz ! 
