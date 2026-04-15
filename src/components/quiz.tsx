import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Modal, Form } from 'react-bootstrap';
import { Client, Options } from 'tmi.js';
import { useAuthStore } from './store/auth-store';
import { useGlobalStore } from './store/global-store';
import { Answer, Player, usePlayerStore } from './store/player-store';
import { TwitchMode, useSettingsStore } from './store/settings-store';
import { QuestionType, useQuestionsStore } from './store/questions-store';
import { QuizMode, useGameStore } from './store/game-store';
import Podium from './podium';
import Leaderboard from './leaderboard';
import { apiCreateReport, type ReportReason } from 'services/api-reports-service';
import { verifyAnswer } from 'services/answer-validator';
let twitchCallback: (nick: string, tid: string, msg: string) => void = () => {};

const SCORE_CMD_DELAY = 2000;

// Labels pour les options QCM
const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Regex pour détecter les emojis Unicode (Extended_Pictographic couvre la plupart des emojis modernes)
const EMOJI_SPLIT_REGEX = /(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\uFE0F?)/gu;
const EMOJI_TEST_REGEX = /^\p{Extended_Pictographic}/u;

// Encapsule chaque emoji dans un span avec une taille augmentée
const renderWithEmojiBoost = (text: string): React.ReactNode => {
	if (!text) return text;
	const parts = text.split(EMOJI_SPLIT_REGEX);
	return parts.map((part, i) =>
		EMOJI_TEST_REGEX.test(part)
			? <span key={i} className="emoji-boost">{part}</span>
			: part
	);
};

