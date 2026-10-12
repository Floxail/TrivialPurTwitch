import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const DEFAULT_QUESTION_COUNT = 10;
export const DEFAULT_SECONDS = 30;

export const PROPOSE_MESSAGE = [
  'Propose tes questions sur le site, elles seront relues avant d\'être ajoutées :',
  'https://trivial.floxail.fr/contribute?mode=bulk',
  '',
  'Connexion avec ton compte Twitch requise. Format, une question par bloc :',
  '```',
  'Q: Qui a peint la Joconde ?',
  'R: Léonard de Vinci',
  'ALT: De Vinci',
  '```',
  'Conditions : https://trivial.floxail.fr/cgu · Confidentialité : https://trivial.floxail.fr/confidentialite',
].join('\n');

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
  new SlashCommandBuilder()
    .setName('proposer')
    .setDescription('Proposer des questions sur le site')
    .setContexts(InteractionContextType.Guild),
];
