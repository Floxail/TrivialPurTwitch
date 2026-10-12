import { Client, Events, GatewayIntentBits, MessageFlags, type ChatInputCommandInteraction, type Interaction } from 'discord.js';
import { boxListText, listRootBoxes } from './catalog';
import { deleteGuildScores, ensureSchema, leaderboard, loadCatalog } from './db';
import { PROPOSE_MESSAGE } from './commands';
import { requireEnv } from './env';
import { handleGameComponent, isGameRunning, stopAllGames, stopGame } from './game';
import { handleSetupComponent, openSetup } from './setup';

/** Un message Discord fait 2000 caractères au plus. */
const MESSAGE_LIMIT = 1900;

async function showBoxes(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.editReply(boxListText(listRootBoxes(await loadCatalog()), MESSAGE_LIMIT));
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

async function stop(interaction: ChatInputCommandInteraction): Promise<void> {
  // Réponse d'abord : l'enregistrement des scores peut dépasser les 3 s accordées par Discord.
  const running = isGameRunning(interaction.channelId);
  await interaction.reply({ content: running ? 'Quiz arrêté.' : 'Aucun quiz en cours dans ce salon.', flags: MessageFlags.Ephemeral });
  if (running) await stopGame(interaction.channelId);
}

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'quiz') return openSetup(interaction);
    if (interaction.commandName === 'stop') return stop(interaction);
    if (interaction.commandName === 'boites') return showBoxes(interaction);
    if (interaction.commandName === 'classement') return showLeaderboard(interaction);
    if (interaction.commandName === 'proposer') {
      await interaction.reply({ content: PROPOSE_MESSAGE, flags: MessageFlags.Ephemeral });
      return;
    }
    return;
  }
  if ((interaction.isStringSelectMenu() || interaction.isButton()) && interaction.customId.startsWith('setup:')) {
    return handleSetupComponent(interaction);
  }
  if ((interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) && interaction.customId.startsWith('game:')) {
    return handleGameComponent(interaction);
  }
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

// Bot retiré d'un serveur : ses scores sont supprimés (politique développeur Discord).
client.on(Events.GuildDelete, guild => {
  deleteGuildScores(guild.id).catch((error: Error) => console.error(`Suppression des scores de ${guild.id} :`, error));
});

process.on('unhandledRejection', error => console.error('Promesse rejetée non gérée :', error));

// Sous pm2, npm -> tsx -> node peut relayer le signal plusieurs fois : un seul arrêt.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} reçu : arrêt des parties en cours.`);
  await stopAllGames();
  await client.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await ensureSchema();
await client.login(requireEnv('DISCORD_TOKEN'));
