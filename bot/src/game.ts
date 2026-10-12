import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, DiscordAPIError, EmbedBuilder, GuildMember, LabelBuilder, MessageFlags,
  ModalBuilder, RESTJSONErrorCodes, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle,
  type ButtonInteraction, type MessageCreateOptions, type MessageEditOptions, type ModalSubmitInteraction,
  type RepliableInteraction, type StringSelectMenuInteraction,
} from 'discord.js';
import { QuestionType, type Question } from '../../src/types/question';
import { saveScores } from './db';
import { GameState, QCM_LABELS, correctAnswerText, correctIndexes, type AnswerOutcome, type Finder } from './game-state';

const COUNTDOWN_MS = 10_000;
const NEXT_QUESTION_DELAY_MS = 5_000;
const COUNTER_REFRESH_MS = 3_000;
const MAX_ANSWER_LENGTH = 300;
const BUTTONS_PER_ROW = 5;
const SHOWN_FINDERS = 10;
/** Limite Discord d'une description d'embed (4096), avec de la marge pour la fin du texte. */
const MAX_QUESTION_TEXT = 3500;
const NO_MENTIONS = { parse: [] };

/** Ce que la partie utilise d'un salon Discord. Tout salon où l'on peut écrire convient. */
export type PostedMessage = { id: string; edit(options: MessageEditOptions): Promise<{ id: string }> };
export type GameChannel = { id: string; send(options: MessageCreateOptions): Promise<PostedMessage> };

type GameComponentInteraction = ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;

/** Erreurs qui signifient : salon ou message disparu, ou droits retirés. Inutile de poster le podium. */
const CHANNEL_GONE_CODES = new Set<number | string>([
  RESTJSONErrorCodes.UnknownChannel,
  RESTJSONErrorCodes.UnknownMessage,
  RESTJSONErrorCodes.MissingAccess,
  RESTJSONErrorCodes.MissingPermissions,
]);

const OUTCOME_TEXT = {
  'correct': 'Bonne réponse !',
  'wrong': 'Faux.',
  'already-found': 'Tu as déjà trouvé.',
  'no-more-attempts': 'Tu as déjà répondu à cette question.',
  'closed': 'Cette question est terminée.',
} satisfies Record<AnswerOutcome, string>;

const unix = (ms: number) => Math.floor(ms / 1000);
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Une URL d'image invalide (sans http/https) ne doit pas empêcher la question de partir. */
function withImage(embed: EmbedBuilder, url: string | undefined): EmbedBuilder {
  if (!url) return embed;
  try {
    return embed.setImage(url);
  } catch {
    console.warn(`Image ignorée, URL invalide : ${url}`);
    return embed;
  }
}

/** Pseudo sur le serveur, à défaut nom global, à défaut nom d'utilisateur. */
export function displayName(interaction: RepliableInteraction): string {
  const member = interaction.member;
  if (member instanceof GuildMember) return member.displayName;
  return member?.nick ?? interaction.user.displayName;
}

export function qcmButtonRows(sessionId: string, questionNumber: number, optionCount: number): ActionRowBuilder<ButtonBuilder>[] {
  const buttons = QCM_LABELS.slice(0, optionCount).map((label, i) =>
    new ButtonBuilder().setCustomId(`game:${sessionId}:qcm:${questionNumber}:${i}`).setLabel(label).setStyle(ButtonStyle.Primary));
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += BUTTONS_PER_ROW) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + BUTTONS_PER_ROW)));
  }
  return rows;
}

/** QCM à une réponse : boutons. QCM à plusieurs réponses : menu multiple (une seule validation). Texte libre : bouton Répondre. */
export function answerRows(sessionId: string, questionNumber: number, question: Question): Array<ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>> {
  const optionCount = question.qcmOptions?.length ?? 0;
  if (question.questionType === QuestionType.QCM && correctIndexes(question).length > 1) {
    return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder()
      .setCustomId(`game:${sessionId}:multi:${questionNumber}`)
      .setPlaceholder('Choisis toutes les bonnes réponses')
      .setMinValues(1)
      .setMaxValues(optionCount)
      .addOptions(QCM_LABELS.slice(0, optionCount).map(label => new StringSelectMenuOptionBuilder().setLabel(label).setValue(label))))];
  }
  if (question.questionType === QuestionType.QCM) return qcmButtonRows(sessionId, questionNumber, optionCount);
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`game:${sessionId}:answer:${questionNumber}`).setLabel('Répondre').setStyle(ButtonStyle.Primary))];
}

