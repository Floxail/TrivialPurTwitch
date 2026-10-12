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
   pm2 start npm --name trivial-bot --kill-timeout 10000 -- start   # 10 s pour enregistrer les scores à l'arrêt
   pm2 save
   pm2 startup            # suivre la commande affichée
   ```

`bot/.npmrc` bloque les scripts d'installation des dépendances (`ignore-scripts=true`). Le bot n'en a pas besoin : seul `esbuild` (utilisé par `tsx`) en déclare un, facultatif.

## Mise à jour

```bash
git pull && cd bot && npm ci && pm2 restart trivial-bot
```

Relancer `npm run register` seulement si `src/commands.ts` a changé.

## Développement

- `npm run register -- --guild <id>` : commandes sur un serveur de test, immédiat.
- `npm start` : lance le bot avec `bot/.env`.
- `npm test` / `npm run typecheck`.