const Quiz = () => {
	const twitchClient = useRef<Client | null>(null);
	const questionTimer = useRef<number | null>(null); // requestAnimationFrame ID
	const timerEndTime = useRef<number>(0); // timestamp de fin du timer
	const timerCircleRef = useRef<SVGCircleElement | null>(null); // ref directe sur le cercle SVG
	const scoreCommandTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
	const delayedScoreCommands = useRef<string[]>([]);

	const settingsStore = useSettingsStore();
	// Sélecteurs pour éviter les re-renders inutiles
	const allBoxes = useQuestionsStore((state) => state.boxes);
	const cumulativeScoresInQuizMode = useQuestionsStore((state) => state.cumulativeScoresInQuizMode);
	const questionsStore = useQuestionsStore(); // Pour les actions
	const gameStore = useGameStore();
	const setSubtitle = useGlobalStore((state) => state.setSubtitle);

	const initPlayer = usePlayerStore((state) => state.initPlayer);
	const recordAnswers = usePlayerStore((state) => state.recordAnswers);
	const getPlayersFromNick = usePlayerStore((state) => state.getPlayers);

	const twitchNick = useAuthStore((state) => state.twitchNick);
	const twitchUserId = useAuthStore((state) => state.twitchUserId);
	const getTwitchToken = useAuthStore((state) => state.getTwitchOAuthToken);
	// Toutes les boîtes visibles (non cachées) — source de vérité
	const allVisibleBoxes = useMemo(() => allBoxes.filter(b => !b.hidden), [allBoxes]);

	// Set de masters actuellement dépliés (accordion inline)
	const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());

	// Map : nom du master → ses sous-boîtes
	const masterSubBoxMap = useMemo(() => {
		const map = new Map<string, typeof allVisibleBoxes>();
		allVisibleBoxes.forEach(b => {
			if (b.parentBox) {
				if (!map.has(b.parentBox)) map.set(b.parentBox, []);
				map.get(b.parentBox)!.push(b);
			}
		});
		return map;
	}, [allVisibleBoxes]);

	// Boîtes de niveau racine (sans parent)
	const topLevelBoxes = useMemo(() => allVisibleBoxes.filter(b => !b.parentBox), [allVisibleBoxes]);

	// Nouvelle palette restreinte (variations de Bleu, Violet, Rose) pour les Master Boxes
	const MASTER_THEME_PALETTE = useMemo(() => [
		{ color: '#b366ff', rgb: '179,102,255' },    // Violet Lumon
		{ color: '#ff3366', rgb: '255,51,102' },     // Rose Néon
		{ color: '#33ccff', rgb: '51,204,255' },     // Bleu Ciel
		{ color: '#9d4edd', rgb: '157,78,221' },     // Deep Purple
		{ color: '#ff66b2', rgb: '255,102,178' },    // Pink
		{ color: '#4cc9f0', rgb: '76,201,240' },     // Bright Blue
		{ color: '#7209b7', rgb: '114,9,183' },      // Indigo profond
	], []);

	// Couleur standard pour les boîtes indépendantes (Le vrai Cyan Lumon du site)
	const DEFAULT_LUMON_THEME = { color: '#00e5ff', rgb: '0,229,255' };

	// Map : nom de boîte → couleur du thème
	const boxThemeMap = useMemo(() => {
		const map = new Map<string, { color: string; rgb: string }>();
		let masterIndex = 0; // On crée un compteur spécifique aux Master Boxes

		topLevelBoxes.forEach((b) => {
			const isMaster = masterSubBoxMap.has(b.name);

			if (isMaster) {
				// C'est une Master Box : on lui assigne une couleur de la palette et on incrémente
				const theme = MASTER_THEME_PALETTE[masterIndex % MASTER_THEME_PALETTE.length];
				map.set(b.name, theme);
				
				// Ses sous-boîtes héritent de la même couleur
				const subs = masterSubBoxMap.get(b.name);
				if (subs) {
					subs.forEach(sub => map.set(sub.name, theme));
				}
				masterIndex++;
			} else {
				// C'est une boîte classique sans sous-boîtes : Bleu Lumon par défaut !
				map.set(b.name, DEFAULT_LUMON_THEME);
			}
		});
		return map;
	}, [topLevelBoxes, masterSubBoxMap, MASTER_THEME_PALETTE]);

	// Boîtes affichées dans la grille MDR : top-level avec sous-boîtes insérées après chaque master déplié
	const displayedBoxes = useMemo(() => {
		const result: { box: typeof allVisibleBoxes[0]; isSubBox: boolean; masterName?: string }[] = [];
		for (const b of topLevelBoxes) {
			const isMaster = masterSubBoxMap.has(b.name);
			result.push({ box: b, isSubBox: false });
			if (isMaster && expandedMasters.has(b.name)) {
				const subs = masterSubBoxMap.get(b.name) ?? [];
				for (const sub of subs) {
					result.push({ box: sub, isSubBox: true, masterName: b.name });
				}
			}
		}
		return result;
	}, [topLevelBoxes, masterSubBoxMap, expandedMasters]);
	const twitchToken = getTwitchToken(); // Get deobfuscated token

	// Overrides locaux (popup de config quiz) — ne modifient PAS les settings globaux
	const [activeQuestionTimeLimit, setActiveQuestionTimeLimit] = useState(settingsStore.questionTimeLimit);
	const [activeAcceptanceDelay, setActiveAcceptanceDelay] = useState(settingsStore.acceptanceDelay);
	const [activeGracePeriodMs, setActiveGracePeriodMs] = useState(settingsStore.gracePeriodMs);
	const [onlyOneAnswer, setOnlyOneAnswer] = useState(false);
	const [penalizeWrong, setPenalizeWrong] = useState(false);
	const questionTimeLimit = activeQuestionTimeLimit;
	const [timeLeft, setTimeLeft] = useState(questionTimeLimit);
	// Refs pour lecture dans onProposition (évite closure stale)
	const onlyOneAnswerRef = useRef(false);
	const penalizeWrongRef = useRef(false);
	const activeGracePeriodMsRef = useRef(settingsStore.gracePeriodMs);
	// Track des joueurs ayant déjà été pénalisés ce tour (une seule pénalité par question)
	const penalizedRef = useRef<Set<string>>(new Set());
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

	// Boîte ordonnée : une seule boîte sélectionnée avec ordered=true
	const isOrderedBox = selectedBoxNames?.length === 1
		? (questionsStore.getBoxByName(selectedBoxNames[0])?.ordered ?? false)
		: false;

	// Report system
	const [showReportMenu, setShowReportMenu] = useState(false);
	const [reportSent, setReportSent] = useState(false);
	const [reportError, setReportError] = useState('');

	// MDR fisheye effect — Severance-style radial magnification
	const [mdrHoveredIndex, setMdrHoveredIndex] = useState<number | null>(null);
	const mdrContainerRef = useRef<HTMLDivElement>(null);
	const mdrItemRefs = useRef<(HTMLDivElement | null)[]>([]);

	// Compute distance rings from hovered element (fisheye gradient)
	const mdrRingMap = useMemo(() => {
		const map = new Map<number, 'near' | 'mid' | 'far'>();
		if (mdrHoveredIndex === null || !mdrContainerRef.current) return map;
		const hoveredEl = mdrItemRefs.current[mdrHoveredIndex];
		if (!hoveredEl) return map;

		const hr = hoveredEl.getBoundingClientRect();
		const hx = hr.left + hr.width / 2;
		const hy = hr.top + hr.height / 2;
		const unitW = hr.width;
		const unitH = hr.height;

		for (let i = 0; i < mdrItemRefs.current.length; i++) {
			if (i === mdrHoveredIndex) continue;
			const el = mdrItemRefs.current[i];
			if (!el) continue;
			const r = el.getBoundingClientRect();
			const dx = Math.abs((r.left + r.width / 2) - hx);
			const dy = Math.abs((r.top + r.height / 2) - hy);
			// Normalized distance in "box units"
			const dist = Math.sqrt((dx / unitW) ** 2 + (dy / unitH) ** 2);

			if (dist < 1.6) map.set(i, 'near');
			else if (dist < 3.0) map.set(i, 'mid');
			else map.set(i, 'far');
		}
		return map;
	}, [mdrHoveredIndex]);

	const getMdrClass = useCallback((mdrIndex: number) => {
		const isSelected = mdrIndex === 0
			? selectedBoxNames === null
			: (selectedBoxNames === null || selectedBoxNames.includes(displayedBoxes[mdrIndex - 1]?.box.name ?? ''));
		let hoverClass = '';
		if (mdrHoveredIndex !== null) {
			if (mdrIndex === mdrHoveredIndex) hoverClass = 'mdr-focused';
			else {
				const ring = mdrRingMap.get(mdrIndex) || 'far';
				hoverClass = `mdr-ring-${ring}`;
			}
		}
		const selectionClass = isSelected ? 'mdr-selected' : 'mdr-unselected';
		return `${hoverClass} ${selectionClass}`.trim();
	}, [mdrHoveredIndex, mdrRingMap, selectedBoxNames, displayedBoxes]);

	const handleBoxClick = useCallback((boxName: string) => {
		setSelectedBoxNames(prev => {
			if (prev === null) return [boxName];
			const isSelected = prev.includes(boxName);
			if (isSelected && prev.length === 1) return null;
			if (isSelected) return prev.filter(n => n !== boxName);
			return [...prev, boxName];
		});
	}, []);

	// Clic sur un Master : toggle la sélection du master + toutes ses sous-boîtes en bloc
	const handleMasterSelectToggle = useCallback((masterName: string) => {
		const subs = masterSubBoxMap.get(masterName) ?? [];
		const allNames = [masterName, ...subs.map(s => s.name)];
		setSelectedBoxNames(prev => {
			if (prev === null) return allNames;
			const allSelected = allNames.every(n => prev.includes(n));
			if (allSelected) {
				const filtered = prev.filter(n => !allNames.includes(n));
				return filtered.length === 0 ? null : filtered;
			}
			return Array.from(new Set([...prev, ...allNames]));
		});
	}, [masterSubBoxMap]);

	// Chevron ▶/▼ : expand/collapse de la Master (ne change pas la sélection)
	const handleMasterExpandToggle = useCallback((masterName: string) => {
		setExpandedMasters(prev => {
			const next = new Set(prev);
			if (next.has(masterName)) next.delete(masterName);
			else next.add(masterName);
			return next;
		});
	}, []);

	// Synchroniser la sélection quand les boîtes changent (après sync DB)
	useEffect(() => {
		setSelectedBoxNames(prev => {
			if (prev === null) return null;
			const boxNames = new Set(allVisibleBoxes.map(b => b.name));
			const valid = prev.filter(n => boxNames.has(n));
			return valid.length > 0 ? valid : null;
		});
		setExpandedMasters(prev => {
			const boxNames = new Set(allVisibleBoxes.map(b => b.name));
			const valid = new Set(Array.from(prev).filter(n => boxNames.has(n)));
			return valid.size !== prev.size ? valid : prev;
		});
	}, [allVisibleBoxes]);

	const activeQuiz = gameStore.activeQuiz;
	const currentQuestion = activeQuiz?.questions[activeQuiz.currentQuestionIndex];

	// Synchroniser les refs avec les états (pour lecture dans les callbacks async)
	useEffect(() => { onlyOneAnswerRef.current = onlyOneAnswer; }, [onlyOneAnswer]);
	useEffect(() => { penalizeWrongRef.current = penalizeWrong; }, [penalizeWrong]);
	useEffect(() => { activeGracePeriodMsRef.current = activeGracePeriodMs; }, [activeGracePeriodMs]);

	// Réinitialiser les overrides à l'ouverture du popup (depuis les settings actuels)
	const [prevShowModeSelector, setPrevShowModeSelector] = useState(false);
	useEffect(() => {
		if (showModeSelector && !prevShowModeSelector) {
			setActiveQuestionTimeLimit(settingsStore.questionTimeLimit);
			setActiveAcceptanceDelay(settingsStore.acceptanceDelay);
			setActiveGracePeriodMs(settingsStore.gracePeriodMs);
			setOnlyOneAnswer(false);
			setPenalizeWrong(false);
		}
		setPrevShowModeSelector(showModeSelector);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [showModeSelector]);

	// Vérifie si la question actuelle est un QCM
	const isQcmQuestion = currentQuestion?.questionType === QuestionType.QCM &&
		currentQuestion?.qcmOptions && currentQuestion.qcmOptions.length >= 2;

	useEffect(() => {
		if (twitchNick && twitchToken) {
			console.log(`Twitch channel changed to ${twitchNick}`);
			twitchConnection(twitchNick, settingsStore.chatNotifications);
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
				return twitchCallback(_tags['display-name'], _tags['user-id'], _message);
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
		setQuestionRevealed(false);
		questionRevealedRef.current = false;

		// Boucle fluide avec requestAnimationFrame
		const circumference = 2 * Math.PI * 54; // timerRadius
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
				return new Answer(answerer.nick, index === 0, isCombo, elapsed);
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
		// Commande !score - toujours traitée, même entre les questions
		if (message.toLowerCase() === '!score') {
			handleScoreCommand(nick);
			return;
		}

		// Si la question est révélée, on ignore TOUTES les propositions
		if (questionRevealedRef.current) {
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
		const currentActiveQuiz = gameStore.activeQuiz;
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

			const result = verifyAnswer(message, currentActiveQuestion);

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
				// Pénalité : -1 point sur mauvaise réponse (une seule fois par question)
				initPlayer(nick, tid);
				usePlayerStore.getState().addPoints(nick, -1);
				penalizedRef.current.add(nick);
			}
		}
	};

	twitchCallback = onProposition;

	// Lancer le quiz
	const handleStartQuiz = () => {
		let questions: ReturnType<typeof questionsStore.generateRandomQuiz>;
		let displayBoxName: string;

		if (selectedBoxNames === null) {
			// Toutes les boîtes visibles (dont les sous-boîtes de tous les masters)
			questions = questionsStore.generateRandomQuizFromBoxes(allVisibleBoxes.map(b => b.name), quizQuestionCount);
			displayBoxName = 'Mix aléatoire';
		} else if (selectedBoxNames.length === 1) {
			// Une seule boîte
			const boxName = selectedBoxNames[0];
			const box = questionsStore.getBoxByName(boxName);
			if (!box) {
				setModeError(`❌ La boîte "${boxName}" n'existe pas`);
				return;
			}
			if (box.ordered) {
				questions = questionsStore.generateOrderedQuiz(boxName);
				displayBoxName = boxName;
			} else {
				questions = questionsStore.generateRandomQuiz(boxName, quizQuestionCount);
				displayBoxName = boxName;
			}
		} else {
			// Sélection multiple
			questions = questionsStore.generateRandomQuizFromBoxes(selectedBoxNames, quizQuestionCount);
			displayBoxName = 'Mix sélection';
		}

		if (!questions || questions.length === 0) {
			setModeError(`❌ Impossible de générer le quiz (pas assez de questions)`);
			return;
		}

		// Sauvegarder le requester avant de fermer le modal
		const requester = pendingQuizRequester;

		// Générer un ID unique pour cette session de quiz
		sessionIdRef.current = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

		// Démarrer le quiz dans le store
		gameStore.startQuiz(QuizMode.QUIZ, displayBoxName, questions);

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
	const recordQuestionStats = (quiz: NonNullable<typeof gameStore.activeQuiz>) => {
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
		usePlayerStore.getState().syncScoresToAPI(sessionIdRef.current, boxName, twitchNick || undefined, twitchUserId || undefined);

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
			usePlayerStore.getState().syncScoresToAPI(sessionIdRef.current, boxName, twitchNick || undefined, twitchUserId || undefined);

			gameStore.endQuiz();
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

	const handleSkipQuestion = () => {
		stopTimerLoop();
		if (timerCircleRef.current) {
			timerCircleRef.current.setAttribute(
				'stroke-dashoffset',
				String(2 * Math.PI * 54)
			);
		}
		setQuestionRevealed(true);
		questionRevealedRef.current = true;
	};

	// Timer : calcul couleur selon le temps restant
	const timerRadius = 54;
	const timerCircumference = 2 * Math.PI * timerRadius;
	const timerColor = useMemo(() => {
		const pct = (timeLeft / questionTimeLimit) * 100;
		if (pct > 50) return 'var(--lumon-success, #00FF66)';
		if (pct > 25) return 'var(--lumon-amber, #FFB000)';
		return 'var(--lumon-danger, #FF0033)';
	}, [timeLeft, questionTimeLimit]);

	// Timer urgency class for pulsing effect
	const timerUrgencyClass = useMemo(() => {
		const pct = (timeLeft / questionTimeLimit) * 100;
		if (pct <= 25) return 'timer-critical';
		return '';
	}, [timeLeft, questionTimeLimit]);

	// Vérifie si le mode cumulatif est actif

	return (
		<>
			{/* Modal de sélection du quiz */}
			<Modal
				show={showModeSelector}
				onHide={() => {
					setShowModeSelector(false);
					setQuizQuestionCount(10);
					setModeError('');
				}}
				centered
				size="lg"
			>
				<Modal.Header closeButton>
					<Modal.Title>Configurer le quiz</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<p className="mb-3" style={{ color: 'var(--lumon-text-dim)' }}>
						<strong style={{ color: 'var(--lumon-cyan)' }}>{pendingQuizRequester}</strong> demande un quiz. Configurez les paramètres :
					</p>

					{/* Résumé des boîtes sélectionnées */}
					<div className="mb-3 p-2" style={{ background: 'rgba(var(--lumon-cyan-rgb), 0.05)', border: '1px solid rgba(var(--lumon-cyan-rgb), 0.2)', borderRadius: '4px' }}>
						<small style={{ color: 'var(--lumon-text-dim)' }}>Boîtes sélectionnées :</small>
						<div style={{ color: 'var(--lumon-cyan)', fontSize: '0.85rem', marginTop: '2px' }}>
							{selectedBoxNames === null
								? `Toutes les boîtes (${allVisibleBoxes.length})`
								: selectedBoxNames.length === 1
									? selectedBoxNames[0]
									: `${selectedBoxNames.length} boîtes : ${selectedBoxNames.join(', ')}`
							}
						</div>
					</div>

					{/* Mode ordonné : afficher un message, cacher les options inutiles */}
					{isOrderedBox ? (
						<div className="mb-3 p-2" style={{ background: 'rgba(var(--lumon-cyan-rgb), 0.08)', border: '1px solid rgba(var(--lumon-cyan-rgb), 0.3)', borderRadius: '4px' }}>
							<small style={{ color: 'var(--lumon-cyan)' }}>
								↓ Mode ordonné — toutes les questions seront jouées dans l'ordre de la boîte.
							</small>
						</div>
					) : (
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

					{/* Overrides locaux (valables uniquement pour ce quiz) */}
					<div className="mb-3 p-3" style={{ background: 'rgba(var(--lumon-cyan-rgb), 0.03)', border: '1px solid rgba(var(--lumon-cyan-rgb), 0.15)', borderRadius: '4px' }}>
						<small style={{ color: 'var(--lumon-text-dim)', display: 'block', marginBottom: '10px' }}>
							Réglages pour cette partie uniquement (n'affecte pas les Settings globaux)
						</small>

						<Form.Group className="mb-2">
							<Form.Label style={{ fontSize: '0.85rem' }}>Temps de réponse par question</Form.Label>
							<Form.Range value={activeQuestionTimeLimit} onChange={(e) => setActiveQuestionTimeLimit(e.target.valueAsNumber)} min={10} max={60} />
							<div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--lumon-cyan)', marginTop: '-6px' }}>
								<i>{activeQuestionTimeLimit} seconde{activeQuestionTimeLimit > 1 ? 's' : ''}</i>
							</div>
						</Form.Group>

						<Form.Group className="mb-2">
							<Form.Label style={{ fontSize: '0.85rem' }}>Délai d'acceptation de la réponse</Form.Label>
							<Form.Range value={activeAcceptanceDelay} onChange={(e) => setActiveAcceptanceDelay(e.target.valueAsNumber)} min={0} max={20} />
							<div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--lumon-cyan)', marginTop: '-6px' }}>
								<i>{activeAcceptanceDelay} seconde{activeAcceptanceDelay > 1 ? 's' : ''}</i>
							</div>
						</Form.Group>

						<Form.Group className="mb-2">
							<Form.Label style={{ fontSize: '0.85rem' }}>
								Délai de clémence (FIRST)
								<span style={{ fontSize: '0.7rem', color: 'var(--lumon-text-dim)', display: 'block', fontWeight: 'normal' }}>
									Temps supplémentaire accordé pour partager la place de 1er
								</span>
							</Form.Label>
							<Form.Range value={activeGracePeriodMs} onChange={(e) => setActiveGracePeriodMs(e.target.valueAsNumber)} min={100} max={2000} step={100} />
							<div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--lumon-cyan)', marginTop: '-6px' }}>
								<i>{(activeGracePeriodMs / 1000).toFixed(1).replace('.', ',')} seconde{activeGracePeriodMs >= 2000 ? 's' : ''}</i>
							</div>
						</Form.Group>

						<hr style={{ borderColor: 'rgba(var(--lumon-cyan-rgb), 0.15)', margin: '10px 0' }} />

						<Form.Group className="mb-2">
							<Form.Check
								type="checkbox"
								id="onlyOneAnswer"
								checked={onlyOneAnswer}
								onChange={(e) => setOnlyOneAnswer(e.target.checked)}
								label="Une seule réponse par personne (comme en QCM)"
							/>
						</Form.Group>

						<Form.Group>
							<Form.Check
								type="checkbox"
								id="penalizeWrong"
								checked={penalizeWrong}
								onChange={(e) => setPenalizeWrong(e.target.checked)}
								label="Retirer 1 point pour chaque mauvaise réponse"
							/>
						</Form.Group>
					</div>

					{/* Message d'erreur */}
					{modeError && (
						<div className="terminal-alert terminal-alert-danger mt-2">
							{modeError}
						</div>
					)}
				</Modal.Body>
				<Modal.Footer>
					<button
						className="terminal-btn"
						onClick={() => {
							setShowModeSelector(false);
							setQuizQuestionCount(10);
							setModeError('');
						}}
					>
						Annuler
					</button>
					<button
						className="terminal-btn terminal-btn-success"
						onClick={handleStartQuiz}
						disabled={allVisibleBoxes.length === 0 || (selectedBoxNames !== null && selectedBoxNames.length === 0)}
					>
						Lancer le quiz
					</button>
				</Modal.Footer>
			</Modal>

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
										const allQuestions = questionsStore.questions;
										const selectedQuestions = allQuestions.filter(q => effectiveBoxNames.includes(q.boxName));
										const qcmCount = selectedQuestions.filter(q => q.questionType === QuestionType.QCM).length;
										const freeCount = selectedQuestions.length - qcmCount;

										const isSingle = effectiveBoxNames.length === 1;
										const singleBox = isSingle ? questionsStore.getBoxByName(effectiveBoxNames[0]) : null;

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
												</div>
											</div>
										);
									})()}

									{allVisibleBoxes.length > 0 && (
										<div className="mt-4 p-3 terminal-panel" style={{ display: 'block', maxWidth: '920px', margin: '16px auto 0' }}>
											<p className="mb-2" style={{ color: 'var(--lumon-text-dim)' }}>
												<strong style={{ color: 'var(--lumon-cyan)' }}>
													Boîtes disponibles
												</strong>
												<span style={{ color: 'var(--lumon-text-muted)', fontSize: '0.75rem', marginLeft: '8px' }}>
													— cliquez pour sélectionner
												</span>
											</p>
											<div
												className="mdr-data-point-container"
												ref={mdrContainerRef}
												onMouseLeave={() => setMdrHoveredIndex(null)}
											>
												{/* Card 0 : ★ TOUTES */}
												<div
													ref={el => { mdrItemRefs.current[0] = el; }}
													className={`mdr-data-point mdr-all-boxes ${getMdrClass(0)}`}
													onMouseEnter={() => setMdrHoveredIndex(0)}
													onClick={() => setSelectedBoxNames(prev => prev === null ? [] : null)}
												>
													★ TOUTES
												</div>
												{/* Boîtes avec sous-boîtes inline */}
												{displayedBoxes.map((entry, i) => {
													const { box: b, isSubBox } = entry;
													const isMaster = !isSubBox && masterSubBoxMap.has(b.name);
													const isExpanded = isMaster && expandedMasters.has(b.name);
													const subCount = isMaster ? (masterSubBoxMap.get(b.name)?.length ?? 0) : 0;
													const theme = boxThemeMap.get(b.name);
													const boxStyle: any = {
														'--box-theme': theme?.color || 'var(--lumon-cyan)',
														'--box-theme-rgb': theme?.rgb || 'var(--lumon-cyan-rgb)',
													};
													return (
														<div
															key={b.name}
															ref={el => { mdrItemRefs.current[i + 1] = el; }}
															className={`mdr-data-point mdr-themed ${isMaster ? 'mdr-master-box' : ''} ${isSubBox ? 'mdr-sub-box' : ''} ${getMdrClass(i + 1)}`}
															onMouseEnter={() => setMdrHoveredIndex(i + 1)}
															onClick={() => { if (isMaster) handleMasterSelectToggle(b.name); else handleBoxClick(b.name); }}
															title={isMaster ? `Sélectionner "${b.name}" et ses ${subCount} sous-boîte(s)` : (b.description || undefined)}
															style={boxStyle}
														>
															{isMaster && (
																<span
																	className="mdr-chevron"
																	onClick={(e) => { e.stopPropagation(); handleMasterExpandToggle(b.name); }}
																	title={isExpanded ? 'Réduire' : `Déplier (${subCount})`}
																>
																	{isExpanded ? '▼' : '▶'}
																</span>
															)}
															{isSubBox && <span className="mdr-sub-connector">└</span>}
															{b.ordered && <span style={{ fontSize: '0.55rem', marginRight: '4px', opacity: 0.7 }}>↓</span>}
															<span className="mdr-box-name">{b.name}</span>
															{isMaster && <span className="mdr-sub-count">({subCount})</span>}
														</div>
													);
												})}
											</div>
										</div>
									)}
								</div>
							)}

							{activeQuiz && currentQuestion && (
								<div style={{ flex: 1 }}>
									{/* Boîte et timer */}
									<div className="mb-4">
									<div
										className="terminal-badge"
										style={{
										backgroundColor: 'rgba(255, 255, 255, 0.1)',
										borderColor: 'rgba(255, 255, 255, 0.5)',
										color: 'white',
										padding: '8px 20px',
										display: 'inline-block',
										fontFamily: "'Orbitron', sans-serif",
										fontSize: '0.75rem',
										letterSpacing: '0.15em',
										textTransform: 'uppercase' as const,
										marginBottom: '15px'
										}}
									>
										{currentQuestion.boxName}
									</div>

									<div className={timerUrgencyClass} style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										margin: '0 auto',
										position: 'relative',
										width: '180px',
										height: '180px',
									}}>
										<svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
											{/* Gauge tick marks */}
											{Array.from({ length: 24 }).map((_, i) => {
												const angle = (i * 15) * (Math.PI / 180);
												const isMajor = i % 6 === 0;
												const outerR = 86;
												const innerR = isMajor ? 78 : 81;
												return (
													<line
														key={i}
														x1={90 + outerR * Math.cos(angle)}
														y1={90 + outerR * Math.sin(angle)}
														x2={90 + innerR * Math.cos(angle)}
														y2={90 + innerR * Math.sin(angle)}
														stroke="rgba(0, 112, 128, 0.3)"
														strokeWidth={isMajor ? 2 : 1}
													/>
												);
											})}
											{/* Background track */}
											<circle
												cx="90" cy="90" r={timerRadius}
												fill="none"
												stroke="rgba(0, 112, 128, 0.15)"
												strokeWidth="6"
											/>
											{/* Progress ring (rAF-driven) */}
											<circle
												ref={timerCircleRef}
												cx="90" cy="90" r={timerRadius}
												fill="none"
												stroke={timerColor}
												strokeWidth="6"
												strokeLinecap="round"
												strokeDasharray={timerCircumference}
												strokeDashoffset={timerCircumference * (1 - timeLeft / questionTimeLimit)}
												style={{
													transition: 'stroke 0.5s ease',
													filter: `drop-shadow(0 0 6px ${timerColor})`,
												}}
											/>
										</svg>
										{/* Center number */}
										<div style={{ textAlign: 'center', zIndex: 1 }}>
											<div style={{
												fontFamily: "'Orbitron', sans-serif",
												fontSize: '3.2rem',
												fontWeight: 900,
												letterSpacing: '0.05em',
												lineHeight: 1,
												color: timerColor,
												transition: 'color 0.5s ease',
												textShadow: `0 0 12px ${timerColor}, 0 0 24px ${timerColor}40`,
											}}>
												{timeLeft}
											</div>
											<div style={{
												fontFamily: "'Share Tech Mono', monospace",
												fontSize: '0.55rem',
												color: 'var(--lumon-text-muted)',
												textTransform: 'uppercase' as const,
												letterSpacing: '0.25em',
												marginTop: '4px',
											}}>
												sec
											</div>
										</div>
									</div>
									</div>

									{/* Question */}
									<div className="question-box terminal-panel border-glow-cyan" style={{
										padding: '30px',
										marginBottom: '20px',
										minHeight: '150px',
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										justifyContent: 'center'
									}}>
										<h2 className="phosphor-text typewriter-wrap" key={activeQuiz.currentQuestionIndex} style={{
											textAlign: 'center',
											margin: 0,
											fontFamily: "'Orbitron', sans-serif",
											fontSize: '1.4rem',
											letterSpacing: '0.05em'
										}}>
											{renderWithEmojiBoost(currentQuestion.question)}
										</h2>

										{/* Options QCM */}
										{isQcmQuestion && currentQuestion.qcmOptions && !questionRevealed && (
											<div className="qcm-options mt-4" style={{ width: '100%', maxWidth: '700px' }}>
												<div className="row g-3">
													{currentQuestion.qcmOptions.map((option, index) => {
														const optionCount = currentQuestion.qcmOptions!.length;
														let colClass: string;
														if (optionCount <= 2) {
															colClass = 'col-6';
														} else if (optionCount === 3) {
															colClass = 'col-4';
														} else if (optionCount === 4) {
															colClass = 'col-6';
														} else if (optionCount === 5) {
															colClass = index < 3 ? 'col-4' : 'col-6';
														} else {
															colClass = 'col-4';
														}
														return (
															<div key={index} className={colClass}>
																<div className="qcm-option-terminal">
																	<span className="qcm-label">{QCM_LABELS[index]}</span>
																	<span style={{ color: 'var(--lumon-text-dim)' }}>—</span>
																	<span style={{ color: 'var(--lumon-text)' }}>{renderWithEmojiBoost(option)}</span>
																</div>
															</div>
														);
													})}
												</div>
												<p className="text-center mt-3 system-artifact" style={{ fontSize: '12px', opacity: 0.7 }}>
													{(() => {
														const correctCount = (currentQuestion.qcmCorrectIndexes ?? (currentQuestion.qcmCorrectIndex !== undefined ? [currentQuestion.qcmCorrectIndex] : [])).length;
														if (correctCount > 1) {
															return <>Répondez avec les <strong>{correctCount} lettres</strong> correctes (ex: A,C) dans le chat</>;
														}
														return <>Répondez avec{' '}
															{currentQuestion.qcmOptions!.map((_, i) => (
																<span key={i}>
																	{i > 0 && (i === currentQuestion.qcmOptions!.length - 1 ? ' ou ' : ', ')}
																	<strong>{QCM_LABELS[i]}</strong>
																</span>
															))}{' '}
															dans le chat</>;
													})()}
												</p>
											</div>
										)}
									</div>

									{/* Réponse révélée */}
									{questionRevealed && (
										<div className="answer-box-terminal" style={{
											marginBottom: '20px'
										}}>
											<h3 style={{ margin: 0 }}>
												<span className="emoji-boost">✅</span> {isQcmQuestion && (currentQuestion.qcmCorrectIndexes || currentQuestion.qcmCorrectIndex !== undefined)
													? (() => {
														const idxs = currentQuestion.qcmCorrectIndexes
															?? (currentQuestion.qcmCorrectIndex !== undefined ? [currentQuestion.qcmCorrectIndex] : []);
														return renderWithEmojiBoost(idxs.map(i => `${QCM_LABELS[i]} - ${currentQuestion.qcmOptions?.[i] || ''}`).join(', '));
													})()
													: renderWithEmojiBoost(currentQuestion.answer)}
											</h3>
										</div>
									)}

									{/* Bouton de signalement — après révélation */}
									{questionRevealed && currentQuestion && (
										<div className="report-section">
											{reportSent ? (
												<div className="report-feedback report-feedback-success">
													<FontAwesomeIcon icon={['fas', 'check']} /> Signalement envoyé
												</div>
											) : reportError ? (
												<div className="report-feedback report-feedback-error">{reportError}</div>
											) : !showReportMenu ? (
												<div className="report-flag-row">
													<button
														className="report-flag-btn"
														onClick={() => setShowReportMenu(true)}
													>
														<FontAwesomeIcon icon={['fas', 'flag']} />
														<span className="report-flag-label">Signaler</span>
													</button>
												</div>
											) : (
												<div className="report-options">
													<div className="report-options-header">
														<span>Signaler cette question</span>
														<button className="report-close-btn" onClick={() => setShowReportMenu(false)}>✕</button>
													</div>
													<div className="report-options-list">
														{([
															{ reason: 'question_incorrecte' as ReportReason, label: 'Question incorrecte' },
															{ reason: 'reponse_non_accepter' as ReportReason, label: 'Réponses non accepté' },
															{ reason: 'categorie_incorrecte' as ReportReason, label: 'Mauvaise catégorie' },
															{ reason: 'question_obsolete' as ReportReason, label: 'Question obsolète' },
														]).map(({ reason, label }) => (
															<button
																key={reason}
																className="report-option-btn"
																onClick={async () => {
																	try {
																		await apiCreateReport({
																			questionId: currentQuestion.id,
																			questionText: currentQuestion.question,
																			reason,
																		});
																		setShowReportMenu(false);
																		setReportSent(true);
																	} catch (err: any) {
																		setReportError(err.message || 'Erreur lors du signalement');
																		setShowReportMenu(false);
																	}
																}}
															>
																{label}
															</button>
														))}
													</div>
												</div>
											)}
										</div>
									)}

									{/* Liste des joueurs ayant répondu - seulement après révélation */}
									{questionRevealed && lastAnswerersRef.current.length > 0 && (
										<div className="answerers-list" style={{ marginTop: '20px' }}>
											<h5 className="text-display-tech" style={{ fontSize: '0.8rem', color: 'var(--lumon-cyan)' }}>
												Ont répondu correctement :
											</h5>
											<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
												{lastAnswerersRef.current.map((answerer) => (
													<span
														key={answerer.nick}
														className={answerer.isFirst ? 'answerer-chip answerer-chip-first' : 'answerer-chip'}
													>
														{answerer.isFirst && '★ '}{answerer.nick}
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
									&nbsp;
									<button
										className="terminal-btn terminal-btn-danger terminal-btn-sm"
										id="skipButton"
										disabled={questionRevealed}
										onClick={handleSkipQuestion}
										style={{ width: '35px' }}
									>
										<FontAwesomeIcon icon={['fas', 'step-forward']} />
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
