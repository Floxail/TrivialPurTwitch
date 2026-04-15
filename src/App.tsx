import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import GlobalMenu from 'components/global-menu';
import { useAuthStore } from 'components/store/auth-store';
import { useGlobalStore } from 'components/store/global-store';
import { useSettingsStore } from 'components/store/settings-store';
import { useQuestionsStore } from 'components/store/questions-store';
import { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Login from './components/login';
import LoginCallback from './components/login-callback';
import Settings from './components/settings';
import './icons';
import Quiz from './components/quiz';
import QuestionManager from './components/question-manager-v2';
import QuestionManagerTerminal from './components/question-manager-terminal';
import AdminDashboard from './components/admin-dashboard';
import ContributionPage from './components/contribution-page';
import Convertisseur from './components/convertisseur';
import Stats from './components/stats';
import { Analytics } from '@vercel/analytics/react';

function App() {
	const navigate = useNavigate();

	const settingsStore = useSettingsStore();
	const authStore = useAuthStore();
	const globalStore = useGlobalStore();
	const questionsStore = useQuestionsStore();

	const [view, setView] = useState(<div />);
	const [errorMessage, setErrorMessage] = useState('');

	const location = useLocation();

	useEffect(() => {
		authStore.validateTwitchOAuthToken();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Migration automatique au premier chargement
	useEffect(() => {
		const migrated = localStorage.getItem('quiz_migration_v2_done');
		if (!migrated) {
			console.log('🔄 Migration v1 → v2 détectée...');
			questionsStore.migrateFromV1();
			localStorage.setItem('quiz_migration_v2_done', 'true');
		}

		// Sync obligatoire au démarrage (non-silencieux) pour garantir des données fraîches
		questionsStore.syncFromDB();

		// Sync périodique en arrière-plan toutes les 2 minutes (silencieux)
		const syncInterval = setInterval(() => {
			questionsStore.autoSyncIfNeeded();
		}, 2 * 60 * 1000);

		// Sync quand l'utilisateur revient sur l'onglet (changement de visibilité ou focus)
		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				questionsStore.autoSyncIfNeeded();
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
		if (!authStore.isLoggedIn()) {
			setView(<Login />);
	 		navigate('/');
		} else if (!settingsStore.isInitialized()) {
			navigate('/settings');
		} else if (location.pathname === '/') {
	 	 // Rediriger vers le quiz au lieu du blind test
			setView(<Quiz />);
	 		navigate('/quiz');
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [navigate, authStore, settingsStore]);

	const onPopupClose = () => {
		setErrorMessage('');
		navigate('/');
	};

	const loggedIn = authStore.isLoggedIn();
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
					<span className="btt" role="button" tabIndex={0} onClick={() => navigate('/quiz')} onKeyDown={(e) => e.key === 'Enter' && navigate('/quiz')} style={{ cursor: 'pointer' }}> <b>T</b>rivial<b>P</b>ur<b>T</b>witch</span>
				</div>
				<div style={{ position: 'absolute', right: 0 }}>
					{loggedIn &&
						<GlobalMenu />
					}
				</div>
				<p id="subtitle" className="lead text-secondary">
					{globalStore.subtitle}
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
				<Routes>
					<Route path="/" element={view} />
					<Route path="/quiz" element={<Quiz />} />
					<Route path="/questions" element={authStore.isAdmin ? <QuestionManager /> : <Quiz />} />
					<Route path="/questions-terminal" element={authStore.isAdmin ? <QuestionManagerTerminal /> : <Quiz />} />
					<Route path="/convertisseur" element={<Convertisseur />} />
					<Route path="/contribute" element={<ContributionPage />} />
					<Route path="/system-mod-portal" element={<AdminDashboard />} />
					<Route path="/callback" element={<LoginCallback />} />
					<Route path="/settings" element={<Settings />} />
					<Route path="/stats" element={<Stats />} />
					<Route path="/stats/:username" element={<Stats />} />
</Routes>
			</div>
		<Analytics />
		</>
	);
}

export default App;
