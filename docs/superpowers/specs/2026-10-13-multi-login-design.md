# Connexion Discord et Google — design

Date : 2026-10-13 · Statut : implémenté (branche feat/multi-login)

## But

Permettre de se connecter au site avec Discord ou Google, en plus de Twitch :

1. proposer des questions sans compte Twitch (lien `/proposer` du bot Discord) ;
2. ouvrir contribution, création de boîtes et stats à ces comptes ;
3. lier plusieurs comptes d'une même personne (Twitch + Discord + Google = une seule identité) ;
4. poser une identité multi-fournisseurs réutilisable par le futur Mode Partie Privée.

Twitch reste obligatoire pour animer un quiz : le site parle dans le chat avec le jeton du streamer.

## Hors périmètre

- Collecter l'e-mail.
- Le Mode Partie Privée lui-même.
- Rendre Discord/Google admin (`ADMIN_TWITCH_IDS` inchangé, admin = jeton Twitch).
- Fusionner deux identités qui ont chacune déjà des comptes liés.

## Approche : session maison

Échange OAuth côté serveur (Vercel Functions), cookie de session signé. Aucune dépendance ajoutée (`node:crypto`). Le jeton Twitch actuel (Bearer, vérifié via `id.twitch.tv/oauth2/validate`) reste tel quel.

Écarts d'implémentation : une seule fonction `api/auth/[action].ts` (limite de 12 fonctions du plan Hobby) ; le cookie ne porte que `provider`, `providerId` et `exp`, nom et avatar sont dans `account_links` (colonnes `name`, `avatar`), où chaque compte Discord/Google a sa ligne dès sa première connexion.

### Identifiants

| Fournisseur | `userId` | `login` |
|---|---|---|
| Twitch | `user_id` Twitch, sans préfixe (inchangé) | login Twitch |
| Discord | `discord:<id>` | `global_name` sinon `username` |
| Google | `google:<sub>` | `name` |

Les ID Twitch existants en base ne changent pas : aucune migration. Le préfixe empêche toute collision entre fournisseurs.

## Serveur

### `api/_session.ts` (pur, testé)

- `signSession(payload, secret)` / `verifySession(cookie, secret, now)`.
- Payload : `{ id, name, avatar, provider, exp }`, encodé base64url, signé HMAC-SHA256 avec `SESSION_SECRET`, comparaison `timingSafeEqual`.
- Durée : 30 jours. Signature fausse, format invalide ou `exp` dépassé → `null`.
- Cookie `tpt_session` : `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`.

### `api/auth/discord.ts` et `api/auth/google.ts`

GET en deux temps :

1. Sans `code` : génère un `state` aléatoire, le pose en cookie `tpt_oauth_state` (HttpOnly, 10 min) avec le chemin de retour (`return`, validé comme `safeReturnPath` : chemin interne uniquement), redirige vers le fournisseur.
   - Discord : `https://discord.com/oauth2/authorize`, scope `identify`.
   - Google : `https://accounts.google.com/o/oauth2/v2/auth`, scope `openid profile`.
2. Avec `code` : vérifie `state` = cookie (sinon 400), échange le code (`client_secret` serveur), lit le profil (Discord `GET /users/@me` ; Google `userinfo`), pose `tpt_session`, efface `tpt_oauth_state`, redirige vers le chemin de retour (`/contribute` par défaut).
   - Refus utilisateur (`error=access_denied`) ou échec d'échange → redirection `/?login_error=<fournisseur>`, aucun détail technique exposé.

