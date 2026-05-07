import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import GlobalMenu from 'components/global-menu';
import { useAuthStore } from 'components/store/auth-store';
import { useGlobalStore } from 'components/store/global-store';
import { useSettingsStore } from 'components/store/settings-store';
import { useQuestionsStore } from 'components/store/questions-store';
import { useGameStore } from 'components/store/game-store';
import { useEffect, useState, lazy, Suspense } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Login from './components/login';
import LoginCallback from './components/login-callback';
import './icons';
import Quiz from './components/quiz';
import Welcome, { shouldShowWelcome } from './components/welcome';
import { Analytics } from '@vercel/analytics/react';

// Routes lazy-loaded — économise du JS au boot pour les pages peu visitées
const Settings = lazy(() => import('./components/settings'));
const QuestionManager = lazy(() => import('./components/question-manager-v2'));
const QuestionManagerTerminal = lazy(() => import('./components/question-manager-terminal'));
const AdminDashboard = lazy(() => import('./components/admin-dashboard'));
const ContributionPage = lazy(() => import('./components/contribution-page'));
const Convertisseur = lazy(() => import('./components/convertisseur'));
const Stats = lazy(() => import('./components/stats'));

const RouteFallback = () => (
	<div style={{ textAlign: 'center', padding: '3rem' }}>
		<div className="text-glow-cyan" style={{ fontFamily: "'Orbitron', sans-serif" }}>Chargement…</div>
	</div>
);

