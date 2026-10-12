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