function finderLine(finder: Finder): string {
  const bonuses = [finder.isFirst ? 'FIRST' : '', finder.isCombo ? 'combo' : ''].filter(Boolean);
  return `${finder.name} +${finder.points}${bonuses.length ? ` (${bonuses.join(', ')})` : ''}`;
}

class Game {
  readonly sessionId = `discord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  readonly state: GameState;
  private message: PostedMessage | undefined;
  private embed: EmbedBuilder | undefined;
  private timer: NodeJS.Timeout | undefined;
  private counter: NodeJS.Timeout | undefined;
  private shownFinders = 0;
  private finished = false;

  constructor(
    private readonly channel: GameChannel,
    private readonly guildId: string,
    private readonly seconds: number,
    private readonly boxNames: string[],
    questions: Question[],
  ) {
    this.state = new GameState(questions);
  }

  async start(launcherName: string, requestedCount: number): Promise<void> {
    const total = this.state.questions.length;
    const shortage = total < requestedCount ? ` (seulement ${total} disponibles)` : '';
    await this.send(`Quiz lancé par ${launcherName} · ${this.boxNames.join(', ')} · ${total} questions${shortage} · début <t:${unix(Date.now() + COUNTDOWN_MS)}:R>`);
    this.timer = setTimeout(() => this.run(() => this.nextQuestion()), COUNTDOWN_MS);
  }

  private async nextQuestion(): Promise<void> {
    const question = this.state.startNextQuestion(Date.now());
    if (!question) return this.finish('Quiz terminé');

    const number = this.state.questionNumber;
    const options = question.questionType === QuestionType.QCM
      ? `\n\n${(question.qcmOptions ?? []).map((option, i) => `**${QCM_LABELS[i]}.** ${option}`).join('\n')}`
      : '';
    this.embed = withImage(new EmbedBuilder()
      .setTitle(`Question ${number}/${this.state.questions.length} · ${clip(question.boxName, 200)}`)
      .setDescription(`${clip(question.question + options, MAX_QUESTION_TEXT)}\n\nFin <t:${unix(Date.now() + this.seconds * 1000)}:R>`)
      .setFooter({ text: '0 joueur a trouvé' }), question.imageUrl);

    this.shownFinders = 0;
    this.message = await this.channel.send({ embeds: [this.embed], components: answerRows(this.sessionId, number, question), allowedMentions: NO_MENTIONS });
    // /stop ou arrêt du bot pendant l'envoi : ne rien reprogrammer
    if (this.finished) return;
    this.counter = setInterval(() => this.run(() => this.refreshCounter()), COUNTER_REFRESH_MS);
    this.timer = setTimeout(() => this.run(() => this.revealQuestion()), this.seconds * 1000);
  }

  private async refreshCounter(): Promise<void> {
    const count = this.state.finderCount;
    if (!this.message || !this.embed || count === this.shownFinders) return;
    this.shownFinders = count;
    this.embed.setFooter({ text: `${count} joueur${count > 1 ? 's ont' : ' a'} trouvé` });
    await this.message.edit({ embeds: [this.embed] });
  }

  private async revealQuestion(): Promise<void> {
    clearInterval(this.counter);
    const question = this.state.current;
    const finders = this.state.reveal();
    if (!question || !this.message) return;

    const shown = finders.slice(0, SHOWN_FINDERS).map(finderLine).join('\n');
    const more = finders.length > SHOWN_FINDERS ? `\n… et ${finders.length - SHOWN_FINDERS} autres` : '';
    const revealed = withImage(new EmbedBuilder()
      .setTitle(`Question ${this.state.questionNumber}/${this.state.questions.length} · ${clip(question.boxName, 200)}`)
      .setDescription(`${clip(question.question, MAX_QUESTION_TEXT)}\n\nRéponse : **${clip(correctAnswerText(question), 300)}**\n\n${shown ? shown + more : 'Personne n\'a trouvé.'}`),
    question.answerImageUrl ?? question.imageUrl);

    await this.message.edit({ embeds: [revealed], components: [], allowedMentions: NO_MENTIONS });
    if (this.finished) return;
    this.timer = setTimeout(() => this.run(() => this.nextQuestion()), NEXT_QUESTION_DELAY_MS);
  }

  /** Arrêt normal, /stop, erreur ou arrêt du bot : scores enregistrés et podium posté en parallèle. */
  async finish(title: string, postPodium = true): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    clearTimeout(this.timer);
    clearInterval(this.counter);
    if (games.get(this.channel.id) === this) games.delete(this.channel.id);

    const ranking = this.state.ranking();
    const podium = ranking.slice(0, SHOWN_FINDERS).map((player, i) =>
      i < 3 ? `**${i + 1}. ${player.name} : ${player.score} pts**` : `${i + 1}. ${player.name} : ${player.score} pts`);
    await Promise.all([
      saveScores(this.guildId, this.channel.id, this.sessionId, this.boxNames, ranking)
        .catch((error: Error) => console.error(`Scores non enregistrés (${this.sessionId}) :`, error)),
      postPodium
        ? this.send(`**${title}**\n${podium.join('\n') || 'Personne n\'a marqué de point.'}`).catch(() => undefined)
        : undefined,
    ]);
  }

  async answer(interaction: GameComponentInteraction, kind: string, questionNumber: number, optionIndex: number): Promise<void> {
    if (kind === 'answer') {
      if (questionNumber !== this.state.questionNumber || !this.state.isOpen) {
        await interaction.reply({ content: OUTCOME_TEXT.closed, flags: MessageFlags.Ephemeral });
        return;
      }
      if (this.state.hasFound(interaction.user.id)) {
        await interaction.reply({ content: OUTCOME_TEXT['already-found'], flags: MessageFlags.Ephemeral });
        return;
      }
      if (!interaction.isButton()) return;
      await interaction.showModal(new ModalBuilder()
        .setCustomId(`game:${this.sessionId}:modal:${questionNumber}`)
        .setTitle(`Question ${questionNumber}`)
        .addLabelComponents(new LabelBuilder()
          .setLabel('Ta réponse')
          .setTextInputComponent(new TextInputBuilder().setCustomId('answer').setStyle(TextInputStyle.Short).setMaxLength(MAX_ANSWER_LENGTH))));
      return;
    }

    const text = interaction.isModalSubmit() ? interaction.fields.getTextInputValue('answer')
      : interaction.isStringSelectMenu() ? interaction.values.join(',')
        : QCM_LABELS[optionIndex];
    const outcome = this.state.submit(questionNumber, interaction.user.id, displayName(interaction), text, Date.now());
    await interaction.reply({ content: OUTCOME_TEXT[outcome], flags: MessageFlags.Ephemeral });
  }

  private send(content: string): Promise<PostedMessage> {
    return this.channel.send({ content, allowedMentions: NO_MENTIONS });
  }

  /**
   * Exécute une étape planifiée. Toute erreur termine la partie (salon libéré, scores
   * enregistrés) plutôt que de la laisser figée ; le podium n'est pas posté si le salon a disparu.
   */
  private run(step: () => Promise<void>): void {
    if (this.finished) return;
    step().catch((error: Error) => {
      const channelGone = error instanceof DiscordAPIError && CHANNEL_GONE_CODES.has(error.code);
      console.error(`Partie ${this.sessionId} arrêtée :`, error);
      this.finish('Quiz arrêté (erreur)', !channelGone);
    });
  }
}

const games = new Map<string, Game>();

export function isGameRunning(channelId: string): boolean {
  return games.has(channelId);
}

/**
 * Démarre une partie. Le salon est réservé avant le premier `await` : deux lancements
 * dans le même salon ne peuvent pas démarrer tous les deux. Retourne false si une partie y tourne déjà.
 */
export async function startGame(channel: GameChannel, guildId: string, launcherName: string, questions: Question[], seconds: number, boxNames: string[], requestedCount: number): Promise<boolean> {
  if (games.has(channel.id)) return false;
  const game = new Game(channel, guildId, seconds, boxNames, questions);
  games.set(channel.id, game);
  try {
    await game.start(launcherName, requestedCount);
  } catch (error) {
    if (games.get(channel.id) === game) games.delete(channel.id);
    throw error;
  }
  return true;
}

export async function stopGame(channelId: string): Promise<boolean> {
  const game = games.get(channelId);
  if (!game) return false;
  await game.finish('Quiz arrêté');
  return true;
}

export async function stopAllGames(): Promise<void> {
  await Promise.all([...games.values()].map(game => game.finish('Quiz arrêté (redémarrage du bot)')));
}

export async function handleGameComponent(interaction: GameComponentInteraction): Promise<void> {
  const [, sessionId, kind, questionNumber, optionIndex] = interaction.customId.split(':');
  const game = interaction.channelId ? games.get(interaction.channelId) : undefined;
  if (!game || game.sessionId !== sessionId) {
    await interaction.reply({ content: OUTCOME_TEXT.closed, flags: MessageFlags.Ephemeral });
    return;
  }
  await game.answer(interaction, kind, Number(questionNumber), Number(optionIndex ?? 0));
}
