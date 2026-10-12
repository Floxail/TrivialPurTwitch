# Bot Discord TrivialPurTwitch — Design

Date : 2026-10-12
Statut : implémenté (branche feat/discord-bot), révisé le 2026-10-13

## 1. Objectif

Rendre les quiz TrivialPurTwitch jouables directement dans Discord, via un bot ajoutable sur plusieurs serveurs. Les questions sont les mêmes que sur le site (boîtes publiques dans Turso).

- **Public visé** : d'abord les serveurs du propriétaire et de ses amis, mais le bot doit pouvoir devenir public (plus de 100 serveurs) sans réécriture.
- **Critère de réussite** : sur un serveur Discord, un modérateur lance `/quiz`, choisit une ou plusieurs boîtes, et la partie se déroule seule (questions, timer, révélation, podium). Ensuite, `/classement` affiche le top du serveur.

## 2. Contraintes structurantes

- **Aucun intent privilégié.** Lire le texte des messages (`MESSAGE_CONTENT`) exige une vérification Discord au-delà de 100 serveurs. Toutes les réponses passent donc par des composants : boutons et fenêtres (modals). Seul l'intent `Guilds` est activé.
- **Les règles du jeu sont celles du site** : même validation des réponses, même calcul des points, même tirage des questions, grâce au code partagé (§6).
- **Jamais d'ID Discord dans la table `scores`** du site. Sa clé d'identité est `COALESCE(NULLIF(twitch_id,''), LOWER(nick))` dans `api/_utils.ts`. Les scores Discord vont dans une table séparée.
- **Hébergement hors Vercel** : un process Node permanent sur le serveur du propriétaire, géré par pm2.
- **Accès direct à Turso.** Le bot est un composant serveur de confiance. Passer par l'API publique se heurterait à sa limite de 60 requêtes/min par IP et à la protection anti-bot de Vercel, qui bloque les requêtes hors navigateur.

## 3. Commandes

| Commande | Accès | Effet |
|---|---|---|
| `/quiz [questions:1-50] [temps:10-60]` | `default_member_permissions = ManageGuild` | Ouvre la configuration privée (§4). Valeurs par défaut : 10 questions, 30 s. |
| `/stop` | `ManageGuild` | Arrête la partie du salon. Les scores déjà gagnés sont enregistrés. |
| `/classement` | tous | Top 10 du serveur : points, bonnes réponses, nombre de FIRST. |
| `/boites` | tous | Liste des boîtes visibles avec leur nombre de questions. |
| `/proposer` | tous | Réponse privée : lien vers `https://trivial.floxail.fr/contribute?mode=bulk` (onglet de soumission en masse, connexion Twitch requise) et rappel du format `Q:` / `R:` / `ALT:`. |

Restreindre une commande se fait nativement : chaque admin peut l'ouvrir à des rôles ou à tous via *Réglages du serveur → Intégrations*. Le bot n'a pas de système de configuration.

Les commandes sont globales. Un script les enregistre ; il accepte une option `--guild <id>` pour un enregistrement instantané sur un serveur de test.

## 4. Configuration d'une partie

`/quiz` répond par un message **éphémère** (visible par le lanceur seul), en deux écrans. Révisé le 2026-10-13 après la recette : les pages étaient peu intuitives et les sous-boîtes manquaient.

- **Écran 1, boîtes principales, sans pages** : les boîtes visibles de premier niveau sont réparties dans plusieurs menus multi-sélection affichés en même temps, découpés par ordre alphabétique en parts égales de 25 au plus (38 boîtes → 2 menus « Boîtes A → K », « Boîtes L → Z »). Description d'une option : « N questions · k sous-boîtes · ordonnée ». Boutons : « Lancer » (désactivé tant que rien n'est choisi), « Sous-boîtes… » (seulement si une boîte choisie en a), « Annuler ».
- **Écran 2, sous-boîtes (facultatif)** : un menu par boîte choisie qui a des sous-boîtes, avec « Toute la boîte » (par défaut) et chaque sous-boîte avec son nombre de questions. Boutons : « Retour », « Lancer », « Annuler ».
- **Limites Discord** (5 rangées par message, 25 options par menu) : 100 boîtes principales au plus sur l'écran 1, 4 boîtes à préciser au plus sur l'écran 2, 24 sous-boîtes par boîte. Au-delà de 100 boîtes principales, passer à une recherche par autocomplétion.
- **Résumé** : boîtes choisies (avec le nombre de sous-boîtes retenues) et total de questions disponibles.
- **Chargement** : le menu lit un résumé (métadonnées des boîtes et nombre de questions par boîte, ≈ 100 ms, cache 60 s). Les questions ne sont lues qu'au clic sur « Lancer », pour les boîtes et sous-boîtes retenues.
- **Expiration** après 5 min sans lancement : le message est remplacé par « Configuration expirée ».

