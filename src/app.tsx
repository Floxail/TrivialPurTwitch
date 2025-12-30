import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import GlobalMenu from 'components/global-menu';
import { useAuthStore } from 'components/store/auth-store';
import { useGlobalStore } from 'components/store/global-store';
import { useSettingsStore } from 'components/store/settings-store';
import { useQuizStore } from 'components/store/quiz-store-v2';
import { useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Login from './components/login';
import LoginCallback from './components/login-callback';
import Settings from './components/settings';
import './icons';
import Quiz from './components/quiz';
import QuestionManager from './components/question-manager-v2';

function App() {
	const navigate = useNavigate();

	const settingsStore = useSettingsStore();
	const authStore = useAuthStore();
	const globalStore = useGlobalStore();
	const quizStore = useQuizStore();

	const [view, setView] = useState(<div />);
	const [errorMessage, setErrorMessage] = useState('');

	const location = useLocation();

	useEffect(() => {
		authStore.validateTwitchOAuthToken();
	}, []);

	// Migration automatique au premier chargement
	// Migration automatique au premier chargement
useEffect(() => {
  const migrated = localStorage.getItem('quiz_migration_v2_done');
  if (!migrated) {
    console.log('🔄 Migration v1 → v2 détectée...');
    quizStore.migrateFromV1();
    localStorage.setItem('quiz_migration_v2_done', 'true');
  }
  
  // AJOUTER ICI : Charger depuis GitHub
  const lastSync = localStorage.getItem('quiz_last_github_sync');
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  // Charger depuis GitHub si :
  // - Jamais synchronisé
  // - Dernière sync > 24h
  if (!lastSync || (now - parseInt(lastSync)) > oneDay) {
    console.log('🔄 Chargement des questions depuis GitHub...');
    quizStore.loadFromGitHub().then(() => {
      localStorage.setItem('quiz_last_github_sync', now.toString());
    });
  }
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
	}, [navigate, authStore, settingsStore]);

	const onPopupClose = () => {
		setErrorMessage('');
		navigate('/');
	};

	const loggedIn = authStore.isLoggedIn();
	return (
		<>
			<header className="app-header">
				<div style={{ position: 'absolute', left: 0, fontSize: '1.3333rem', padding: '4px' }}>
					<FontAwesomeIcon icon={['fab', 'galactic-republic']} color="var(--spot-color)" size="lg" />
					<a className="btt" href={process.env.PUBLIC_URL}> <b>T</b>rivial<b>P</b>ur<b>T</b>witch</a>
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
						<Alert className="alert-modal" variant="danger">
							<Alert.Heading>Error</Alert.Heading>
							<p>
								Spotify server returned : {errorMessage}
							</p>
							<div className="d-flex justify-content-center">
								<Button onClick={onPopupClose} variant="outline-danger">
									Close
								</Button>
							</div>
						</Alert>
					</div>
				}
				<Routes>
					<Route path="/" element={view} />
					<Route path="/quiz" element={<Quiz />} />
					<Route path="/questions" element={<QuestionManager />} />
					<Route path="/callback" element={<LoginCallback />} />
					<Route path="/settings" element={<Settings />} />
</Routes>
			</div>
		</>
	);
}

export default App;