function App() {
	const navigate = useNavigate();

	// Sélecteurs granulaires : on lit seulement les valeurs/actions utilisées par App
	const isInitialized = useSettingsStore(s => s.isInitialized);
	const isLoggedIn = useAuthStore(s => s.isLoggedIn);
	const isAdmin = useAuthStore(s => s.isAdmin);
	const validateTwitchOAuthToken = useAuthStore(s => s.validateTwitchOAuthToken);
	const subtitle = useGlobalStore(s => s.subtitle);
	const migrateFromV1 = useQuestionsStore(s => s.migrateFromV1);
	const syncFromDB = useQuestionsStore(s => s.syncFromDB);
	const autoSyncIfNeeded = useQuestionsStore(s => s.autoSyncIfNeeded);

	const [view, setView] = useState(<div />);
	const [errorMessage, setErrorMessage] = useState('');
	const [showWelcome, setShowWelcome] = useState(false);
	const [showQuitConfirm, setShowQuitConfirm] = useState(false);

	const location = useLocation();
	const activeQuiz = useGameStore(s => s.activeQuiz);
	const endQuiz = useGameStore(s => s.endQuiz);

	useEffect(() => {
		validateTwitchOAuthToken();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Migration automatique au premier chargement
	useEffect(() => {
		const migrated = localStorage.getItem('quiz_migration_v2_done');
		if (!migrated) {
			console.log('🔄 Migration v1 → v2 détectée...');
			migrateFromV1();
			localStorage.setItem('quiz_migration_v2_done', 'true');
		}

		// Sync obligatoire au démarrage (non-silencieux) pour garantir des données fraîches
		syncFromDB();

		// Sync périodique en arrière-plan toutes les 2 minutes (silencieux)
		const syncInterval = setInterval(() => {
			autoSyncIfNeeded();
		}, 2 * 60 * 1000);

		// Sync quand l'utilisateur revient sur l'onglet (changement de visibilité ou focus)
		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				autoSyncIfNeeded();
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('focus', onVisible);

		return () => {
			clearInterval(syncInterval);
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('focus', onVisible);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!isLoggedIn()) {
			setView(<Login />);
	 		navigate('/');
		} else if (!isInitialized()) {
			navigate('/settings');
		} else if (location.pathname === '/') {
			setView(<Quiz />);
			navigate('/quiz');
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [navigate]);

	useEffect(() => {
		const isHome = location.pathname === '/' || location.pathname === '/quiz';
		if (isLoggedIn() && isInitialized() && isHome && shouldShowWelcome()) {
			setShowWelcome(true);
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const onPopupClose = () => {
		setErrorMessage('');
		navigate('/');
	};

	const handleTitleClick = () => {
		if (activeQuiz) {
			setShowQuitConfirm(true);
		} else {
			navigate('/quiz');
		}
	};

	const confirmQuitQuiz = () => {
		endQuiz();
		setShowQuitConfirm(false);
		navigate('/quiz');
	};

	const loggedIn = isLoggedIn();
	return (
		<>
			{/* CRT Scanline overlay - Lumon Industries terminal effect */}
			<div className="crt-overlay" />
			<header className="app-header">
				<div style={{ position: 'absolute', left: 0, fontSize: '1.3333rem', padding: '4px' }}>
					<img 
						src="/favicon.png" 
						alt="Logo" 
						width="30" 
						height="30" 
						className="me-2 d-inline-block align-top" 
						style={{ borderRadius: '4px' }}
						/>
					<span className="btt" role="button" tabIndex={0} onClick={handleTitleClick} onKeyDown={(e) => e.key === 'Enter' && handleTitleClick()} style={{ cursor: 'pointer' }}> <b>T</b>rivial<b>P</b>ur<b>T</b>witch</span>
				</div>
				<div style={{ position: 'absolute', right: 0 }}>
					{loggedIn &&
						<GlobalMenu />
					}
				</div>
				<p id="subtitle" className="lead text-secondary">
					{subtitle}
				</p>
			</header>
			<div className={'app container'}>
				{errorMessage &&
					<div className="alert-modal-bg">
						<div className="alert-modal terminal-alert terminal-alert-danger">
							<h5 className="text-glow-danger" style={{ fontFamily: "'Orbitron', sans-serif", marginBottom: '1rem' }}>Error</h5>
							<p>
								Server returned : {errorMessage}
							</p>
							<div className="d-flex justify-content-center">
								<button className="terminal-btn terminal-btn-danger" onClick={onPopupClose}>
									Close
								</button>
							</div>
						</div>
					</div>
				}
				{showQuitConfirm &&
					<div className="alert-modal-bg">
						<div className="alert-modal terminal-alert terminal-alert-warning">
							<h5 className="text-glow-amber" style={{ fontFamily: "'Orbitron', sans-serif", marginBottom: '1rem' }}>Arrêter le quiz ?</h5>
							<p>
								Le quiz en cours sera perdu. Êtes-vous sûr ?
							</p>
							<div className="d-flex justify-content-center gap-2">
								<button className="terminal-btn terminal-btn-danger" onClick={confirmQuitQuiz}>
									Oui, arrêter
								</button>
								<button className="terminal-btn" onClick={() => setShowQuitConfirm(false)}>
									Annuler
								</button>
							</div>
						</div>
					</div>
				}
				<Suspense fallback={<RouteFallback />}>
					<Routes>
						<Route path="/" element={view} />
						<Route path="/quiz" element={<Quiz />} />
						<Route path="/questions" element={isAdmin ? <QuestionManager /> : <Quiz />} />
						<Route path="/questions-terminal" element={isAdmin ? <QuestionManagerTerminal /> : <Quiz />} />
						<Route path="/convertisseur" element={<Convertisseur />} />
						<Route path="/contribute" element={<ContributionPage />} />
						<Route path="/system-mod-portal" element={<AdminDashboard />} />
						<Route path="/callback" element={<LoginCallback />} />
						<Route path="/settings" element={<Settings />} />
						<Route path="/stats" element={<Stats />} />
						<Route path="/stats/:username" element={<Stats />} />
					</Routes>
				</Suspense>
			</div>
		<Analytics />
		<Welcome show={showWelcome} onClose={() => setShowWelcome(false)} />
		</>
	);
}

export default App;