**Tirage** (`quiz-picker`, §6) :

| Sélection | Tirage |
|---|---|
| Une seule boîte, marquée ordonnée | Toutes ses questions, triées par `created_at` puis `id`. `questions` est ignoré. |
| Une seule boîte normale | `smartPick` sur ses questions (et celles de ses sous-boîtes). |
| Plusieurs boîtes | `stratifiedPick`, réparti entre les boîtes. Une boîte parente compte comme une seule boîte, sous-boîtes incluses. |
| Moins de questions disponibles que demandé | On joue tout ce qui est disponible, et l'annonce de lancement l'indique. |

**Historique anti-répétition** : en mémoire, par serveur, 500 derniers IDs de questions jouées. Il est perdu au redémarrage du bot (limite acceptée en v1).

## 5. Déroulé d'une partie

Une seule partie par salon à la fois. Si une partie tourne déjà, `/quiz` répond en privé « Un quiz est déjà en cours ici (/stop pour l'arrêter) ».

1. **Annonce** (message public) : « Quiz lancé par X · boîtes · N questions · début <t:T:R> ». Le décompte dure 10 s. L'horodatage relatif `<t:…:R>` est affiché et mis à jour par les clients Discord : le bot ne modifie pas son message chaque seconde.
2. **Question** : un nouveau message avec un embed.
   - Contenu : « Question i/N · boîte », l'énoncé, `imageUrl` en image si elle existe, « Fin <t:…:R> ».
   - **QCM** : un bouton par option (A à F). Une seule tentative par joueur.
   - **Texte libre** : un bouton « Répondre » ouvre un modal avec un champ texte (300 caractères max). Plusieurs essais sont permis jusqu'à la bonne réponse.
   - **Retour** toujours éphémère : « Bonne réponse ! » ou « Faux ». Après une bonne réponse, une nouvelle tentative reçoit « Tu as déjà trouvé ».
   - **Compteur** « K joueurs ont trouvé » : modifié au plus une fois toutes les 3 s, et seulement s'il a changé.
3. **Révélation** à la fin du temps, jamais avant.
   - Le message de la question est modifié : boutons désactivés, bonne réponse (et options correctes en QCM), `answerImageUrl` si elle existe.
   - Liste de ceux qui ont trouvé, avec les points gagnés et leurs bonus.
   - `allowedMentions: { parse: [] }` : aucun joueur n'est notifié.
4. **Enchaînement** automatique vers la question suivante, 5 s après la révélation.
5. **Fin** : message de podium (top 3 mis en avant, puis le reste de la partie). Les scores sont écrits dans `discord_scores` (§7).

**Points** : `scoring` partagé (§6). Base 1, FIRST +2, seul à trouver +1, combo de +1 à +3. Un joueur est FIRST s'il répond correctement au plus 700 ms après la première bonne réponse. Ce délai de clémence est le même que la valeur par défaut du site.

**Identité affichée** : pseudo du membre sur le serveur, à défaut le nom global Discord, à défaut le nom d'utilisateur.

## 6. Code partagé site ↔ bot

Ce sont des modules purs (sans React, sans zustand, sans `localStorage`), avec des **imports relatifs** pour que Node les charge sans la résolution `baseUrl` de CRA.

| Fichier | Changement |
|---|---|
| `src/types/question.ts` | **Nouveau.** `Question` et `QuestionType` déplacés depuis `questions-store.ts`, qui les ré-exporte (aucun import existant ne casse). |
| `src/services/answer-validator.ts` | Imports passés en relatif (`../helpers`, `../types/question`). Logique inchangée. |
| `src/helpers.ts` | Inchangé. Les fonctions qui utilisent `window` ne sont pas appelées par le bot. |
| `src/services/scoring.ts` | **Nouveau.** Calcul des points d'une bonne réponse, extrait de `recordAnswers` (`player-store.ts`), qui l'utilise désormais. |
| `src/services/quiz-picker.ts` | **Nouveau.** `fisherYatesShuffle`, `smartPick`, `stratifiedPick` extraits de `questions-store.ts`. L'historique est un **paramètre** (`recentIds: string[]`) : le site passe celui de `localStorage`, le bot celui du serveur. |

Le comportement du site est strictement inchangé, et les tests le vérifient (§9).

## 7. Données (Turso)

Nouvelle table, créée au démarrage du bot (`CREATE TABLE IF NOT EXISTS`) :

```sql
CREATE TABLE IF NOT EXISTS discord_scores (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  username   TEXT NOT NULL,
  score      INTEGER NOT NULL DEFAULT 0,
  answers    INTEGER NOT NULL DEFAULT 0,
  firsts     INTEGER NOT NULL DEFAULT 0,
  combos     INTEGER NOT NULL DEFAULT 0,
  fastest    INTEGER NOT NULL DEFAULT 0,  -- ms, 0 = aucune bonne réponse
  session_id TEXT NOT NULL,
  box_names  TEXT,                        -- JSON string[]
  channel_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_discord_scores_guild ON discord_scores(guild_id, user_id);
```

- **Écriture** : une ligne par joueur et par partie, en un seul `client.batch(..., 'write')`. Seuls les joueurs ayant au moins une bonne réponse sont enregistrés.
- **`/classement`** : `SUM` par `user_id` pour le `guild_id` du serveur ; on affiche le `username` de la ligne la plus récente. Top 10.
- **Lectures des questions et des boîtes** : `SELECT` sur `questions` et `boxes`, avec un cache en mémoire de 60 s partagé par tous les serveurs. Le bot n'écrit jamais dans `questions`, `boxes` ni `scores`.
- **Retrait du bot d'un serveur** (`guildDelete`) : `DELETE FROM discord_scores WHERE guild_id = ?`.

## 8. Gestion des erreurs

| Situation | Comportement |
|---|---|
| Permissions manquantes dans le salon (ViewChannel, SendMessages, EmbedLinks) | Vérification avant le lancement ; réponse éphémère qui liste les permissions manquantes. |
| Turso indisponible au lancement | Réponse éphémère « Questions indisponibles, réessaie dans un instant ». Rien ne démarre. |
| Turso indisponible à l'enregistrement des scores | Un nouvel essai, puis erreur loguée. Le podium s'affiche quand même. |
| Interaction sur une question terminée ou une partie disparue | Réponse éphémère « Cette question est terminée ». |
| Salon ou message supprimé pendant la partie | Partie arrêtée, scores enregistrés. |
| Requête lente (lecture des boîtes pour `/quiz`, `/boites`, `/classement`) | `deferReply`, pour respecter le délai de 3 s de Discord. |
| Exception dans un gestionnaire d'interaction | Interceptée et loguée. Le process continue, les autres parties ne sont pas affectées. |
| `SIGTERM` / `SIGINT` | Arrêt des parties en cours, enregistrement des scores, puis déconnexion. |

Les limites de fréquence de Discord sont gérées par discord.js.

## 9. Tests

- **Modules partagés** : tests Jest dans la suite du site.
  - `scoring` : base, FIRST, seul, plafond du combo.
  - `quiz-picker` : nombre demandé, pas de doublon, répartition stratifiée, priorité aux questions absentes de l'historique.
  - Les tests existants (`answer-validator`, `questions-store`) restent verts.
- **Bot** : `game.ts` sépare la logique pure (état de la partie, enregistrement d'une réponse, calcul de la révélation et du podium) des appels Discord. La logique est testée avec `tsx --test`, sans Discord.
- **Test manuel** sur un serveur Discord de test (commandes enregistrées avec `--guild`) avant tout ajout sur un autre serveur.

## 10. Organisation et déploiement

```
bot/
├── package.json     discord.js v14, @libsql/client, tsx — projet autonome (son propre install)
├── .env.example     DISCORD_TOKEN, DISCORD_APP_ID, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
└── src/
    ├── index.ts     client Discord, routage des interactions, arrêt propre
    ├── commands.ts  définitions des commandes + enregistrement (global ou --guild)
    ├── setup.ts     message de configuration : menu, pages, Lancer/Annuler, expiration
    ├── game.ts      partie : logique pure + couche Discord (messages, timers)
    └── db.ts        Turso : boîtes, questions (cache 60 s), scores, classement
```

Le bot n'est pas un workspace yarn du site : il a son propre `package.json` et son propre install, pour que le build Vercel et les dépendances du site restent intacts.

**Déploiement** :
1. **Portail développeur Discord** : créer l'application, récupérer le token du bot, aucun intent privilégié. Lien d'invitation avec les scopes `bot` et `applications.commands`, et les permissions ViewChannel, SendMessages, EmbedLinks.
2. **Turso** : token dédié au bot (`turso db tokens create`), révocable indépendamment de celui de Vercel.
3. **Serveur** : `git pull` ; dans `bot/`, installer les dépendances, créer le `.env`, lancer le script d'enregistrement des commandes.
4. **pm2** : `pm2 start` du bot, `pm2 save`, `pm2 startup`.

Pas de sharding : Discord ne l'impose qu'à partir de 2 500 serveurs.

## 11. Hors périmètre (v1)

- Réglages persistants par serveur (temps et nombre de questions par défaut, salon dédié).
- Options de partie du site : orthographe stricte, −1 par mauvaise réponse, 3 pts / 1 pt ALT, une seule réponse par personne.
- Classement global inter-serveurs.
- Liaison de comptes Discord ↔ Twitch (`/link`).
- Persistance des parties en cours et de l'historique anti-répétition (perdus au redémarrage du bot).
- Questions custom stockées dans le navigateur (invisibles pour le bot).
