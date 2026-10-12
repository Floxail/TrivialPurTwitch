import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  type ButtonInteraction, type ChatInputCommandInteraction, type StringSelectMenuInteraction,
} from 'discord.js';
import { MENU_SIZE, applyMenuSelection, listRootBoxes, narrowRoot, pickQuestions, splitIntoMenus, type RootBox } from './catalog';
import { DEFAULT_QUESTION_COUNT, DEFAULT_SECONDS } from './commands';
import { loadCatalog, loadQuestions } from './db';
import { displayName, isGameRunning, startGame } from './game';

const SETUP_TTL_MS = 5 * 60_000;
const HISTORY_SIZE = 500;
// ponytail: un message Discord a 5 rangées (dont 1 pour les boutons) : 4 menus × 25 = 100 boîtes principales.
// Au-delà, les dernières ne sont pas proposées : passer à une recherche (autocomplétion) à ce moment-là.
const MAX_MENUS = 4;
/** « Toute la boîte » occupe une option du menu de sous-boîtes. */
const ALL_SUB_BOXES = '*';

export const REQUIRED_PERMISSIONS = [
  { flag: PermissionFlagsBits.ViewChannel, label: 'Voir le salon' },
  { flag: PermissionFlagsBits.SendMessages, label: 'Envoyer des messages' },
  { flag: PermissionFlagsBits.EmbedLinks, label: 'Intégrer des liens' },
];

type SetupSession = {
  id: string;
  interaction: ChatInputCommandInteraction;
  roots: RootBox[];
  /** Index des boîtes principales choisies. */
  selected: Set<number>;
  /** Index de boîte principale -> sous-boîtes retenues. Absent = toute la boîte. */
  subChoices: Map<number, string[]>;
  step: 'boxes' | 'sub-boxes';
  questionCount: number;
  seconds: number;
  expiry: NodeJS.Timeout;
};

const sessions = new Map<string, SetupSession>();
// ponytail: historique anti-répétition en mémoire, perdu au redémarrage (spec §4). Table Turso si ça gêne.
const guildHistory = new Map<string, string[]>();

export function missingPermissions(interaction: ChatInputCommandInteraction | ButtonInteraction): string[] {
  return REQUIRED_PERMISSIONS.filter(p => !interaction.appPermissions.has(p.flag)).map(p => p.label);
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase();

/** Boîtes choisies, chacune limitée à ses sous-boîtes retenues. */
function effectiveRoots(session: SetupSession): RootBox[] {
  return [...session.selected].sort((a, b) => a - b)
    .map(i => narrowRoot(session.roots[i], session.subChoices.get(i) ?? []));
}

function selectionNames(session: SetupSession): string[] {
  return [...session.selected].sort((a, b) => a - b).map(i => {
    const subs = session.subChoices.get(i)?.length ?? 0;
    return subs > 0 ? `${session.roots[i].name} (${subs} sous-boîte${subs > 1 ? 's' : ''})` : session.roots[i].name;
  });
}

/** Boîtes choisies qui ont des sous-boîtes : celles que l'écran 2 permet de préciser. */
const refinable = (session: SetupSession) =>
  [...session.selected].sort((a, b) => a - b).filter(i => session.roots[i].subBoxes.length > 0).slice(0, MAX_MENUS);

function boxMenus(session: SetupSession): ActionRowBuilder<StringSelectMenuBuilder>[] {
  return splitIntoMenus(session.roots.length).slice(0, MAX_MENUS).map((indexes, m) => {
    const first = session.roots[indexes[0]];
    const last = session.roots[indexes[indexes.length - 1]];
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder()
      .setCustomId(`setup:${session.id}:boxes:${m}`)
      .setPlaceholder(`Boîtes ${initial(first.name)} → ${initial(last.name)}`)
      .setMinValues(0)
      .setMaxValues(indexes.length)
      .addOptions(indexes.map(i => {
        const root = session.roots[i];
        const details = [
          `${root.questionCount} questions`,
          root.subBoxes.length > 0 ? `${root.subBoxes.length} sous-boîtes` : '',
          root.ordered ? 'ordonnée' : '',
        ].filter(Boolean).join(' · ');
        return new StringSelectMenuOptionBuilder()
          .setLabel(root.name.slice(0, 100))
          .setValue(String(i))
          .setDescription(details)
          .setDefault(session.selected.has(i));
      })));
  });
}

