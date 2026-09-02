import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Client, Options } from 'tmi.js';
import { useAuthStore } from './store/auth-store';
import { useGlobalStore } from './store/global-store';
import { Answer, Player, usePlayerStore } from './store/player-store';
import { TwitchMode, useSettingsStore } from './store/settings-store';
import { QuestionType, useQuestionsStore, mergeServerHistory, countFreshInPool } from './store/questions-store';
import { QuizMode, useGameStore } from './store/game-store';
import Podium from './podium';
import Leaderboard from './leaderboard';
import { apiCreateReport, type ReportReason } from 'services/api-reports-service';
import { verifyAnswer } from 'services/answer-validator';
import { fetchHistory, recordHistory } from 'services/api-history-service';
import QuestionTimer, { TIMER_CIRCUMFERENCE } from './quiz-question-timer';
import QuizBoxGrid from './quiz-box-grid';
import QuizConfigModal, { type QuizOverrides } from './quiz-config-modal';
import QuizQuestionView, { QCM_LABELS } from './quiz-question-view';

const SCORE_CMD_DELAY = 2000;

const Quiz = () => {
	const twitchClient = useRef<Client | null>(null);
	const twitchCallbackRef = useRef<(nick: string, tid: string, msg: string) => void>(() => {});
	const questionTimer = useRef<number | null>(null); // requestAnimationFrame ID
	const timerEndTime = useRef<number>(0); // timestamp de fin du timer
	const timerCircleRef = useRef<SVGCircleElement | null>(null); // ref directe sur le cercle SVG
	const scoreCommandTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
	const delayedScoreCommands = useRef<string[]>([]);

	// Settings : on lit seulement les champs utilisés (settings change rarement, mais évite re-render au moindre toggle)
	const questionTimeLimit_setting = useSettingsStore(s => s.questionTimeLimit);
	const acceptanceDelay_setting = useSettingsStore(s => s.acceptanceDelay);
	const gracePeriodMs_setting = useSettingsStore(s => s.gracePeriodMs);
	const chatNotifications = useSettingsStore(s => s.chatNotifications);
	const scoreCommandMode = useSettingsStore(s => s.scoreCommandMode);
	const addEveryUser = useSettingsStore(s => s.addEveryUser);

	// Questions store : actions stables + slices spécifiques
	const allBoxes = useQuestionsStore(s => s.boxes);
	const cumulativeScoresInQuizMode = useQuestionsStore(s => s.cumulativeScoresInQuizMode);
	const allQuestions = useQuestionsStore(s => s.questions);
	const getBoxByName = useQuestionsStore(s => s.getBoxByName);
	const generateRandomQuiz = useQuestionsStore(s => s.generateRandomQuiz);
	const generateRandomQuizFromBoxes = useQuestionsStore(s => s.generateRandomQuizFromBoxes);
	const generateOrderedQuiz = useQuestionsStore(s => s.generateOrderedQuiz);

	// Game store : activeQuiz + actions
	const activeQuiz_state = useGameStore(s => s.activeQuiz);
	const startQuiz = useGameStore(s => s.startQuiz);
	const recordAnswer_game = useGameStore(s => s.recordAnswer);
	const nextQuestion = useGameStore(s => s.nextQuestion);
	const endQuiz = useGameStore(s => s.endQuiz);

	const setSubtitle = useGlobalStore((state) => state.setSubtitle);

	const initPlayer = usePlayerStore((state) => state.initPlayer);
	const recordAnswers = usePlayerStore((state) => state.recordAnswers);
	const getPlayersFromNick = usePlayerStore((state) => state.getPlayers);

	const twitchNick = useAuthStore((state) => state.twitchNick);
	const getTwitchToken = useAuthStore((state) => state.getTwitchOAuthToken);
	// Toutes les boîtes visibles (non cachées) — source de vérité
	const allVisibleBoxes = useMemo(() => allBoxes.filter(b => !b.hidden), [allBoxes]);

	const twitchToken = getTwitchToken(); // Get deobfuscated token

	// Overrides locaux (popup de config quiz) — ne modifient PAS les settings globaux
	const [activeQuestionTimeLimit, setActiveQuestionTimeLimit] = useState(questionTimeLimit_setting);
	const [activeAcceptanceDelay, setActiveAcceptanceDelay] = useState(acceptanceDelay_setting);
	const [activeGracePeriodMs, setActiveGracePeriodMs] = useState(gracePeriodMs_setting);
	const [onlyOneAnswer, setOnlyOneAnswer] = useState(false);
	const [penalizeWrong, setPenalizeWrong] = useState(false);
	const [unlimitedTimer, setUnlimitedTimer] = useState(false);
	const [strictSpelling, setStrictSpelling] = useState(false);
	const questionTimeLimit = activeQuestionTimeLimit;
	const [timeLeft, setTimeLeft] = useState(questionTimeLimit);
	// Refs pour lecture dans onProposition (évite closure stale)
	const onlyOneAnswerRef = useRef(false);
	const penalizeWrongRef = useRef(false);
	const unlimitedTimerRef = useRef(false);
	const strictSpellingRef = useRef(false);
	const activeGracePeriodMsRef = useRef(gracePeriodMs_setting);
	// Track des joueurs ayant déjà été pénalisés ce tour (une seule pénalité par question)
	const penalizedRef = useRef<Set<string>>(new Set());
	// File d'attente des pénalités à appliquer au moment de la révélation (pas avant)
	const pendingPenaltiesRef = useRef<{ nick: string; tid: string }[]>([]);
	const [questionRevealed, setQuestionRevealed] = useState(false);
	const [podiumDisplayed, setPodiumDisplayed] = useState(false);
	const lastAnswerersRef = useRef<{ nick: string; isFirst: boolean; answeredAt: number }[]>([]);

	// Refs pour éviter les problèmes de closure dans onProposition
	const questionRevealedRef = useRef(false);
	const currentAnswerersRef = useRef<{ nick: string; isFirst: boolean; answeredAt: number }[]>([]);
	// Track des tentatives QCM (un viewer ne peut répondre qu'une seule fois en QCM)
	const qcmAttemptsRef = useRef<Set<string>>(new Set());
	// Track des mauvaises tentatives en mode libre (pour le bonus "sans essai raté")
	// Session ID unique pour la sync des scores vers l'API
	const sessionIdRef = useRef<string>('');

	// États pour le modal de sélection de quiz
	const [showModeSelector, setShowModeSelector] = useState(false);
	const [pendingQuizRequester, setPendingQuizRequester] = useState<string>('');
	// null = toutes les boîtes sélectionnées, string[] = sélection spécifique
	const [selectedBoxNames, setSelectedBoxNames] = useState<null | string[]>(null);
	const [quizQuestionCount, setQuizQuestionCount] = useState<number>(10);
	const [modeError, setModeError] = useState<string>('');
	const [freshStats, setFreshStats] = useState<{ fresh: number; seen: number } | null>(null);
	const [historySyncing, setHistorySyncing] = useState(false);
	const lastHistorySyncRef = useRef<number>(0);

	// Boîte ordonnée : une seule boîte sélectionnée avec ordered=true
	const isOrderedBox = selectedBoxNames?.length === 1
		? (getBoxByName(selectedBoxNames[0])?.ordered ?? false)
		: false;

	// Regroupe les overrides pour la modale de config. L'état reste ici : les
	// réglages sont relus pendant la partie via les refs ci-dessus.
	const quizOverrides: QuizOverrides = {
		questionTimeLimit: activeQuestionTimeLimit,
		acceptanceDelay: activeAcceptanceDelay,
		gracePeriodMs: activeGracePeriodMs,
		onlyOneAnswer,
		penalizeWrong,
		unlimitedTimer,
		strictSpelling,
	};

	const handleOverrideChange = useCallback(<K extends keyof QuizOverrides>(key: K, value: QuizOverrides[K]) => {
		switch (key) {
			case 'questionTimeLimit': setActiveQuestionTimeLimit(value as number); break;
			case 'acceptanceDelay': setActiveAcceptanceDelay(value as number); break;
			case 'gracePeriodMs': setActiveGracePeriodMs(value as number); break;
			case 'onlyOneAnswer': setOnlyOneAnswer(value as boolean); break;
			case 'penalizeWrong': setPenalizeWrong(value as boolean); break;
			case 'unlimitedTimer': setUnlimitedTimer(value as boolean); break;
			case 'strictSpelling': setStrictSpelling(value as boolean); break;
		}
	}, []);

	const closeModeSelector = useCallback(() => {
		setShowModeSelector(false);
		setQuizQuestionCount(10);
		setModeError('');
	}, []);

	// Report system
	const [showReportMenu, setShowReportMenu] = useState(false);
	const [reportSent, setReportSent] = useState(false);
	const [reportError, setReportError] = useState('');

	// Synchroniser la sélection quand les boîtes changent (après sync DB)
	useEffect(() => {
		setSelectedBoxNames(prev => {
			if (prev === null) return null;
			const boxNames = new Set(allVisibleBoxes.map(b => b.name));
			const valid = prev.filter(n => boxNames.has(n));
			return valid.length > 0 ? valid : null;
		});
	}, [allVisibleBoxes]);

	const activeQuiz = activeQuiz_state;
	const currentQuestion = activeQuiz?.questions[activeQuiz.currentQuestionIndex];

	// Synchroniser les refs avec les états (pour lecture dans les callbacks async)
	useEffect(() => { onlyOneAnswerRef.current = onlyOneAnswer; }, [onlyOneAnswer]);
	useEffect(() => { penalizeWrongRef.current = penalizeWrong; }, [penalizeWrong]);
	useEffect(() => { unlimitedTimerRef.current = unlimitedTimer; }, [unlimitedTimer]);
	useEffect(() => { strictSpellingRef.current = strictSpelling; }, [strictSpelling]);
	useEffect(() => { activeGracePeriodMsRef.current = activeGracePeriodMs; }, [activeGracePeriodMs]);

	// Réinitialiser les overrides à l'ouverture du popup (depuis les settings actuels)
	const [prevShowModeSelector, setPrevShowModeSelector] = useState(false);
	useEffect(() => {
		if (showModeSelector && !prevShowModeSelector) {
			setActiveQuestionTimeLimit(questionTimeLimit_setting);
			setActiveAcceptanceDelay(acceptanceDelay_setting);
			setActiveGracePeriodMs(gracePeriodMs_setting);
			setOnlyOneAnswer(false);
			setPenalizeWrong(false);

			// Sync historique depuis Turso (max une fois par minute)
			if (Date.now() - lastHistorySyncRef.current > 60_000) {
				setHistorySyncing(true);
				setFreshStats(null);
				fetchHistory()
					.then((serverIds) => {
						mergeServerHistory(serverIds);
						lastHistorySyncRef.current = Date.now();
					})
					.catch(() => {})
					.finally(() => setHistorySyncing(false));
			}
		}
		setPrevShowModeSelector(showModeSelector);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [showModeSelector]);

	// Recalcule freshStats quand sélection, questions ou sync change
	useEffect(() => {
		if (!showModeSelector) return;
		const visibleBoxNames = allVisibleBoxes.map(b => b.name);
		const targetBoxes = selectedBoxNames ?? visibleBoxNames;
		const poolIds = allQuestions
			.filter(q => targetBoxes.includes(q.boxName))
			.map(q => q.id);
		setFreshStats(countFreshInPool(poolIds));
	}, [showModeSelector, selectedBoxNames, allQuestions, allVisibleBoxes]);

	// Vérifie si la question actuelle est un QCM
	const isQcmQuestion = currentQuestion?.questionType === QuestionType.QCM &&
		currentQuestion?.qcmOptions && currentQuestion.qcmOptions.length >= 2;

	useEffect(() => {
		if (twitchNick && twitchToken) {
			console.log(`Twitch channel changed to ${twitchNick}`);
			twitchConnection(twitchNick, chatNotifications);
			return () => {
				twitchDisconnection();
			};
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [twitchNick, twitchToken]);

	useEffect(() => {
		if (activeQuiz) {
			const questionNum = activeQuiz.currentQuestionIndex + 1;
			const totalQuestions = activeQuiz.totalQuestions;

			setSubtitle(`Quiz - Question ${questionNum}/${totalQuestions}`);

			// Démarrer le timer pour chaque question
			startQuestionTimer();
		} else {
			setSubtitle('En attente...');
		}

		return () => {
			stopTimerLoop();
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
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
				return twitchCallbackRef.current(_tags['display-name'], _tags['user-id'], _message);
			}
		});

	};

	const stopTimerLoop = useCallback(() => {
		if (questionTimer.current !== null) {
			cancelAnimationFrame(questionTimer.current);
			questionTimer.current = null;
		}
	}, []);

	const startQuestionTimer = () => {
		stopTimerLoop();

		// Réinitialiser les états
		setTimeLeft(questionTimeLimit);
		timerEndTime.current = Date.now() + questionTimeLimit * 1000;
		currentAnswerersRef.current = [];
		lastAnswerersRef.current = [];
		qcmAttemptsRef.current = new Set(); // Reset des tentatives QCM
		penalizedRef.current = new Set(); // Reset des pénalités du tour
		pendingPenaltiesRef.current = []; // Reset de la file des pénalités différées
		setQuestionRevealed(false);
		questionRevealedRef.current = false;

		// Mode timer illimité : pas de décompte, révélation manuelle via bouton existant RÉVÉLER
		if (unlimitedTimerRef.current) {
			if (timerCircleRef.current) {
				timerCircleRef.current.setAttribute('stroke-dashoffset', '0');
			}
			return;
		}

		// Boucle fluide avec requestAnimationFrame
		const circumference = TIMER_CIRCUMFERENCE;
		const totalMs = questionTimeLimit * 1000;

		const tick = () => {
			const now = Date.now();
			const remaining = Math.max(0, timerEndTime.current - now);
			const progress = remaining / totalMs;

			// Mise à jour directe du SVG (bypass React pour fluidité ~60fps)
			if (timerCircleRef.current) {
				timerCircleRef.current.setAttribute(
					'stroke-dashoffset',
					String(circumference * (1 - progress))
				);
			}

			const secondsLeft = Math.ceil(remaining / 1000);
			setTimeLeft((prev) => (prev !== secondsLeft ? secondsLeft : prev));

			if (remaining <= 0) {
				questionTimer.current = null;
				handleTimeUp();
				return;
			}

			questionTimer.current = requestAnimationFrame(tick);
		};

		questionTimer.current = requestAnimationFrame(tick);
	};

	const handleTimeUp = () => {
		// 1. Figer l'état immédiat
		stopTimerLoop();

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

			const questionStartTime = timerEndTime.current - questionTimeLimit * 1000;
			const answers = finalAnswerers.map((answerer, index) => {
				const isCombo = previousAnswerers.includes(answerer.nick);
				const elapsed = answerer.answeredAt ? answerer.answeredAt - questionStartTime : 0;
				return new Answer(answerer.nick, answerer.isFirst, isCombo, elapsed);
			});

			// Enregistrer les points
			recordAnswers(answers);
			recordAnswer_game(currentQuizState.currentQuestionIndex, finalAnswerers[0].nick);
		}

		// Appliquer les pénalités différées (mauvaises réponses)
		if (pendingPenaltiesRef.current.length > 0) {
			const ps = usePlayerStore.getState();
			for (const { nick } of pendingPenaltiesRef.current) {
				ps.addPoints(nick, -1);
			}
			pendingPenaltiesRef.current = [];
		}

		usePlayerStore.getState().backup();

		// Message chat
		if (chatNotifications && twitchNick) {
			// On utilise currentQuizState pour être safe
			const safeQuestion = currentQuizState?.questions[currentQuizState.currentQuestionIndex];

			if (finalAnswerers.length > 0) {
				const answerText = safeQuestion?.questionType === QuestionType.QCM
					? (() => {
						const idxs = safeQuestion.qcmCorrectIndexes ?? (safeQuestion.qcmCorrectIndex !== undefined ? [safeQuestion.qcmCorrectIndex] : []);
						return idxs.map(i => `${QCM_LABELS[i]} - ${safeQuestion.qcmOptions?.[i] || ''}`).join(', ');
					})()
					: safeQuestion?.answer;
				const msg = `✅ Bonne réponse : ${answerText}! Bravo à ${finalAnswerers.slice(0, 5).map(a => a.nick).join(', ')}${finalAnswerers.length > 5 ? ', ...' : ''}`;
				twitchClient.current?.say(twitchNick, msg);
			} else {
				const answerText = safeQuestion?.questionType === QuestionType.QCM
					? (() => {
						const idxs = safeQuestion.qcmCorrectIndexes ?? (safeQuestion.qcmCorrectIndex !== undefined ? [safeQuestion.qcmCorrectIndex] : []);
						return idxs.map(i => `${QCM_LABELS[i]} - ${safeQuestion.qcmOptions?.[i] || ''}`).join(', ');
					})()
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
		if (scoreCommandMode === TwitchMode.Whisper) {
			const player = getPlayersFromNick([nick])[0];
			if (!player) return;
			twitchClient.current?.whisper(nick, `Tu es #${player.rank} [${player.score} point${player.score > 1 ? 's' : ''}]`);
		} else if (scoreCommandMode === TwitchMode.Channel && twitchNick) {
			if (!scoreCommandTimeout.current) {
				scoreCommandTimeout.current = setTimeout(flushScoreCommands, SCORE_CMD_DELAY);
			}
			if (!delayedScoreCommands.current.includes(nick)) {
				delayedScoreCommands.current.push(nick);
			}
		}
	};

	const onProposition = (nick: string, tid: string, message: string) => {
		// Commande !score - toujours traitée, même entre les questions
		if (message.toLowerCase() === '!score') {
			handleScoreCommand(nick);
			return;
		}

		// Si la question est révélée, on ignore TOUTES les propositions
		if (questionRevealedRef.current) {
			return;
		}

		if (addEveryUser) {
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
				if (boxName) setSelectedBoxNames([boxName]);
				setQuizQuestionCount(questionCount);
				setShowModeSelector(true);
			} else {
				// Pas de nombre = ouvrir le sélecteur avec la boîte pré-remplie
				const boxName = args.join(' ');
				setPendingQuizRequester(nick);
				if (boxName) setSelectedBoxNames([boxName]);
				setShowModeSelector(true);
			}
			return;
		}

		// Vérification des réponses
		const currentActiveQuiz = activeQuiz_state;
		const currentActiveQuestion = currentActiveQuiz?.questions[currentActiveQuiz.currentQuestionIndex];

		if (currentActiveQuiz && currentActiveQuestion && !questionRevealedRef.current) {
			// Vérifier si le joueur a déjà répondu correctement
			if (currentAnswerersRef.current.find((a) => a.nick === nick)) {
				return;
			}

			// QCM ou "Une seule réponse par personne" : une seule tentative autorisée
			const isQcm = currentActiveQuestion.questionType === QuestionType.QCM;
			const singleAttemptMode = isQcm || onlyOneAnswerRef.current;
			if (singleAttemptMode && qcmAttemptsRef.current.has(nick)) {
				return;
			}

			const result = verifyAnswer(message, currentActiveQuestion, { strictSpelling: strictSpellingRef.current });

			if (!result.valid) return;
			if (singleAttemptMode) qcmAttemptsRef.current.add(nick);

			if (result.isCorrect) {
				initPlayer(nick, tid);
				const now = Date.now();
				const firstAnsweredAt = currentAnswerersRef.current.length > 0 ? currentAnswerersRef.current[0].answeredAt : null;
				const isFirst = firstAnsweredAt === null || (now - firstAnsweredAt) <= activeGracePeriodMsRef.current;
				const newAnswerer = { nick, isFirst, answeredAt: now };
				currentAnswerersRef.current = [...currentAnswerersRef.current, newAnswerer];
			} else if (penalizeWrongRef.current && !penalizedRef.current.has(nick)) {
				// Pénalité différée : enregistrée maintenant, appliquée à la révélation
				initPlayer(nick, tid);
				pendingPenaltiesRef.current.push({ nick, tid });
				penalizedRef.current.add(nick);
			}
		}
	};

	twitchCallbackRef.current = onProposition;

	// Lancer le quiz
	const handleStartQuiz = () => {
		let questions: ReturnType<typeof generateRandomQuiz>;
		let displayBoxName: string;

		if (selectedBoxNames === null) {
			// Toutes les boîtes visibles (dont les sous-boîtes de tous les masters)
			questions = generateRandomQuizFromBoxes(allVisibleBoxes.map(b => b.name), quizQuestionCount);
			displayBoxName = 'Mix aléatoire';
		} else if (selectedBoxNames.length === 1) {
			// Une seule boîte
			const boxName = selectedBoxNames[0];
			const box = getBoxByName(boxName);
			if (!box) {
				setModeError(`❌ La boîte "${boxName}" n'existe pas`);
				return;
			}
			if (box.ordered) {
				questions = generateOrderedQuiz(boxName);
				displayBoxName = boxName;
			} else {
				questions = generateRandomQuiz(boxName, quizQuestionCount);
				displayBoxName = boxName;
			}
		} else {
			// Sélection multiple
			questions = generateRandomQuizFromBoxes(selectedBoxNames, quizQuestionCount);
			displayBoxName = 'Mix sélection';
		}

		if (!questions || questions.length === 0) {
			setModeError(`❌ Impossible de générer le quiz (pas assez de questions)`);
			return;
		}

		// Persiste l'historique en Turso (fire-and-forget, pas bloquant)
		const pickedIds = questions.map(q => q.id);
		const historyBoxName = selectedBoxNames?.length === 1 ? selectedBoxNames[0] : undefined;
		recordHistory(pickedIds, historyBoxName).catch(() => {});

		// Sauvegarder le requester avant de fermer le modal
		const requester = pendingQuizRequester;

		// Générer un ID unique pour cette session de quiz
		sessionIdRef.current = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

		// Démarrer le quiz dans le store
		startQuiz(QuizMode.QUIZ, displayBoxName, questions);

		// Gérer les scores cumulatifs
		if (!cumulativeScoresInQuizMode) {
			usePlayerStore.getState().clear();
		}

		// Fermer le modal et réinitialiser
		setShowModeSelector(false);
		setPendingQuizRequester('');
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
						questionMsg += ` | ${firstQuestion.qcmOptions.map((opt, i) => `${QCM_LABELS[i]} - ${opt}`).join(' | ')}`;
					}

					twitchClient.current?.say(twitchNick, questionMsg);
				}
			}, 1000);
		}
	};

	// Enregistrer les stats de questions jouées en fin de quiz
	const recordQuestionStats = (quiz: NonNullable<typeof activeQuiz_state>) => {
		const questionResults = quiz.questions.map((q, i) => {
			const answerers = quiz.answers.get(i) || [];
			return {
				questionId: q.id,
				correct: answerers.length > 0,
				answerTimeMs: 0,
			};
		});
		fetch('/api/stats?action=record_questions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ questions: questionResults }),
		}).catch(err => console.warn('⚠️ Échec enregistrement question stats', err));
	};

	// Terminer la session (pour mode cumulatif)
	const handleEndSession = () => {
		// Sync scores vers l'API avant de réinitialiser
		const currentQuiz = useGameStore.getState().activeQuiz;
		const boxName = currentQuiz?.boxName;
		if (currentQuiz) recordQuestionStats(currentQuiz);
		usePlayerStore.getState().syncScoresToAPI(sessionIdRef.current, boxName);

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
		stopTimerLoop();

		// 2. Vérifier s'il reste des questions
		const storeState = useGameStore.getState();
		const currentQuiz = storeState.activeQuiz;

		if (!currentQuiz) return;

		const nextIndex = currentQuiz.currentQuestionIndex + 1;
		const totalQuestions = currentQuiz.totalQuestions;

		if (nextIndex >= totalQuestions) {
			// C'est fini — sync scores vers l'API avant de fermer
			const boxName = currentQuiz.boxName;
			recordQuestionStats(currentQuiz);
			usePlayerStore.getState().syncScoresToAPI(sessionIdRef.current, boxName);

			endQuiz();
			setPodiumDisplayed(true);
			if (twitchNick) {
				twitchClient.current?.say(twitchNick, '🎉 Quiz terminé ! Bravo à tous les participants !');
			}
			return;
		}

		// 3. Reset report state & transition
		setShowReportMenu(false);
		setReportSent(false);
		setReportError('');

		setTimeout(() => {
			nextQuestion();

			const updatedStore = useGameStore.getState();
			const newQuiz = updatedStore.activeQuiz;

			if (newQuiz) {
				const newQuestion = newQuiz.questions[newQuiz.currentQuestionIndex];
				const questionNum = newQuiz.currentQuestionIndex + 1;

				if (chatNotifications && twitchNick) {
					let questionMsg = `❓ Question ${questionNum}/${newQuiz.totalQuestions} : ${newQuestion.question}`;

					// Ajouter les options QCM si applicable
					if (newQuestion.questionType === QuestionType.QCM && newQuestion.qcmOptions) {
						questionMsg += ` | ${newQuestion.qcmOptions.map((opt, i) => `${QCM_LABELS[i]} - ${opt}`).join(' | ')}`;
					}

					twitchClient.current?.say(twitchNick, questionMsg);
				}

				startQuestionTimer();
			}
		}, 1000);
	};

	const handleRevealAnswer = () => {
		stopTimerLoop();

		if (!questionRevealed) {
			handleTimeUp();
		}
	};


	// Vérifie si le mode cumulatif est actif

	return (
		<>
			{/* Modal de sélection du quiz */}
			<QuizConfigModal
				show={showModeSelector}
				requester={pendingQuizRequester}
				selectedBoxNames={selectedBoxNames}
				totalVisibleBoxes={allVisibleBoxes.length}
				isOrderedBox={isOrderedBox}
				questionCount={quizQuestionCount}
				onQuestionCountChange={setQuizQuestionCount}
				overrides={quizOverrides}
				onOverrideChange={handleOverrideChange}
				modeError={modeError}
				onCancel={closeModeSelector}
				onStart={handleStartQuiz}
			/>

			<div id="quiz">
				<div className="row mb-4">
					<div className="col-md-8">
						<div className="terminal-panel terminal-panel-glow scanlines p-3 mb-2">
							{!activeQuiz && (
								<div className="lumon-standby">
									<h3 className="mt-4 text-glow-cyan">En attente...</h3>
									<div className="mt-4">
										<button
											className="terminal-btn"
											style={{ fontSize: '0.9rem', padding: '0.7rem 1.5rem' }}
											onClick={() => {
												setPendingQuizRequester(twitchNick || 'Streamer');
												setShowModeSelector(true);
											}}
										>
											<FontAwesomeIcon icon={['fas', 'play']} className="me-2" />
											Lancer un Quiz
										</button>

										{/* Bouton Terminer Session (si mode cumulatif activé) */}
										{cumulativeScoresInQuizMode && (
											<button
												className="terminal-btn terminal-btn-amber ms-2"
												style={{ fontSize: '0.9rem', padding: '0.7rem 1.5rem' }}
												onClick={handleEndSession}
											>
												<FontAwesomeIcon icon={['fas', 'flag-checkered']} className="me-2" />
												Terminer la session
											</button>
										)}
									</div>

									{/* Panneau info boîte(s) sélectionnée(s) */}
									{allVisibleBoxes.length > 0 && (() => {
										const effectiveBoxNames: string[] = selectedBoxNames === null
											? allVisibleBoxes.map(b => b.name)
											: selectedBoxNames;
										if (effectiveBoxNames.length === 0) return null;
										const selectedQuestions = allQuestions.filter(q => effectiveBoxNames.includes(q.boxName));
										const qcmCount = selectedQuestions.filter(q => q.questionType === QuestionType.QCM).length;
										const freeCount = selectedQuestions.length - qcmCount;

										const isSingle = effectiveBoxNames.length === 1;
										const singleBox = isSingle ? getBoxByName(effectiveBoxNames[0]) : null;

										return (
											<div className="mt-3 p-3 terminal-panel" style={{ display: 'block', maxWidth: '600px', margin: '12px auto 0', textAlign: 'left' }}>
												<p className="mb-1" style={{ color: 'var(--lumon-cyan)', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem' }}>
													{isSingle && singleBox ? (
														<>
															<FontAwesomeIcon icon={['fas', 'box']} className="me-2" />
															{singleBox.ordered && <span style={{ marginRight: '4px' }}>↓</span>}
															{singleBox.name}
														</>
													) : (
														<>
															<FontAwesomeIcon icon={['fas', 'box-open']} className="me-2" />
															{selectedBoxNames === null
																? 'Toutes les boîtes'
																: `${effectiveBoxNames.length} boîtes sélectionnées`}
														</>
													)}
												</p>
												{isSingle && singleBox?.description && (
													<p className="mb-2" style={{ color: 'var(--lumon-text-dim)', fontSize: '0.75rem', fontStyle: 'italic' }}>
														{singleBox.description}
													</p>
												)}
												<div className="d-flex flex-wrap gap-1 mb-1" style={{ fontSize: '0.7rem' }}>
													<span className="terminal-badge" style={{ padding: '2px 8px' }}>
														{selectedQuestions.length} question{selectedQuestions.length > 1 ? 's' : ''}
													</span>
													{qcmCount > 0 && (
														<span className="terminal-badge" style={{ padding: '2px 8px', borderColor: '#4caf50', color: '#4caf50' }}>
															{qcmCount} QCM
														</span>
													)}
													{freeCount > 0 && (
														<span className="terminal-badge" style={{ padding: '2px 8px', borderColor: '#888', color: '#888' }}>
															{freeCount} Libre{freeCount > 1 ? 's' : ''}
														</span>
													)}
													{historySyncing && (
														<span className="terminal-badge" style={{ padding: '2px 8px', borderColor: '#FFB000', color: '#FFB000' }}>
															⏳ sync…
														</span>
													)}
													{!historySyncing && freshStats && (
														<span className="terminal-badge" style={{
															padding: '2px 8px',
															borderColor: freshStats.fresh > 0 ? '#00FF66' : '#FF0033',
															color: freshStats.fresh > 0 ? '#00FF66' : '#FF0033',
														}}>
															{freshStats.fresh} fraîche{freshStats.fresh > 1 ? 's' : ''} / {freshStats.seen} déjà vue{freshStats.seen > 1 ? 's' : ''}
														</span>
													)}
												</div>
											</div>
										);
									})()}

									<QuizBoxGrid
										boxes={allVisibleBoxes}
										selectedBoxNames={selectedBoxNames}
										setSelectedBoxNames={setSelectedBoxNames}
									/>
								</div>
							)}

							{activeQuiz && currentQuestion && (
								<div style={{ flex: 1 }}>
									<QuestionTimer
										boxName={currentQuestion.boxName}
										timeLeft={timeLeft}
										questionTimeLimit={questionTimeLimit}
										unlimitedTimer={unlimitedTimer}
										circleRef={timerCircleRef}
									/>

									<QuizQuestionView
										question={currentQuestion}
										questionIndex={activeQuiz.currentQuestionIndex}
										questionRevealed={questionRevealed}
										isQcmQuestion={!!isQcmQuestion}
										answerers={lastAnswerersRef.current}
										showReportMenu={showReportMenu}
										setShowReportMenu={setShowReportMenu}
										reportSent={reportSent}
										setReportSent={setReportSent}
										reportError={reportError}
										setReportError={setReportError}
									/>
								</div>
							)}
						</div>
					</div>

					<div className="col-md-4">
						<div id="player" className="mb-2 player" style={{ display: 'flex' }}>
							{activeQuiz && (
								<>
									<button
										className="terminal-btn col-sm"
										id="nextButton"
										disabled={!questionRevealed}
										onClick={handleNextQuestion}
									>
										{activeQuiz.currentQuestionIndex + 1 >= activeQuiz.totalQuestions ? (
											<>
												<FontAwesomeIcon icon={['fas', 'trophy']} className="me-1" />
												PODIUM
											</>
										) : (
											<>
												<FontAwesomeIcon icon={['fas', 'step-forward']} className="me-1" />
												SUIVANT
											</>
										)}
									</button>
									&nbsp;
									<button
										className="terminal-btn terminal-btn-amber col-sm"
										id="revealButton"
										disabled={questionRevealed}
										onClick={handleRevealAnswer}
									>
										<FontAwesomeIcon icon={['fas', 'eye']} className="me-1" />
										RÉVÉLER
									</button>
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