`redirect_uri` : `https://trivial.floxail.fr/api/auth/<fournisseur>` (dérivé de l'en-tête Host, liste blanche : domaine de prod + `localhost:3000`).

L'échange et la lecture du profil prennent un `fetch` injectable pour être testés sans réseau.

### `api/auth/logout.ts`

POST : efface `tpt_session`.

### `api/auth/me.ts`

Accepte Twitch ou session. Renvoie `{ userId, login, avatar, provider, isAdmin }` (`isAdmin` toujours `false` hors Twitch).

### `requireUser(req)` dans `api/_utils.ts`

1. En-tête `Authorization: Bearer` présent → chemin Twitch actuel (`requireAnyTwitchAuth`), `provider: 'twitch'`.
2. Sinon cookie `tpt_session` valide → `{ userId, login, provider }`.
   - Si la méthode n'est pas GET : l'en-tête `Origin` doit être une origine autorisée (prod ou localhost), sinon refus (CSRF, en plus de `SameSite=Lax`).
3. Sinon `null` → 401.

### Ce qui passe sur `requireUser`

| Endpoint | Avant | Après |
|---|---|---|
| `submit-question` POST | Twitch | Twitch, Discord, Google |
| `reports` POST | Twitch | Twitch, Discord, Google |
| `boxes` POST (création) | Twitch | Twitch, Discord, Google |
| `auth/me` | Twitch | Twitch, Discord, Google |

Reste Twitch seul : admin, `scores`, `stats?action=record_questions`, `history`, `questions*`, `reorder-box`.

### Stats

- Nouvelle action `GET /api/stats?action=my_discord` : un compte Discord doit faire partie du groupe de l'utilisateur (session Discord, ou Discord lié) ; renvoie les totaux de `discord_scores` pour `user_id = <id Discord sans préfixe>`, tous serveurs confondus : points, parties (`COUNT(DISTINCT session_id)`), bonnes réponses, FIRST, meilleur combo, réponse la plus rapide. Visible par le seul titulaire : aucun classement inter-serveurs.
- Correctif : le compteur « questions approuvées » compare `submitted_by_id` au lieu de `LOWER(submitted_by)` (sinon un pseudo Discord identique à un pseudo Twitch fusionnerait les compteurs).
- La recherche `/stats/<pseudo>` (joueurs du chat Twitch) reste ouverte à tous les connectés.

### Variables d'environnement (Vercel)

`DISCORD_CLIENT_ID` (même application que le bot), `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` (32 octets aléatoires). Absente → l'endpoint du fournisseur répond 503, le reste du site fonctionne (fail-closed).

Redirect URIs à déclarer : Discord Developer Portal (OAuth2) et Google Cloud Console (client OAuth « Application Web »).

## Liaison de comptes

### Table `account_links`

```sql
CREATE TABLE IF NOT EXISTS account_links (
  provider_id TEXT PRIMARY KEY,   -- id Twitch brut, discord:<id> ou google:<sub>
  primary_id  TEXT NOT NULL,      -- identité principale du groupe
  name        TEXT,               -- pseudo affiché, mis à jour à chaque connexion
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_account_links_primary ON account_links(primary_id);
```

Un compte sans ligne est sa propre identité principale. Table créée dans `api/_db.ts` comme les autres.

### Identité principale

- Groupe contenant un compte Twitch → l'ID Twitch est l'identité principale (données existantes, `ADMIN_TWITCH_IDS` et historique restent valables).
- Sinon → le premier compte connecté.
- Lier un Twitch à un groupe Discord/Google fait basculer l'identité principale sur le Twitch (réattribution ci-dessous).

### Résolution

`requireUser` et `auth/me` traduisent l'ID fournisseur en `primary_id` à chaque requête (une lecture par clé primaire). Le cookie de session garde l'ID fournisseur brut : délier prend effet immédiatement. `requireUser` renvoie `{ userId: primary_id, login, provider, providerId }`.

L'admin reste réservé au jeton Twitch (`requireAdminAuth` inchangé) : un Discord lié à un compte admin n'a pas l'admin.

### Lier

Depuis Paramètres, section « Comptes liés » (accessible à tous les comptes) :

- **Ajouter Discord ou Google** : `POST /api/auth/link-start` (identité actuelle via `requireUser`) pose un cookie signé `tpt_link` (`{ primary_id, exp: 10 min }`, HttpOnly), puis navigation vers `/api/auth/<fournisseur>?link=1&return=/settings`. Au retour, si `tpt_link` est valide, le callback lie le compte au lieu d'ouvrir une nouvelle session, puis efface `tpt_link`.
- **Ajouter Twitch** (depuis un compte Discord/Google) : connexion Twitch habituelle (`startTwitchLogin('/settings')`), puis `POST /api/auth/link-twitch` avec le Bearer Twitch ET le cookie de session : le serveur lie les deux.

Règles :

- Le compte ajouté est déjà lié ailleurs, ou est l'identité principale d'un autre groupe → refus « Ce compte est déjà lié à une autre identité », aucune fusion automatique.
- Liaison acceptée → en une transaction (`client.batch(…, 'write')`) : insertion dans `account_links` et réattribution de l'ancien ID vers l'identité principale dans `pending_questions.submitted_by_id`, `boxes` (créateur) et `reports`. Si l'identité principale bascule sur Twitch, toutes les lignes du groupe sont mises à jour aussi.
- `discord_scores` n'est pas réécrit (table du bot, ID Discord brut) : `my_discord` cherche l'ID Discord lié au groupe.

### Délier

`POST /api/auth/unlink { providerId }` : supprime la ligne. Refusé sur l'identité principale elle-même et sur le compte avec lequel on est connecté. Les données réattribuées restent à l'identité principale.

### Affichage

Paramètres → « Comptes liés » : fournisseurs du groupe (nom), boutons Lier / Délier. `GET /api/auth/me` renvoie aussi `links: [{ provider, providerId, name }]`.

## Front

- **`helpers.ts`** : `startProviderLogin(provider, returnPath)` → `window.location.href = /api/auth/<provider>?return=<chemin>`.
- **`auth-store`** : champ `account?: { id, name, avatar, provider }` (non persisté : vient du cookie), action `loadAccount()` (`GET /api/auth/me`, `credentials: 'same-origin'`) appelée au démarrage. `isLoggedIn()` = jeton Twitch OU `account`. `clear()` appelle aussi `POST /api/auth/logout`.
- **`App.tsx`** : attend `loadAccount()` avant de décider de la redirection vers Login. Compte non-Twitch : pas de passage par `/settings` ; `/` mène à `/contribute`.
- **`login.tsx`** : trois boutons (Twitch avec la mention « requis pour animer un quiz », Discord, Google). Affiche un message si `?login_error=` est présent.
- **`global-menu.tsx`** : connecté sans jeton Twitch → Contribuer, Stats, Paramètres (section Comptes liés seule), Changelog/Aide, Déconnexion.
- **`quiz.tsx`** : compte non-Twitch → message « Connecte-toi avec Twitch pour animer un quiz » + bouton Twitch, rien d'autre.
- **`stats.tsx`** : compte Discord → bloc « Mes parties Discord » (action `my_discord`).
- **Services API** (`api-submit-service`, `api-reports-service`, `api-service` création de boîte) : envoient le Bearer Twitch s'il existe, sinon s'appuient sur le cookie (`credentials: 'same-origin'`).

## Textes

- `bot/src/commands.ts` `PROPOSE_MESSAGE` : « Connexion avec Twitch, Discord ou Google requise ».
- `legal.tsx` Confidentialité : données reçues de Discord (ID, pseudo, avatar) et Google (identifiant, nom, avatar), aucun e-mail ; cookie de session 30 jours, strictement nécessaire (pas de bandeau). CGU : mention des trois connexions. `UPDATED` mis à jour.
- Changelog : entrée datée.
- `CLAUDE.md` : variables d'environnement.

CSP : aucun changement (`img-src https:` couvre les avatars, les redirections OAuth sont des navigations de page).

## Erreurs

- Fournisseur indisponible / refus → retour sur `/` avec message, jamais de page blanche.
- Cookie falsifié ou expiré → traité comme non connecté.
- `SESSION_SECRET` absent → aucune session acceptée ni émise.

## Tests

- `_session` : aller-retour signé, signature modifiée refusée, payload modifié refusé, expiré refusé, format invalide refusé.
- `requireUser` : Bearer Twitch prioritaire, cookie valide accepté, cookie + POST sans `Origin` autorisé refusé, rien → `null`.
- OAuth : `state` différent du cookie → 400 ; échange réussi (fetch injecté) → cookie posé + redirection vers le retour validé ; `return=//evil` → `/contribute`.
- `my_discord` : agrégat correct sur deux serveurs ; session Google sans Discord lié → 403 ; Google lié à un Discord → ses scores.
- Liaison : lier Discord à Twitch réattribue ses propositions au Twitch ; compte déjà lié ailleurs → refusé ; Twitch ajouté à un groupe Discord devient l'identité principale ; délier l'identité principale ou le compte connecté → refusé ; `tpt_link` expiré → pas de liaison ; session Discord liée à un admin Twitch → `requireAdminAuth` refuse.
- Compteur approuvé par `submitted_by_id`.
