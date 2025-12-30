import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cleanValueLight, removeArticles, sorensenDiceScore } from 'helpers';
import React, { useEffect, useRef, useState } from 'react';
import { Button, ProgressBar, Modal, Form, Alert } from 'react-bootstrap';
import { Client, Options } from 'tmi.js';
import { useAuthStore } from './store/auth-store';
import { useGlobalStore } from './store/global-store';
import { Answer, Player, usePlayerStore } from './store/player-store';
import { TwitchMode, useSettingsStore } from './store/settings-store';
import { categoryColors, categoryNames, Question, TrivialCategory, QuizMode, useQuizStore } from './store/quiz-store-v2';
import Podium from './podium';
import Leaderboard from './leaderboard';

let twitchCallback: (nick: string, tid: string, msg: string) => void = () => {};

const QUESTION_TIME_LIMIT = 30; // secondes
const SCORE_CMD_DELAY = 2000;

const Quiz = () => {
	const twitchClient = useRef<Client | null>(null);
	const questionTimer = useRef<NodeJS.Timeout | null>(null);
	const scoreCommandTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
	const delayedScoreCommands = useRef<string[]>([]);

	const settingsStore = useSettingsStore();
	const quizStore = useQuizStore();
	const setSubtitle = useGlobalStore((state) => state.setSubtitle);

	const initPlayer = usePlayerStore((state) => state.initPlayer);
	const recordAnswers = usePlayerStore((state) => state.recordAnswers);
	const getPlayersFromNick = usePlayerStore((state) => state.getPlayers);

	const twitchNick = useAuthStore((state) => state.twitchNick);
	const twitchToken = useAuthStore((state) => state.twitchOauthToken);

	const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
	const [currentAnswerers, setCurrentAnswerers] = useState<{ nick: string; isFirst: boolean }[]>([]);
	const [questionRevealed, setQuestionRevealed] = useState(false);
	const [podiumDisplayed, setPodiumDisplayed] = useState(false);
	const [waitingForRedemption, setWaitingForRedemption] = useState(true);
	const lastAnswerersRef = useRef<{ nick: string; isFirst: boolean }[]>([]);

	// États pour le modal de sélection de carte/quiz
	const [showModeSelector, setShowModeSelector] = useState(false);
	const [pendingQuizRequester, setPendingQuizRequester] = useState<string>('');
	const [selectedMode, setSelectedMode] = useState<QuizMode>(QuizMode.CARD);
	const [selectedBoxName, setSelectedBoxName] = useState<string>('');
	const [cardNumber, setCardNumber] = useState<string>('');
	const [quizQuestionCount, setQuizQuestionCount] = useState<number>(10);
	const [modeError, setModeError] = useState<string>('');

	const activeQuiz = quizStore.activeQuiz;
	const currentQuestion = activeQuiz?.questions[activeQuiz.currentQuestionIndex];

	useEffect(() => {
		if (twitchNick && twitchToken) {
			console.log(`Twitch channel changed to ${twitchNick}`);
			twitchConnection(twitchNick, settingsStore.chatNotifications);
			return () => {
				twitchDisconnection();
			};
		}
	}, [twitchNick, twitchToken]);

	useEffect(() => {
		if (activeQuiz) {
			const questionNum = activeQuiz.currentQuestionIndex + 1;
			const totalQuestions = activeQuiz.totalQuestions;
			const modeText = activeQuiz.mode === QuizMode.CARD
				? `Carte #${activeQuiz.cardNumber}`
				: 'Quiz';
			const categoryText = activeQuiz.mode === QuizMode.CARD
				? ` - ${categoryNames[activeQuiz.questions[activeQuiz.currentQuestionIndex]?.category || 0]}`
				: '';

			setSubtitle(`${modeText} - Question ${questionNum}/${totalQuestions}${categoryText}`);
			setWaitingForRedemption(false);
			startQuestionTimer();
		} else {
			setSubtitle('En attente de points de chaîne...');
			setWaitingForRedemption(true);
		}

		return () => {
			if (questionTimer.current) {
				clearInterval(questionTimer.current);
			}
		};
	}, [activeQuiz?.currentQuestionIndex]);

	const twitchDisconnection = () => {
		console.log('Disconnecting from Twitch...');
		if (twitchClient.current !== null) {
			twitchClient.current.disconnect();
		}
	};

	const twitchConnection = (chan: string, chatNotifications: boolean) => {
		let opts: Options = {
			options: {
				skipUpdatingEmotesets: true,
			},
			channels: [chan],
		};
		if (chatNotifications) {
			opts.identity = {
				username: 'foo',
				password: twitchToken || '',
			};
		}
		twitchClient.current = new Client(opts);
		twitchClient.current.connect();

		// Écoute des messages du chat
		twitchClient.current.on('message', (_channel: any, _tags: any, _message: any, _self: any) => {
			if (_self) return;
			if (_tags['message-type'] !== 'whisper') {
				return twitchCallback(_tags['display-name'], _tags['user-id'], _message);
			}
		});

		// TODO: Écoute des redemptions de points de chaîne avec EventSub
		// L'API Twitch IRC ne permet pas d'écouter les redemptions directement
		// Il faudra utiliser EventSub pour cela
	};

	const startQuestionTimer = () => {
		if (questionTimer.current) {
			clearInterval(questionTimer.current);
		}

		setTimeLeft(QUESTION_TIME_LIMIT);
		setCurrentAnswerers([]);
		lastAnswerersRef.current = [];
		setQuestionRevealed(false);

		questionTimer.current = setInterval(() => {
			setTimeLeft((prev) => {
				if (prev <= 1) {
					if (questionTimer.current) {
						clearInterval(questionTimer.current);
					}
					handleTimeUp();
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
	};

	const handleTimeUp = () => {
		// Sauvegarder les répondants actuels AVANT de changer d'état
		lastAnswerersRef.current = [...currentAnswerers];
		setQuestionRevealed(true);

		// Attribution des points IMMÉDIATEMENT
		if (currentAnswerers.length > 0 && activeQuiz) {
			// Calculer les combos : un joueur fait un combo s'il a répondu à la question précédente
			const previousQuestionIndex = activeQuiz.currentQuestionIndex - 1;
			const previousAnswerers = previousQuestionIndex >= 0
				? activeQuiz.answers.get(previousQuestionIndex) || []
				: [];

			const answers = currentAnswerers.map((answerer, index) => {
				const isCombo = previousAnswerers.includes(answerer.nick);
				return new Answer(answerer.nick, index === 0, isCombo, 0);
			});

			recordAnswers(answers);
			quizStore.recordAnswer(activeQuiz.currentQuestionIndex, currentAnswerers[0].nick);

			// Sauvegarder en temps réel pour actualiser le leaderboard
			usePlayerStore.getState().backup();
		}

		// Message dans le chat APRÈS attribution des points
		if (settingsStore.chatNotifications && twitchNick) {
			if (currentAnswerers.length > 0) {
				const msg = `✅ Bonne réponse : ${currentQuestion?.answer}! Répondu par ${currentAnswerers.slice(0, 5).map(a => a.nick).join(', ')}${currentAnswerers.length > 5 ? '...' : ''}`;
				twitchClient.current?.say(twitchNick, msg);
			} else {
				twitchClient.current?.say(twitchNick, `⏱️ Temps écoulé ! La réponse était : ${currentQuestion?.answer}`);
			}
		}
	};

	const flushScoreCommands = () => {
		const msg = getPlayersFromNick(delayedScoreCommands.current)
			.map((player: Player) => `${player.nick} est #${player.rank} [${player.score} point${player.score > 1 ? 's' : ''}]`)
			.join(', ');

		if (msg && twitchNick) {
			twitchClient.current?.say(twitchNick, msg);
		}

		delayedScoreCommands.current = [];
		scoreCommandTimeout.current = undefined;
	};

	const handleScoreCommand = (nick: string) => {
		if (settingsStore.scoreCommandMode === TwitchMode.Whisper) {
			const player = getPlayersFromNick([nick])[0];
			if (!player) return;
			twitchClient.current?.whisper(nick, `Tu es #${player.rank} [${player.score} point${player.score > 1 ? 's' : ''}]`);
		} else if (settingsStore.scoreCommandMode === TwitchMode.Channel && twitchNick) {
			if (!scoreCommandTimeout.current) {
				scoreCommandTimeout.current = setTimeout(flushScoreCommands, SCORE_CMD_DELAY);
			}
			if (!delayedScoreCommands.current.includes(nick)) {
				delayedScoreCommands.current.push(nick);
			}
		}
	};

	const onProposition = (nick: string, tid: string, message: string) => {
		// Commande !score - vérifier AVANT addEveryUser
		if (message.toLowerCase() === '!score') {
			handleScoreCommand(nick);
			return;
		}

		if (settingsStore.addEveryUser) {
			initPlayer(nick, tid);
		}

		// Simulation de redemption (temporaire, à remplacer par EventSub)
		if (message.toLowerCase().startsWith('!quiz')) {
			const args = message.substring(5).trim().split(' ');

			// Format: !quiz carte BoxName  OU  !quiz BoxName 20
			if (args.length === 0 || args[0] === '') {
				// Pas d'arguments = ouvrir le sélecteur
				setPendingQuizRequester(nick);
				setShowModeSelector(true);
				if (twitchNick) {
					twitchClient.current?.say(twitchNick, `🎲 ${nick} demande un quiz ! Le streamer va choisir le mode...`);
				}
				return;
			}

			// Avec arguments
			const firstArg = args[0].toLowerCase();

			if (firstArg === 'carte') {
				// Mode CARTE: !quiz carte BoxName
				const boxName = args.slice(1).join(' ');
				setPendingQuizRequester(nick);
				setSelectedMode(QuizMode.CARD);
				setSelectedBoxName(boxName);
				setShowModeSelector(true);
				if (twitchNick) {
					twitchClient.current?.say(twitchNick, `🎲 ${nick} demande une carte de "${boxName}" ! Le streamer va choisir le numéro...`);
				}
			} else {
				// Mode QUIZ: !quiz BoxName [nombre]
				const lastArg = args[args.length - 1];
				const questionCount = parseInt(lastArg);

				if (!isNaN(questionCount)) {
					// Dernier arg est un nombre
					const boxName = args.slice(0, -1).join(' ');
					setPendingQuizRequester(nick);
					setSelectedMode(QuizMode.QUIZ);
					setSelectedBoxName(boxName);
					setQuizQuestionCount(questionCount);
					setShowModeSelector(true);
					if (twitchNick) {
						twitchClient.current?.say(twitchNick, `🎲 ${nick} demande un quiz de ${questionCount} questions sur "${boxName}" !`);
					}
				} else {
					// Pas de nombre = ouvrir le sélecteur avec la boîte pré-remplie
					const boxName = args.join(' ');
					setPendingQuizRequester(nick);
					setSelectedBoxName(boxName);
					setShowModeSelector(true);
					if (twitchNick) {
						twitchClient.current?.say(twitchNick, `🎲 ${nick} demande un quiz "${boxName}" ! Le streamer va choisir le mode...`);
					}
				}
			}
			return;
		}

		// Vérification des réponses
		if (activeQuiz && currentQuestion && !questionRevealed) {
			const proposition = cleanValueLight(message);
			const propositionNoArticles = removeArticles(proposition);

			// Vérifier si le joueur a déjà répondu
			if (currentAnswerers.find((a) => a.nick === nick)) {
				return;
			}

			// Vérifier la réponse
			const correctAnswer = cleanValueLight(currentQuestion.answer);
			const correctAnswerNoArticles = removeArticles(correctAnswer);
			const alternativeAnswers = currentQuestion.alternativeAnswers?.map(cleanValueLight) || [];

			let isCorrect = false;

			// Fonction pour vérifier la similarité avec tolérance améliorée
			const checkMatch = (answer: string, prop: string, propNoArticles: string) => {
				const answerNoArticles = removeArticles(answer);

				// Vérification exacte (avec et sans articles)
				if (answer === prop || answerNoArticles === propNoArticles) {
					return true;
				}

				// Vérification de sous-chaîne pour réponses courtes (sans articles)
				if (answerNoArticles.length >= 3 && propNoArticles.length >= 3) {
					if (answerNoArticles.includes(propNoArticles) || propNoArticles.includes(answerNoArticles)) {
						return true;
					}
				}

				// Vérification avec score de similarité (seuil plus permissif à 0.7)
				// D'abord sans articles
				if (sorensenDiceScore(answerNoArticles, propNoArticles) >= 0.7) {
					return true;
				}

				// Puis avec articles
				if (sorensenDiceScore(answer, prop) >= 0.7) {
					return true;
				}

				return false;
			};

			// Vérifier la réponse principale
			if (checkMatch(correctAnswer, proposition, propositionNoArticles)) {
				isCorrect = true;
			}

			// Vérifier les réponses alternatives
			if (!isCorrect) {
				for (const altAnswer of alternativeAnswers) {
					if (checkMatch(altAnswer, proposition, propositionNoArticles)) {
						isCorrect = true;
						break;
					}
				}
			}

			if (isCorrect) {
				initPlayer(nick, tid);
				const isFirst = currentAnswerers.length === 0;
				setCurrentAnswerers((prev) => [...prev, { nick, isFirst }]);
			}
		}
	};

	twitchCallback = onProposition;

	// Lancer le quiz avec le mode sélectionné
	const handleStartQuiz = () => {
		if (!selectedBoxName) {
			alert('⚠️ Veuillez sélectionner une boîte');
			return;
		}

		const box = quizStore.getBoxByName(selectedBoxName);
		if (!box) {
			setModeError(`❌ La boîte "${selectedBoxName}" n'existe pas`);
			return;
		}

		let questions: Question[] | null = null;
		let cardNum: number | undefined = undefined;

		if (selectedMode === QuizMode.CARD) {
			// Mode CARTE
			if (!cardNumber) {
				setModeError('⚠️ Veuillez entrer un numéro de carte');
				return;
			}

			const num = parseInt(cardNumber);
			if (!box.cardNumbers.includes(num)) {
				setModeError(`❌ La carte #${num} n'existe pas dans "${selectedBoxName}"`);
				return;
			}

			const card = quizStore.generateQuizCard(selectedBoxName, num);
			if (!card) {
				setModeError(`❌ Impossible de générer la carte #${num}`);
				return;
			}

			questions = card.questions;
			cardNum = num;

		} else {
			// Mode QUIZ
			questions = quizStore.generateRandomQuiz(selectedBoxName, quizQuestionCount);
			if (!questions) {
				setModeError(`❌ Impossible de générer le quiz`);
				return;
			}
		}

		// Démarrer le quiz
		quizStore.startQuiz(selectedMode, selectedBoxName, questions, cardNum);
		setQuestionRevealed(false);
		setCurrentAnswerers([]);
		startQuestionTimer();

		// Gérer les scores cumulatifs
		if (selectedMode === QuizMode.CARD && !quizStore.cumulativeScoresInCardMode) {
			// Réinitialiser les scores en mode CARTE si pas cumulatif
			usePlayerStore.getState().clear();
		} else if (selectedMode === QuizMode.QUIZ && !quizStore.cumulativeScoresInQuizMode) {
			// Réinitialiser les scores en mode QUIZ si pas cumulatif
			usePlayerStore.getState().clear();
		}

		// Message dans le chat
		if (twitchNick && questions) {
			const modeText = selectedMode === QuizMode.CARD
				? `Carte #${cardNum}`
				: `${questions.length} questions`;
			twitchClient.current?.say(twitchNick, `🎲 Quiz lancé pour ${pendingQuizRequester} ! ${selectedBoxName} - ${modeText}`);

			// Envoyer la première question (après un petit délai)
			setTimeout(() => {
				if (questions && questions.length > 0) {
					const catText = selectedMode === QuizMode.CARD
						? ` ${categoryNames[questions[0].category]}`
						: '';
					twitchClient.current?.say(twitchNick, `❓ Question 1/${questions.length}${catText} : ${questions[0].question}`);
				}
			}, 1000); // Délai de 1s après le message de lancement
		}

		// Fermer le modal et réinitialiser
		setShowModeSelector(false);
		setPendingQuizRequester('');
		setSelectedBoxName('');
		setCardNumber('');
		setQuizQuestionCount(10);
		setModeError('');
	};

	const handleNextQuestion = () => {
		// Si la question n'est pas encore révélée, révéler d'abord
		if (!questionRevealed) {
			handleRevealAnswer();
			return;
		}

		if (questionTimer.current) {
			clearInterval(questionTimer.current);
		}

		const hasNext = quizStore.nextQuestion();
		if (!hasNext) {
			// Quiz terminé
			quizStore.endQuiz();
			setPodiumDisplayed(true);
			if (twitchNick) {
				twitchClient.current?.say(twitchNick, '🎉 Quiz terminé ! Bravo à tous les participants !');
			}
		} else {
			// Envoyer la nouvelle question dans le chat (après un petit délai)
			setTimeout(() => {
				if (settingsStore.chatNotifications && twitchNick && activeQuiz) {
					const nextQuestionIndex = activeQuiz.currentQuestionIndex;
					const nextQuestion = activeQuiz.questions[nextQuestionIndex];
					const questionNum = nextQuestionIndex + 1;
					const totalQuestions = activeQuiz.totalQuestions;
					const catText = activeQuiz.mode === QuizMode.CARD
						? ` ${categoryNames[nextQuestion.category]}`
						: '';
					twitchClient.current?.say(twitchNick, `❓ Question ${questionNum}/${totalQuestions}${catText} : ${nextQuestion.question}`);
				}
			}, 500); // Délai de 500ms pour éviter le mélange avec le message précédent
		}
	};

	const handleRevealAnswer = () => {
		if (questionTimer.current) {
			clearInterval(questionTimer.current);
		}

		// Si pas encore révélé, révéler et attribuer les points immédiatement
		if (!questionRevealed) {
			handleTimeUp();
		}
	};

	const handleSkipQuestion = () => {
		if (questionTimer.current) {
			clearInterval(questionTimer.current);
		}
		setQuestionRevealed(true);
		if (twitchNick) {
			twitchClient.current?.say(twitchNick, `⏭️ Question passée. La réponse était : ${currentQuestion?.answer}`);
		}
	};

	const progressPercent = (timeLeft / QUESTION_TIME_LIMIT) * 100;

	return (
		<>
			{/* Modal de sélection de mode et carte/quiz */}
			<Modal
				show={showModeSelector}
				onHide={() => {
					setShowModeSelector(false);
					setSelectedBoxName('');
					setCardNumber('');
					setQuizQuestionCount(10);
					setModeError('');
				}}
				centered
				size="lg"
			>
				<Modal.Header closeButton>
					<Modal.Title>🎲 Configurer le quiz</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<p className="mb-3">
						<strong>{pendingQuizRequester}</strong> demande un quiz. Configurez les paramètres :
					</p>

					{/* Sélection du mode */}
					<Form.Group className="mb-4">
						<Form.Label><strong>Mode de jeu</strong></Form.Label>
						<div className="d-flex gap-2">
							<Button
								variant={selectedMode === QuizMode.CARD ? 'primary' : 'outline-primary'}
								onClick={() => setSelectedMode(QuizMode.CARD)}
								className="flex-fill"
							>
								🎴 Mode CARTE
								<div style={{ fontSize: '12px', marginTop: '5px' }}>
									6 questions (1 par catégorie)
								</div>
							</Button>
							<Button
								variant={selectedMode === QuizMode.QUIZ ? 'primary' : 'outline-primary'}
								onClick={() => setSelectedMode(QuizMode.QUIZ)}
								className="flex-fill"
							>
								📚 Mode QUIZ
								<div style={{ fontSize: '12px', marginTop: '5px' }}>
									Questions aléatoires
								</div>
							</Button>
						</div>
					</Form.Group>

					{/* Sélection de la boîte */}
					<Form.Group className="mb-3">
						<Form.Label>Boîte Trivial Pursuit</Form.Label>
						<Form.Select
							value={selectedBoxName}
							onChange={(e) => {
								setSelectedBoxName(e.target.value);
								setCardNumber('');
								setModeError('');
							}}
						>
							<option value="">Sélectionner une boîte...</option>
							{quizStore.getBoxes().map(box => (
								<option key={box.name} value={box.name}>
									{box.name} ({box.totalQuestions} questions)
								</option>
							))}
						</Form.Select>
					</Form.Group>

					{/* Mode CARTE : Sélection du numéro */}
					{selectedMode === QuizMode.CARD && selectedBoxName && (
						<Form.Group className="mb-3">
							<Form.Label>Numéro de carte *</Form.Label>
							<Form.Select
								required
								value={cardNumber}
								onChange={(e) => {
									setCardNumber(e.target.value);
									setModeError('');
								}}
							>
								<option value="">Sélectionner une carte...</option>
								{quizStore.getCardNumbersForBox(selectedBoxName).map(num => (
									<option key={num} value={num}>Carte #{num}</option>
								))}
							</Form.Select>
							{quizStore.getCardNumbersForBox(selectedBoxName).length === 0 && (
								<Form.Text className="text-danger d-block mt-2">
									⚠️ Aucune carte disponible dans cette boîte
								</Form.Text>
							)}
						</Form.Group>
					)}

					{/* Mode QUIZ : Nombre de questions */}
					{selectedMode === QuizMode.QUIZ && (
						<Form.Group className="mb-3">
							<Form.Label>Nombre de questions</Form.Label>
							<Form.Control
								type="number"
								min="1"
								max="550"
								value={quizQuestionCount}
								onChange={(e) => setQuizQuestionCount(parseInt(e.target.value) || 10)}
							/>
						</Form.Group>
					)}

					{/* Message d'erreur */}
					{modeError && (
						<Alert variant="danger" className="mt-2">
							{modeError}
						</Alert>
					)}
				</Modal.Body>
				<Modal.Footer>
					<Button
						variant="secondary"
						onClick={() => {
							setShowModeSelector(false);
							setSelectedBoxName('');
							setCardNumber('');
							setQuizQuestionCount(10);
							setModeError('');
						}}
					>
						Annuler
					</Button>
					<Button
						variant="primary"
						onClick={handleStartQuiz}
						disabled={!selectedBoxName || (selectedMode === QuizMode.CARD && !cardNumber)}
					>
						🚀 Lancer le quiz
					</Button>
				</Modal.Footer>
			</Modal>

			<div id="quiz">
				<div className="row mb-4">
					<div className="col-md-8">
						<div className="p-3 mb-2 bt-left-panel border rounded-3">
							{waitingForRedemption && (
								<div style={{ margin: 'auto', textAlign: 'center', padding: '50px' }}>
									<FontAwesomeIcon icon={['fas', 'question']} size="4x" color="var(--alt-text-color)" />
									<h3 className="mt-4">En attente de QUIZ</h3>
									<p className="text-muted">
										Utilisez <code>!quiz</code> dans le chat pour démarrer
										<br />
										(À remplacer par les points de chaîne avec EventSub)
									</p>
									{quizStore.getBoxes().length > 0 && (
										<p className="text-muted mt-4">
											<strong>Boîtes disponibles :</strong><br />
											{quizStore.getBoxes().map(b => b.name).join(', ')}
										</p>
									)}
								</div>
							)}

							{activeQuiz && currentQuestion && (
								<div style={{ flex: 1 }}>
									{/* Catégorie et timer */}
									<div className="mb-4">
										<div
											className="category-badge"
											style={{
												backgroundColor: categoryColors[currentQuestion.category],
												padding: '10px 20px',
												borderRadius: '20px',
												display: 'inline-block',
												color: 'white',
												fontWeight: 'bold',
												marginBottom: '15px'
											}}
										>
											{categoryNames[currentQuestion.category]}
										</div>

										<ProgressBar
											now={progressPercent}
											variant={progressPercent > 50 ? 'success' : progressPercent > 25 ? 'warning' : 'danger'}
											style={{ height: '30px', fontSize: '18px' }}
											label={`${timeLeft}s`}
										/>
									</div>

									{/* Question */}
									<div className="question-box" style={{
										backgroundColor: 'var(--panel-bg)',
										padding: '30px',
										borderRadius: '10px',
										marginBottom: '20px',
										minHeight: '150px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center'
									}}>
										<h2 style={{ textAlign: 'center', margin: 0 }}>
											{currentQuestion.question}
										</h2>
									</div>

									{/* Réponse révélée */}
									{questionRevealed && (
										<div className="answer-box" style={{
											backgroundColor: 'var(--icon-green-color)',
											padding: '20px',
											borderRadius: '10px',
											marginBottom: '20px',
											textAlign: 'center',
											color: 'white'
										}}>
											<h3>✅ {currentQuestion.answer}</h3>
										</div>
									)}

									{/* Liste des joueurs ayant répondu - seulement après révélation */}
									{questionRevealed && lastAnswerersRef.current.length > 0 && (
										<div className="answerers-list" style={{ marginTop: '20px' }}>
											<h5>Ont répondu correctement :</h5>
											<div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
												{lastAnswerersRef.current.map((answerer) => (
													<span
														key={answerer.nick}
														style={{
															backgroundColor: answerer.isFirst ? '#FF9800' : 'var(--panel-bg)',
															color: answerer.isFirst ? 'black' : 'inherit',
															padding: '5px 15px',
															borderRadius: '15px',
															fontWeight: answerer.isFirst ? 'bold' : 'normal'
														}}
													>
														{answerer.isFirst && '🥇 '}{answerer.nick}
													</span>
												))}
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					</div>

					<div className="col-md-4">
						<div id="player" className="mb-2 player" style={{ display: 'flex' }}>
							{activeQuiz && (
								<>
									<Button
										className="col-sm"
										id="nextButton"
										disabled={!questionRevealed}
										type="submit"
										size="sm"
										onClick={handleNextQuestion}
									>
										<FontAwesomeIcon icon={['fas', 'step-forward']} color="var(--spot-color)" size="lg" />
										<b>SUIVANT</b>
									</Button>
									&nbsp;
									<Button
										className="col-sm"
										id="revealButton"
										disabled={questionRevealed}
										type="submit"
										size="sm"
										onClick={handleRevealAnswer}
									>
										<FontAwesomeIcon icon={['fas', 'eye']} color="var(--spot-color)" size="lg" />
										<b>RÉVÉLER</b>
									</Button>
									&nbsp;
									<Button
										id="skipButton"
										disabled={questionRevealed}
										type="submit"
										size="sm"
										onClick={handleSkipQuestion}
										style={{ width: '35px' }}
									>
										<FontAwesomeIcon icon={['fas', 'step-forward']} size="lg" />
									</Button>
								</>
							)}
						</div>
						<Leaderboard />
					</div>
				</div>
			</div>
			{podiumDisplayed && <Podium onClose={() => setPodiumDisplayed(false)} />}
		</>
	);
};

export default Quiz;