function subBoxMenus(session: SetupSession): ActionRowBuilder<StringSelectMenuBuilder>[] {
  return refinable(session).map(i => {
    const root = session.roots[i];
    const chosen = session.subChoices.get(i) ?? [];
    // 1 option « Toute la boîte » + 24 sous-boîtes au plus (limite de 25 options)
    const subs = root.subBoxes.slice(0, MENU_SIZE - 1);
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder()
      .setCustomId(`setup:${session.id}:sub:${i}`)
      .setPlaceholder(`${root.name} : sous-boîtes`.slice(0, 150))
      .setMinValues(1)
      .setMaxValues(subs.length + 1)
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel('Toute la boîte')
          .setValue(ALL_SUB_BOXES)
          .setDescription(`${root.questionCount} questions`)
          .setDefault(chosen.length === 0),
        ...subs.map((sub, s) => new StringSelectMenuOptionBuilder()
          .setLabel(sub.name.slice(0, 100))
          .setValue(String(s))
          .setDescription(`${sub.questionCount} questions`)
          .setDefault(chosen.includes(sub.name))),
      ]));
  });
}

function render(session: SetupSession) {
  const chosen = effectiveRoots(session);
  const available = chosen.reduce((sum, root) => sum + root.questionCount, 0);
  const button = (action: string, label: string, style: ButtonStyle, disabled = false) =>
    new ButtonBuilder().setCustomId(`setup:${session.id}:${action}`).setLabel(label).setStyle(style).setDisabled(disabled);

  const buttons = new ActionRowBuilder<ButtonBuilder>();
  if (session.step === 'boxes') {
    buttons.addComponents(button('launch', 'Lancer', ButtonStyle.Success, chosen.length === 0));
    if (refinable(session).length > 0) buttons.addComponents(button('to-sub', 'Sous-boîtes…', ButtonStyle.Primary));
  } else {
    buttons.addComponents(
      button('to-boxes', 'Retour', ButtonStyle.Secondary),
      button('launch', 'Lancer', ButtonStyle.Success, chosen.length === 0),
    );
  }
  buttons.addComponents(button('cancel', 'Annuler', ButtonStyle.Secondary));

  const hidden = session.roots.length - splitIntoMenus(session.roots.length).slice(0, MAX_MENUS).flat().length;
  return {
    content: [
      `**Configurer le quiz** · ${session.questionCount} questions · ${session.seconds} s par question`,
      chosen.length === 0 ? 'Aucune boîte sélectionnée' : `Sélection : ${selectionNames(session).join(', ')} · ${available} questions disponibles`,
      session.step === 'sub-boxes' ? 'Précise les sous-boîtes (par défaut : toute la boîte).' : '',
      hidden > 0 ? `${hidden} boîtes non affichées (limite Discord).` : '',
    ].filter(Boolean).join('\n').slice(0, 1900),
    components: [...(session.step === 'boxes' ? boxMenus(session) : subBoxMenus(session)), buttons],
  };
}

