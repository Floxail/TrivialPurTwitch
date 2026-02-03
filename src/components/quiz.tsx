import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cleanValueLight, removeArticles, sorensenDiceScore } from 'helpers';
import { useEffect, useRef, useState } from 'react';
import { Button, ProgressBar, Modal, Form, Alert } from 'react-bootstrap';
import { Client, Options } from 'tmi.js';
import { useAuthStore } from './store/auth-store';
import { useGlobalStore } from './store/global-store';
import { Answer, Player, usePlayerStore } from './store/player-store';
import { TwitchMode, useSettingsStore } from './store/settings-store';
import { categoryColors, categoryNames, QuestionType, useQuestionsStore } from './store/questions-store';
import { QuizMode, useGameStore } from './store/game-store';
import Podium from './podium';
import Leaderboard from './leaderboard';


let twitchCallback: (nick: string, tid: string, msg: string) => void = () => {};

const SCORE_CMD_DELAY = 2000;

// Labels pour les options QCM
const QCM_LABELS = ['A', 'B', 'C', 'D'];

const Quiz = () => {
	const twitchClient = useRef<Client | null>(null);
	const questionTimer = useRef<NodeJS.Timeout | null>(null);
	const scoreCommandTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
	const delayedScoreCommands = useRef<string[]>([]);

	const settingsStore = useSettingsStore();
	// Sélecteurs pour éviter les re-renders inutiles
	const boxes = useQuestionsStore((state) => state.boxes);
	const cumulativeScoresInQuizMode = useQuestionsStore((state) => state.cumulativeScoresInQuizMode);
	const questionsStore = useQuestionsStore(); // Pour les actions
	const gameStore = useGameStore();
	const setSubtitle = useGlobalStore((state) => state.setSubtitle);

	const initPlayer = usePlayerStore((state) => state.initPlayer);
	const recordAnswers = usePlayerStore((state) => state.recordAnswers);
	const getPlayersFromNick = usePlayerStore((state) => state.getPlayers);

	const twitchNick = useAuthStore((state) => state.twitchNick);
	const getTwitchToken = useAuthStore((state) => state.getTwitchOAuthToken);
	const twitchToken = getTwitchToken(); // Get deobfuscated token

	// Utiliser le temps de réponse configuré dans les settings
	const questionTimeLimit = settingsStore.questionTimeLimit;
	const [timeLeft, setTimeLeft] = useState(questionTimeLimit);
	const [questionRevealed, setQuestionRevealed] = useState(false);
	const [podiumDisplayed, setPodiumDisplayed] = useState(false);
	const [waitingForRedemption, setWaitingForRedemption] = useState(true);
	const lastAnswerersRef = useRef<{ nick: string; isFirst: boolean }[]>([]);

	// Refs pour éviter les problèmes de closure dans onProposition
	const questionRevealedRef = useRef(false);
	const currentAnswerersRef = useRef<{ nick: string; isFirst: boolean }[]>([]);
	// Track des tentatives QCM (un viewer ne peut répondre qu'une seule fois en QCM)
	const qcmAttemptsRef = useRef<Set<string>>(new Set());

	// États pour le modal de sélection de quiz
	const [showModeSelector, setShowModeSelector] = useState(false);
	const [pendingQuizRequester, setPendingQuizRequester] = useState<string>('');
	const [selectedBoxName, setSelectedBoxName] = useState<string>('');
	const [quizQuestionCount, setQuizQuestionCount] = useState<number>(10);
	const [modeError, setModeError] = useState<string>('');
	const [balanceCategories, setBalanceCategories] = useState<boolean>(true); // Mode couleurs équilibrées

	const activeQuiz = gameStore.activeQuiz;
	const currentQuestion = activeQuiz?.questions[activeQuiz.currentQuestionIndex];

	// Vérifie si la question actuelle est un QCM
	const isQcmQuestion = currentQuestion?.questionType === QuestionType.QCM &&
		currentQuestion?.qcmOptions && currentQuestion.qcmOptions.length === 4;

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

			setSubtitle(`Quiz - Question ${questionNum}/${totalQuestions}`);
			setWaitingForRedemption(false);

			// Démarrer le timer pour chaque question
			startQuestionTimer();
		} else {
			setSubtitle('En attente...');
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

		// Écoute des redemptions de points de chaîne (custom-reward-id)
		twitchClient.current.on('message', (_channel: any, _tags: any, _message: any, _self: any) => {
			if (_self) return;

			// Vérifier si c'est une redemption de points de chaîne
			if (_tags['custom-reward-id']) {
				const rewardTitle = _tags['msg-id'] || '';
				const userInput = _message.trim();
				const userName = _tags['display-name'];
				const userId = _tags['user-id'];

				console.log('TRIVIALPURTWITCH RECLAMÉE:', {
					reward: rewardTitle,
					input: userInput,
					user: userName
				});

				handleChannelPointsRedemption(userName, userId, userInput);
			}
		});
	};

	const startQuestionTimer = () => {
		if (questionTimer.current) {
			clearInterval(questionTimer.current);
		}

		// Réinitialiser les états
		setTimeLeft(questionTimeLimit);
		currentAnswerersRef.current = [];
		lastAnswerersRef.current = [];
		qcmAttemptsRef.current = new Set(); // Reset des tentatives QCM
		setQuestionRevealed(false);
		questionRevealedRef.current = false;

		// Démarrer le timer
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
		// 1. Figer l'état immédiat
		if (questionTimer.current) {
			clearInterval(questionTimer.current);
		}

		// Copie locale des répondants pour figer le tableau à cet instant précis
		const finalAnswerers = [...currentAnswerersRef.current];
		lastAnswerersRef.current = finalAnswerers;

		setQuestionRevealed(true);
		questionRevealedRef.current = true;

		// Récupérer l'état frais du store pour être sûr de l'index
		const currentQuizState = useGameStore.getState().activeQuiz;

		if (finalAnswerers.length > 0 && currentQuizState) {
			// Calculer les combos
			const previousQuestionIndex = currentQuizState.currentQuestionIndex - 1;
			const previousAnswerers = previousQuestionIndex >= 0
				? currentQuizState.answers.get(previousQuestionIndex) || []
				: [];

			const answers = finalAnswerers.map((answerer, index) => {
				const isCombo = previousAnswerers.includes(answerer.nick);
				return new Answer(answerer.nick, index === 0, isCombo, 0);
			});

			// Enregistrer les points
			recordAnswers(answers);
			gameStore.recordAnswer(currentQuizState.currentQuestionIndex, finalAnswerers[0].nick);
			usePlayerStore.getState().backup();
		}

		// Message chat
		if (settingsStore.chatNotifications && twitchNick) {
			// On utilise currentQuizState pour être safe
			const safeQuestion = currentQuizState?.questions[currentQuizState.currentQuestionIndex];

			if (finalAnswerers.length > 0) {
				const answerText = safeQuestion?.questionType === QuestionType.QCM && safeQuestion?.qcmCorrectIndex !== undefined
					? `${QCM_LABELS[safeQuestion.qcmCorrectIndex]} - ${safeQuestion?.answer}`
					: safeQuestion?.answer;
				const msg = `✅ Bonne réponse : ${answerText}! Bravo à ${finalAnswerers.slice(0, 5).map(a => a.nick).join(', ')}${finalAnswerers.length > 5 ? ', ...' : ''}`;
				twitchClient.current?.say(twitchNick, msg);
			} else {
				const answerText = safeQuestion?.questionType === QuestionType.QCM && safeQuestion?.qcmCorrectIndex !== undefined
					? `${QCM_LABELS[safeQuestion.qcmCorrectIndex]} - ${safeQuestion?.answer}`
					: safeQuestion?.answer;
				twitchClient.current?.say(twitchNick, `⏱️ Temps écoulé ! La réponse était : ${answerText}`);
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

	// Gestion des redemptions de points de chaîne
	const handleChannelPointsRedemption = (nick: string, tid: string, userInput: string) => {
		initPlayer(nick, tid);

		const trimmedInput = userInput.trim();

		// Vérifier si c'est un nombre (nombre de questions)
		const questionCount = parseInt(trimmedInput);

		if (!isNaN(questionCount) && trimmedInput === questionCount.toString()) {
			// L'utilisateur a entré un nombre de questions
			setPendingQuizRequester(nick);
			setQuizQuestionCount(questionCount);
			setShowModeSelector(true);
		} else {
			// L'utilisateur a entré un nom de boîte
			setPendingQuizRequester(nick);
			setSelectedBoxName(trimmedInput);
			setShowModeSelector(true);
		}
	};

	const onProposition = (nick: string, tid: string, message: string) => {
		// Si la question est révélée, on ignore TOUTES les propositions
		if (questionRevealedRef.current) {
			return;
		}

		// Commande !score - vérifier AVANT addEveryUser
		if (message.toLowerCase() === '!score') {
			handleScoreCommand(nick);
			return;
		}

		if (settingsStore.addEveryUser) {
			initPlayer(nick, tid);
		}

		// Commande !quiz - UNIQUEMENT pour le streamer
		if (message.toLowerCase().startsWith('!quiz')) {
			// Vérifier si c'est le streamer
			if (nick.toLowerCase() !== twitchNick?.toLowerCase()) {
				return;
			}

			const args = message.substring(5).trim().split(' ');

			// Format: !quiz BoxName [nombre]
			if (args.length === 0 || args[0] === '') {
				// Pas d'arguments = ouvrir le sélecteur
				setPendingQuizRequester(nick);
				setShowModeSelector(true);
				return;
			}

			const lastArg = args[args.length - 1];
			const questionCount = parseInt(lastArg);

			if (!isNaN(questionCount)) {
				// Dernier arg est un nombre
				const boxName = args.slice(0, -1).join(' ');
				setPendingQuizRequester(nick);
				setSelectedBoxName(boxName);
				setQuizQuestionCount(questionCount);
				setShowModeSelector(true);
			} else {
				// Pas de nombre = ouvrir le sélecteur avec la boîte pré-remplie
				const boxName = args.join(' ');
				setPendingQuizRequester(nick);
				setSelectedBoxName(boxName);
				setShowModeSelector(true);
			}
			return;
		}

		// Vérification des réponses
		const currentActiveQuiz = gameStore.activeQuiz;
		const currentActiveQuestion = currentActiveQuiz?.questions[currentActiveQuiz.currentQuestionIndex];

		if (currentActiveQuiz && currentActiveQuestion && !questionRevealedRef.current) {
			// Vérifier si le joueur a déjà répondu
			if (currentAnswerersRef.current.find((a) => a.nick === nick)) {
				return;
			}

			let isCorrect = false;

			// Mode QCM : vérifier si la réponse est A, B, C ou D
			if (currentActiveQuestion.questionType === QuestionType.QCM &&
				currentActiveQuestion.qcmOptions &&
				currentActiveQuestion.qcmCorrectIndex !== undefined) {

				const answer = message.trim().toUpperCase();
				const correctIndex = currentActiveQuestion.qcmCorrectIndex;

				// Vérifier si c'est une réponse QCM valide (A, B, C, D ou 1, 2, 3, 4)
				const isValidQcmAnswer = QCM_LABELS.includes(answer) || ['1', '2', '3', '4'].includes(answer);

				if (isValidQcmAnswer) {
					// En QCM, un viewer ne peut répondre qu'UNE SEULE FOIS (pas de seconde chance)
					if (qcmAttemptsRef.current.has(nick)) {
						return; // Déjà tenté, ignorer
					}
					// Enregistrer la tentative
					qcmAttemptsRef.current.add(nick);

					// Vérifier si c'est la bonne réponse
					if (answer === QCM_LABELS[correctIndex] || answer === String(correctIndex + 1)) {
						isCorrect = true;
					}
				}
				// Si ce n'est pas une réponse QCM valide, on ignore silencieusement
			} else {
				// Mode réponse libre (comportement existant)
				const proposition = cleanValueLight(message);
				const propositionNoArticles = removeArticles(proposition);

				const correctAnswer = cleanValueLight(currentActiveQuestion.answer);
				const alternativeAnswers = currentActiveQuestion.alternativeAnswers?.map(cleanValueLight) || [];

				// Fonction pour vérifier la similarité avec tolérance améliorée
				const checkMatch = (answer: string, prop: string, propNoArticles: string) => {
					const answerNoArticles = removeArticles(answer);

					// Vérification exacte (avec et sans articles)
					if (answer === prop || answerNoArticles === propNoArticles) {
						return true;
					}

					// Vérification de sous-chaîne pour réponses similaires
					const minLength = Math.min(answerNoArticles.length, propNoArticles.length);
					const maxLength = Math.max(answerNoArticles.length, propNoArticles.length);

					if (maxLength - minLength <= 2 && minLength >= 4) {
						if (answerNoArticles.includes(propNoArticles) || propNoArticles.includes(answerNoArticles)) {
							return true;
						}
					}

					// Pour les réponses plus longues
					if (minLength >= 5) {
						const requiredLength = Math.ceil(answerNoArticles.length * 0.8);
						if (propNoArticles.length >= requiredLength && answerNoArticles.includes(propNoArticles)) {
							return true;
						}
						if (answerNoArticles.length >= requiredLength && propNoArticles.includes(answerNoArticles)) {
							return true;
						}
					}

					// Score de similarité
					if (sorensenDiceScore(answerNoArticles, propNoArticles) >= 0.70) {
						return true;
					}
					if (sorensenDiceScore(answer, prop) >= 0.75) {
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
			}

			if (isCorrect) {
				initPlayer(nick, tid);
				const isFirst = currentAnswerersRef.current.length === 0;
				const newAnswerer = { nick, isFirst };
				currentAnswerersRef.current = [...currentAnswerersRef.current, newAnswerer];
			}
		}
	};

	twitchCallback = onProposition;

	// Lancer le quiz
	const handleStartQuiz = () => {
		if (!selectedBoxName) {
			alert('⚠️ Veuillez sélectionner une boîte');
			return;
		}

		let questions: ReturnType<typeof questionsStore.generateRandomQuiz>;
		let displayBoxName = selectedBoxName;

		// Mode "Toutes les boîtes"
		if (selectedBoxName === '__ALL_BOXES__') {
			questions = questionsStore.generateRandomQuizAllBoxes(quizQuestionCount, balanceCategories);
			displayBoxName = balanceCategories ? 'Mix équilibré' : 'Mix aléatoire';
		} else {
			const box = questionsStore.getBoxByName(selectedBoxName);
			if (!box) {
				setModeError(`❌ La boîte "${selectedBoxName}" n'existe pas`);
				return;
			}
			questions = questionsStore.generateRandomQuiz(selectedBoxName, quizQuestionCount);
		}

		if (!questions || questions.length === 0) {
			setModeError(`❌ Impossible de générer le quiz (pas assez de questions)`);
			return;
		}

		// Sauvegarder le requester avant de fermer le modal
		const requester = pendingQuizRequester;

		// Démarrer le quiz dans le store
		gameStore.startQuiz(QuizMode.QUIZ, displayBoxName, questions);

		// Gérer les scores cumulatifs
		if (!cumulativeScoresInQuizMode) {
			usePlayerStore.getState().clear();
		}

		// Fermer le modal et réinitialiser
		setShowModeSelector(false);
		setPendingQuizRequester('');
		setSelectedBoxName('');
		setQuizQuestionCount(10);
		setModeError('');

		// Envoyer le message de lancement et la première question dans le chat
		if (twitchNick && questions) {
			twitchClient.current?.say(twitchNick, `🎲 Quiz lancé pour ${requester} ! ${displayBoxName} - ${questions.length} questions`);

			// Envoyer la première question après 1 seconde
			setTimeout(() => {
				const currentActiveQuiz = useGameStore.getState().activeQuiz;
				if (currentActiveQuiz && currentActiveQuiz.questions.length > 0) {
					const firstQuestion = currentActiveQuiz.questions[0];
					let questionMsg = `❓ Question 1/${currentActiveQuiz.questions.length} : ${firstQuestion.question}`;

					// Ajouter les options QCM si applicable
					if (firstQuestion.questionType === QuestionType.QCM && firstQuestion.qcmOptions) {
						questionMsg += ` | ${firstQuestion.qcmOptions.map((opt, i) => `${QCM_LABELS[i]}) ${opt}`).join(' | ')}`;
					}

					twitchClient.current?.say(twitchNick, questionMsg);
				}
			}, 1000);
		}
	};

	// Terminer la session (pour mode cumulatif)
	const handleEndSession = () => {
		setPodiumDisplayed(true);
		usePlayerStore.getState().clear();
		if (twitchNick) {
			twitchClient.current?.say(twitchNick, '🏆 Session terminée ! Scores réinitialisés.');
		}
	};

	const handleNextQuestion = () => {
		// Si la question n'est pas encore révélée, révéler d'abord
		if (!questionRevealed) {
			handleRevealAnswer();
			return;
		}

		// 1. Nettoyage de sécurité
		if (questionTimer.current) {
			clearInterval(questionTimer.current);
		}

		// 2. Vérifier s'il reste des questions
		const storeState = useGameStore.getState();
		const currentQuiz = storeState.activeQuiz;

		if (!currentQuiz) return;

		const nextIndex = currentQuiz.currentQuestionIndex + 1;
		const totalQuestions = currentQuiz.totalQuestions;

		if (nextIndex >= totalQuestions) {
			// C'est fini
			gameStore.endQuiz();
			setPodiumDisplayed(true);
			if (twitchNick) {
				twitchClient.current?.say(twitchNick, '🎉 Quiz terminé ! Bravo à tous les participants !');
			}
			return;
		}

		// 3. Transition
		setTimeout(() => {
			gameStore.nextQuestion();

			const updatedStore = useGameStore.getState();
			const newQuiz = updatedStore.activeQuiz;

			if (newQuiz) {
				const newQuestion = newQuiz.questions[newQuiz.currentQuestionIndex];
				const questionNum = newQuiz.currentQuestionIndex + 1;

				if (settingsStore.chatNotifications && twitchNick) {
					let questionMsg = `❓ Question ${questionNum}/${newQuiz.totalQuestions} : ${newQuestion.question}`;

					// Ajouter les options QCM si applicable
					if (newQuestion.questionType === QuestionType.QCM && newQuestion.qcmOptions) {
						questionMsg += ` | ${newQuestion.qcmOptions.map((opt, i) => `${QCM_LABELS[i]}) ${opt}`).join(' | ')}`;
					}

					twitchClient.current?.say(twitchNick, questionMsg);
				}

				startQuestionTimer();
			}
		}, 1000);
	};

	const handleRevealAnswer = () => {
		if (questionTimer.current) {
			clearInterval(questionTimer.current);
		}

		if (!questionRevealed) {
			handleTimeUp();
		}
	};

	const handleSkipQuestion = () => {
		if (questionTimer.current) {
			clearInterval(questionTimer.current);
		}
		setQuestionRevealed(true);
		questionRevealedRef.current = true;
	};

	const progressPercent = (timeLeft / questionTimeLimit) * 100;

	// Vérifie si le mode cumulatif est actif

	return (
		<>
			{/* Modal de sélection du quiz */}
			<Modal
				show={showModeSelector}
				onHide={() => {
					setShowModeSelector(false);
					setSelectedBoxName('');
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

					{/* Sélection de la boîte */}
					<Form.Group className="mb-3">
						<Form.Label>Boîte de questions</Form.Label>
						<Form.Select
							value={selectedBoxName}
							onChange={(e) => {
								setSelectedBoxName(e.target.value);
								setModeError('');
							}}
						>
							<option value="">Sélectionner une boîte...</option>
							<option value="__ALL_BOXES__">🎨 Toutes les boîtes (couleurs mélangées)</option>
							{boxes.map(box => (
								<option key={box.name} value={box.name}>
									{box.name} ({box.totalQuestions} questions)
								</option>
							))}
						</Form.Select>
					</Form.Group>

					{/* Option équilibrer les catégories - visible uniquement en mode "Toutes les boîtes" */}
					{selectedBoxName === '__ALL_BOXES__' && (
						<Form.Group className="mb-3">
							<Form.Check
								type="switch"
								id="balanceCategories"
								label="Équilibrer les catégories (une question de chaque couleur en rotation)"
								checked={balanceCategories}
								onChange={(e) => setBalanceCategories(e.target.checked)}
							/>
							<Form.Text className="text-muted">
								{balanceCategories
									? '📊 Les questions seront réparties équitablement entre les 6 catégories'
									: '🎲 Les questions seront choisies aléatoirement sans équilibrage'}
							</Form.Text>
						</Form.Group>
					)}

					{/* Nombre de questions */}
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
							setQuizQuestionCount(10);
							setModeError('');
						}}
					>
						Annuler
					</Button>
					<Button
						variant="primary"
						onClick={handleStartQuiz}
						disabled={!selectedBoxName}
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
									<FontAwesomeIcon icon={['fas', 'gift']} size="4x" color="var(--alt-text-color)" />
									<h3 className="mt-4">En attente...</h3>
									<div className="mt-3">
										<p className="text-muted">
											<strong>🎁 Pour les viewers :</strong> Utilisez vos <strong>points de chaîne</strong> !
										</p>
										<p className="text-muted" style={{ fontSize: '14px' }}>
											Entrez le nombre de questions souhaitées
										</p>
									</div>
									<div className="mt-4">
										<p className="text-muted">
											<strong>🎮 Pour le streamer :</strong> Commande <code>!quiz</code>
										</p>
										<Button
											variant="primary"
											size="lg"
											className="mt-2"
											onClick={() => {
												setPendingQuizRequester(twitchNick || 'Streamer');
												setShowModeSelector(true);
											}}
										>
											<FontAwesomeIcon icon={['fas', 'play']} className="me-2" />
											Lancer un Quiz
										</Button>

										{/* Bouton Terminer Session (si mode cumulatif activé) */}
										{cumulativeScoresInQuizMode && (
											<Button
												variant="warning"
												size="lg"
												className="mt-2 ms-2"
												onClick={handleEndSession}
											>
												<FontAwesomeIcon icon={['fas', 'flag-checkered']} className="me-2" />
												Terminer la session
											</Button>
										)}
									</div>
									{boxes.length > 0 && (
										<div className="mt-4 p-3" style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '10px', display: 'inline-block' }}>
											<p className="text-muted mb-2">
												<strong>📦 Boîtes disponibles :</strong>
											</p>
											<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
												{boxes.map(b => (
													<span key={b.name} style={{
														backgroundColor: '#ff60b7',
														color: 'white',
														padding: '4px 12px',
														borderRadius: '12px',
														fontSize: '13px'
													}}>
														{b.name}
													</span>
												))}
											</div>
										</div>
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
										{isQcmQuestion && <span className="ms-2">📋 QCM</span>}
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
										flexDirection: 'column',
										alignItems: 'center',
										justifyContent: 'center'
									}}>
										<h2 style={{ textAlign: 'center', margin: 0 }}>
											{currentQuestion.question}
										</h2>

										{/* Options QCM */}
										{isQcmQuestion && currentQuestion.qcmOptions && !questionRevealed && (
											<div className="qcm-options mt-4" style={{ width: '100%', maxWidth: '600px' }}>
												<div className="row g-2">
													{currentQuestion.qcmOptions.map((option, index) => (
														<div key={index} className="col-6">
															<div style={{
																backgroundColor: 'var(--bg-color)',
																border: '2px solid var(--border-color)',
																borderRadius: '10px',
																padding: '15px',
																textAlign: 'center',
																fontSize: '16px'
															}}>
																<strong style={{ color: '#ff60b7' }}>{QCM_LABELS[index]})</strong> {option}
															</div>
														</div>
													))}
												</div>
												<p className="text-center mt-3 text-muted" style={{ fontSize: '14px' }}>
													Répondez avec <strong>A</strong>, <strong>B</strong>, <strong>C</strong> ou <strong>D</strong> dans le chat
												</p>
											</div>
										)}
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
											<h3>
												✅ {isQcmQuestion && currentQuestion.qcmCorrectIndex !== undefined
													? `${QCM_LABELS[currentQuestion.qcmCorrectIndex]} - ${currentQuestion.answer}`
													: currentQuestion.answer}
											</h3>
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
										{activeQuiz.currentQuestionIndex + 1 >= activeQuiz.totalQuestions ? (
											<>
												<FontAwesomeIcon icon={['fas', 'trophy']} color="#ff60b7" size="lg" />
												<b>PODIUM</b>
											</>
										) : (
											<>
												<FontAwesomeIcon icon={['fas', 'step-forward']} color="#ff60b7" size="lg" />
												<b>SUIVANT</b>
											</>
										)}
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
										<FontAwesomeIcon icon={['fas', 'eye']} color="#ff60b7" size="lg" />
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
