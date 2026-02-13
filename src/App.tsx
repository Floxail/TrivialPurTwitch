import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import GlobalMenu from 'components/global-menu';
import { useAuthStore } from 'components/store/auth-store';
import { useGlobalStore } from 'components/store/global-store';
import { useSettingsStore } from 'components/store/settings-store';
import { useQuestionsStore } from 'components/store/questions-store';
import { useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Login from './components/login';
import LoginCallback from './components/login-callback';
import Settings from './components/settings';
import './icons';
import Quiz from './components/quiz';
import QuestionManager from './components/question-manager-v2';
import QuestionManagerTerminal from './components/question-manager-terminal';
import Convertisseur from './components/convertisseur';

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
	// Migration automatique au premier chargement
useEffect(() => {
  const migrated = localStorage.getItem('quiz_migration_v2_done');
  if (!migrated) {
    console.log('🔄 Migration v1 → v2 détectée...');
    questionsStore.migrateFromV1();
    localStorage.setItem('quiz_migration_v2_done', 'true');
  }
  
  // AJOUTER ICI : Charger depuis GitHub
  const lastSync = localStorage.getItem('quiz_last_github_sync');
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 heure au lieu de 24h

  // Charger depuis GitHub si :
  // - Jamais synchronisé
  // - Dernière sync > 1h
  if (!lastSync || (now - parseInt(lastSync)) > oneHour) {
    console.log('🔄 Chargement des questions depuis GitHub...');
    questionsStore.loadFromGitHub().then(() => {
      localStorage.setItem('quiz_last_github_sync', now.toString());
    });
  }

  // Sync périodique en arrière-plan toutes les heures
  const syncInterval = setInterval(() => {
    const lastSyncTime = localStorage.getItem('quiz_last_github_sync');
    const currentTime = Date.now();

    if (!lastSyncTime || (currentTime - parseInt(lastSyncTime)) > oneHour) {
      console.log('🔄 Synchronisation automatique en arrière-plan...');
      questionsStore.loadFromGitHub().then(() => {
        localStorage.setItem('quiz_last_github_sync', currentTime.toString());
      });
    }
  }, oneHour); // Vérifier toutes les heures

  // Nettoyer l'intervalle quand le composant est démonté
  return () => clearInterval(syncInterval);
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
					<Route path="/questions-terminal" element={<QuestionManagerTerminal />} />
					<Route path="/convertisseur" element={<Convertisseur />} />
					<Route path="/callback" element={<LoginCallback />} />
					<Route path="/settings" element={<Settings />} />
</Routes>
			</div>
		</>
	);
}

export default App;