export async function openSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  const missing = missingPermissions(interaction);
  if (missing.length > 0) {
    await interaction.reply({ content: `Il me manque des droits dans ce salon : ${missing.join(', ')}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (isGameRunning(interaction.channelId)) {
    await interaction.reply({ content: 'Un quiz est déjà en cours ici (/stop pour l\'arrêter).', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const catalog = await loadCatalog().catch((error: Error) => {
    console.error('Lecture du catalogue :', error);
    return undefined;
  });
  if (!catalog) {
    await interaction.editReply('Questions indisponibles, réessaie dans un instant.');
    return;
  }
  const roots = listRootBoxes(catalog);
  if (roots.length === 0) {
    await interaction.editReply('Aucune boîte disponible.');
    return;
  }

  const id = interaction.id;
  const session: SetupSession = {
    id,
    interaction,
    roots,
    selected: new Set(),
    subChoices: new Map(),
    step: 'boxes',
    questionCount: interaction.options.getInteger('questions') ?? DEFAULT_QUESTION_COUNT,
    seconds: interaction.options.getInteger('temps') ?? DEFAULT_SECONDS,
    expiry: setTimeout(() => {
      sessions.delete(id);
      interaction.editReply({ content: 'Configuration expirée.', components: [] }).catch(() => {});
    }, SETUP_TTL_MS),
  };
  sessions.set(id, session);
  await interaction.editReply(render(session));
}

async function launch(interaction: ButtonInteraction, session: SetupSession): Promise<void> {
  const channel = interaction.channel;
  const guildId = interaction.guildId;
  if (!guildId || !channel?.isSendable()) {
    await interaction.update({ content: 'Ce salon ne permet pas de lancer un quiz.', components: [] });
    return;
  }

  // Accusé de réception tout de suite : le chargement des questions peut approcher la limite de 3 s.
  await interaction.deferUpdate();
  const roots = effectiveRoots(session);
  const loaded = await loadQuestions(roots.flatMap(root => root.memberNames)).catch((error: Error) => {
    console.error('Chargement des questions :', error);
    return undefined;
  });
  if (!loaded) {
    await interaction.editReply({ content: 'Questions indisponibles, réessaie dans un instant.', components: [] });
    return;
  }

  // Aucun await entre ces contrôles et startGame, qui réserve le salon de façon synchrone :
  // deux « Lancer » simultanés dans le même salon ne démarrent qu'une partie.
  if (isGameRunning(interaction.channelId)) {
    await interaction.editReply({ content: 'Un quiz est déjà en cours ici (/stop pour l\'arrêter).', components: [] });
    return;
  }
  const missing = missingPermissions(interaction);
  if (missing.length > 0) {
    await interaction.editReply({ content: `Il me manque des droits dans ce salon : ${missing.join(', ')}.`, components: [] });
    return;
  }
  const recent = guildHistory.get(guildId) ?? [];
  const questions = pickQuestions(loaded, roots, session.questionCount, recent);
  const boxNames = selectionNames(session);
  const starting = startGame(channel, guildId, displayName(interaction), questions, session.seconds, boxNames, session.questionCount);

  await interaction.editReply({ content: 'Quiz lancé.', components: [] });
  if (!(await starting)) {
    await interaction.editReply({ content: 'Un quiz est déjà en cours ici (/stop pour l\'arrêter).', components: [] });
    return;
  }
  guildHistory.set(guildId, [...questions.map(q => q.id), ...recent].slice(0, HISTORY_SIZE));
}

export async function handleSetupComponent(interaction: StringSelectMenuInteraction | ButtonInteraction): Promise<void> {
  const [, id, action, target] = interaction.customId.split(':');
  const session = sessions.get(id);
  if (!session) {
    await interaction.update({ content: 'Configuration expirée.', components: [] });
    return;
  }

  if (interaction.isStringSelectMenu() && action === 'boxes') {
    const menuIndexes = splitIntoMenus(session.roots.length)[Number(target)] ?? [];
    session.selected = applyMenuSelection(session.selected, menuIndexes, interaction.values.map(Number));
    for (const index of session.subChoices.keys()) {
      if (!session.selected.has(index)) session.subChoices.delete(index);
    }
  } else if (interaction.isStringSelectMenu() && action === 'sub') {
    const rootIndex = Number(target);
    const values = interaction.values;
    if (values.includes(ALL_SUB_BOXES)) session.subChoices.delete(rootIndex);
    else session.subChoices.set(rootIndex, values.map(v => session.roots[rootIndex].subBoxes[Number(v)].name));
  } else if (action === 'to-sub') {
    session.step = 'sub-boxes';
  } else if (action === 'to-boxes') {
    session.step = 'boxes';
  } else {
    clearTimeout(session.expiry);
    sessions.delete(id);
    if (action === 'launch' && interaction.isButton()) return launch(interaction, session);
    await interaction.update({ content: 'Configuration annulée.', components: [] });
    return;
  }
  await interaction.update(render(session));
}
