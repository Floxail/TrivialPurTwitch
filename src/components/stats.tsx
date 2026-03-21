import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGlobalStore } from './store/global-store';
import { useAuthStore } from './store/auth-store';
import {
  apiGetGlobalStats,
  apiGetPlayerFullStats,
  type GlobalStats,
  type PlayerFullStats,
} from '../services/api-stats-service';

// ==================== Helpers ====================

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatMs = (ms: number | null) => {
  if (!ms || ms <= 0) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
};

// ==================== Stat Card ====================

const StatCard = ({ label, value, icon, color }: { label: string; value: string | number; icon: string; color?: string }) => (
  <div style={{
    background: 'var(--lumon-surface)',
    border: '1px solid var(--lumon-border)',
    borderRadius: '8px',
    padding: '1rem',
    textAlign: 'center',
    minWidth: '140px',
    flex: '1 1 140px',
  }}>
    <div style={{ fontSize: '1.5rem', color: color || 'var(--lumon-cyan)', marginBottom: '0.3rem' }}>
      <FontAwesomeIcon icon={['fas', icon as any]} />
    </div>
    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--lumon-text)', fontFamily: "'Share Tech Mono', monospace" }}>
      {value}
    </div>
    <div style={{ fontSize: '0.75rem', color: 'var(--lumon-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </div>
  </div>
);

// ==================== Global Stats View ====================

const GlobalStatsView = ({ stats, onPlayerClick }: { stats: GlobalStats; onPlayerClick: (nick: string) => void }) => (
  <div>
    {/* Cartes résumé */}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
      <StatCard label="Parties jouées" value={stats.totalSessions} icon="gamepad" />
      <StatCard label="Joueurs uniques" value={stats.totalPlayers} icon="users" />
      <StatCard label="Questions en DB" value={stats.totalQuestionsInDB} icon="database" color="var(--lumon-green)" />
      <StatCard label="Réponses données" value={stats.totalQuestionsAnswered} icon="comment-dots" color="var(--lumon-warning)" />
    </div>

    {/* Chaînes actives */}
    {stats.channels.length > 0 && (
      <div className="terminal-panel" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <h6 style={{ color: 'var(--lumon-cyan)', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          <FontAwesomeIcon icon={['fab', 'twitch']} className="me-2" />
          CHAÎNES ACTIVES
        </h6>
        <table className="bt-t" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Chaîne</th>
              <th style={{ textAlign: 'center' }}>Quiz lancés</th>
              <th style={{ textAlign: 'center' }}>Joueurs</th>
              <th style={{ textAlign: 'right' }}>Dernier quiz</th>
            </tr>
          </thead>
          <tbody>
            {stats.channels.map((ch) => (
              <tr key={ch.channelName}>
                <td>
                  <FontAwesomeIcon icon={['fab', 'twitch']} style={{ color: '#6441A4', marginRight: '6px' }} />
                  {ch.channelName}
                </td>
                <td style={{ textAlign: 'center' }}>{ch.quizCount}</td>
                <td style={{ textAlign: 'center' }}>{ch.playerCount}</td>
                <td style={{ textAlign: 'right', color: 'var(--lumon-text-dim)' }}>{formatDate(ch.lastQuiz)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {/* Questions les plus difficiles */}
    {stats.hardestQuestions.length > 0 && (
      <div className="terminal-panel" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <h6 style={{ color: 'var(--lumon-danger)', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          <FontAwesomeIcon icon={['fas', 'skull-crossbones']} className="me-2" />
          QUESTIONS LES PLUS DIFFICILES
        </h6>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {stats.hardestQuestions.map((q) => (
            <div key={q.questionId} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.5rem', background: 'var(--lumon-void)', borderRadius: '4px', fontSize: '0.85rem',
            }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '1rem' }}>
                {q.questionText}
              </span>
              <span style={{
                color: q.successRate < 30 ? 'var(--lumon-danger)' : 'var(--lumon-warning)',
                fontFamily: "'Share Tech Mono', monospace", whiteSpace: 'nowrap',
              }}>
                {q.successRate}% ({q.timesCorrect}/{q.timesAsked})
              </span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Questions les plus faciles */}
    {stats.easiestQuestions.length > 0 && (
      <div className="terminal-panel" style={{ padding: '1rem' }}>
        <h6 style={{ color: 'var(--lumon-green)', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          <FontAwesomeIcon icon={['fas', 'check-circle']} className="me-2" />
          QUESTIONS LES PLUS FACILES
        </h6>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {stats.easiestQuestions.map((q) => (
            <div key={q.questionId} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.5rem', background: 'var(--lumon-void)', borderRadius: '4px', fontSize: '0.85rem',
            }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '1rem' }}>
                {q.questionText}
              </span>
              <span style={{
                color: 'var(--lumon-green)',
                fontFamily: "'Share Tech Mono', monospace", whiteSpace: 'nowrap',
              }}>
                {q.successRate}% ({q.timesCorrect}/{q.timesAsked})
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ==================== Player Stats View ====================

const PlayerStatsView = ({ stats }: { stats: PlayerFullStats }) => {
  const p = stats.player;

  return (
    <div>
      {/* En-tête joueur */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem',
        padding: '1rem', background: 'var(--lumon-surface)', border: '1px solid var(--lumon-border)', borderRadius: '8px',
      }}>
        <div style={{ flex: 1 }}>
          <h5 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", color: 'var(--lumon-cyan)' }}>
            {p.nick}
          </h5>
          <div style={{ color: 'var(--lumon-text-dim)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Membre depuis {formatDate(p.firstGame)} — Dernière partie {formatDate(p.lastGame)}
          </div>
        </div>
      </div>

      {/* Cartes stats */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard label="Score total" value={p.totalScore} icon="star" />
        <StatCard label="Meilleur score" value={p.bestScore} icon="trophy" color="var(--lumon-warning)" />
        <StatCard label="Score moyen" value={p.avgScore} icon="chart-line" color="var(--lumon-green)" />
        <StatCard label="Parties jouées" value={p.sessions} icon="gamepad" />
        <StatCard label="Bonnes réponses" value={p.totalAnswers} icon="check" color="var(--lumon-green)" />
        <StatCard label="Premier !" value={p.totalFirsts} icon="bolt" color="var(--lumon-warning)" />
        <StatCard label="Combos" value={p.totalCombos} icon="fire" color="var(--lumon-danger)" />
        <StatCard label="Plus rapide" value={formatMs(p.bestFastest)} icon="stopwatch" />
        {p.questionsAdded > 0 && (
          <StatCard label="Questions ajoutées" value={p.questionsAdded} icon="plus-circle" color="var(--lumon-cyan)" />
        )}
        {p.questionsSubmitted > 0 && (
          <StatCard label="Questions proposées" value={p.questionsSubmitted} icon="pen" color="var(--lumon-cyan)" />
        )}
        {p.boxesCreated > 0 && (
          <StatCard label="Boîtes créées" value={p.boxesCreated} icon="box-open" color="var(--lumon-green)" />
        )}
      </div>

      {/* Meilleure session */}
      {stats.bestSession && (
        <div className="terminal-panel" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <h6 style={{ color: 'var(--lumon-warning)', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            <FontAwesomeIcon icon={['fas', 'crown']} className="me-2" />
            MEILLEURE SESSION
          </h6>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem' }}>
            <span><strong>{stats.bestSession.score}</strong> pts</span>
            <span>{stats.bestSession.answers} réponses</span>
            <span>{stats.bestSession.firsts} premiers</span>
            {stats.bestSession.boxName && <span>Boîte : {stats.bestSession.boxName}</span>}
            {stats.bestSession.channelName && (
              <span>
                <FontAwesomeIcon icon={['fab', 'twitch']} style={{ color: '#6441A4' }} /> {stats.bestSession.channelName}
              </span>
            )}
            <span style={{ color: 'var(--lumon-text-dim)' }}>{formatDateTime(stats.bestSession.createdAt)}</span>
          </div>
        </div>
      )}

      {/* Stats par boîte */}
      {stats.byBox.length > 0 && (
        <div className="terminal-panel" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <h6 style={{ color: 'var(--lumon-cyan)', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            <FontAwesomeIcon icon={['fas', 'box-open']} className="me-2" />
            PERFORMANCE PAR BOÎTE
          </h6>
          <table className="bt-t" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Boîte</th>
                <th style={{ textAlign: 'center' }}>Parties</th>
                <th style={{ textAlign: 'center' }}>Score total</th>
                <th style={{ textAlign: 'center' }}>Réponses</th>
                <th style={{ textAlign: 'center' }}>Moy.</th>
              </tr>
            </thead>
            <tbody>
              {stats.byBox.map((b) => (
                <tr key={b.boxName}>
                  <td>{b.boxName}</td>
                  <td style={{ textAlign: 'center' }}>{b.games}</td>
                  <td style={{ textAlign: 'center' }}>{b.totalScore}</td>
                  <td style={{ textAlign: 'center' }}>{b.totalAnswers}</td>
                  <td style={{ textAlign: 'center', color: 'var(--lumon-green)' }}>{b.avgScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Contributions (questions ajoutées par boîte + boîtes créées) */}
      {(stats.questionsAddedByBox.length > 0 || stats.boxesCreatedNames.length > 0) && (
        <div className="terminal-panel" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <h6 style={{ color: 'var(--lumon-green)', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            <FontAwesomeIcon icon={['fas', 'plus-circle']} className="me-2" />
            CONTRIBUTIONS
          </h6>
          {stats.questionsAddedByBox.length > 0 && (
            <table className="bt-t" style={{ width: '100%', marginBottom: stats.boxesCreatedNames.length > 0 ? '1rem' : 0 }}>
              <thead>
                <tr>
                  <th>Boîte</th>
                  <th style={{ textAlign: 'center' }}>Questions ajoutées</th>
                </tr>
              </thead>
              <tbody>
                {stats.questionsAddedByBox.map((b) => (
                  <tr key={b.boxName}>
                    <td>{b.boxName}</td>
                    <td style={{ textAlign: 'center', color: 'var(--lumon-cyan)' }}>{b.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {stats.boxesCreatedNames.length > 0 && (
            <div style={{ fontSize: '0.85rem', color: 'var(--lumon-text-dim)' }}>
              <strong style={{ color: 'var(--lumon-green)' }}>Boîtes créées :</strong>{' '}
              {stats.boxesCreatedNames.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Streams auxquels le joueur a participé */}
      {stats.streams.length > 0 && (
        <div className="terminal-panel" style={{ padding: '1rem' }}>
          <h6 style={{ color: '#6441A4', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            <FontAwesomeIcon icon={['fab', 'twitch']} className="me-2" />
            STREAMS
          </h6>
          <table className="bt-t" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Chaîne</th>
                <th style={{ textAlign: 'center' }}>Sessions</th>
                <th style={{ textAlign: 'center' }}>Score total</th>
                <th style={{ textAlign: 'right' }}>Dernière partie</th>
              </tr>
            </thead>
            <tbody>
              {stats.streams.map((s) => (
                <tr key={s.channelName}>
                  <td>
                    <FontAwesomeIcon icon={['fab', 'twitch']} style={{ color: '#6441A4', marginRight: '6px' }} />
                    {s.channelName}
                  </td>
                  <td style={{ textAlign: 'center' }}>{s.sessions}</td>
                  <td style={{ textAlign: 'center' }}>{s.totalScore}</td>
                  <td style={{ textAlign: 'right', color: 'var(--lumon-text-dim)' }}>{formatDate(s.lastPlayed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ==================== Main Stats Component ====================

type StatsTab = 'global' | 'player';

const Stats = () => {
  const navigate = useNavigate();
  const { username } = useParams<{ username?: string }>();
  const setSubtitle = useGlobalStore((state) => state.setSubtitle);
  const twitchNick = useAuthStore((state) => state.twitchNick);

  const [tab, setTab] = useState<StatsTab>(username ? 'player' : 'global');
  const [searchNick, setSearchNick] = useState(username || '');
  const [activeNick, setActiveNick] = useState(username || '');

  // Data
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerFullStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSubtitle('Statistiques');
  }, [setSubtitle]);

  // Charger stats globales
  useEffect(() => {
    if (tab === 'global' && !globalStats) {
      setLoading(true);
      setError('');
      apiGetGlobalStats()
        .then(setGlobalStats)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [tab, globalStats]);

  // Charger stats joueur
  useEffect(() => {
    if (tab === 'player' && activeNick) {
      setLoading(true);
      setError('');
      setPlayerStats(null);
      apiGetPlayerFullStats(activeNick)
        .then(setPlayerStats)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [tab, activeNick]);

  // Si username dans l'URL, charger directement
  useEffect(() => {
    if (username) {
      setTab('player');
      setSearchNick(username);
      setActiveNick(username);
    }
  }, [username]);

  const handleSearch = () => {
    const nick = searchNick.trim();
    if (!nick) return;
    setActiveNick(nick);
    setTab('player');
  };

  const handleMyStats = () => {
    if (twitchNick) {
      setSearchNick(twitchNick);
      setActiveNick(twitchNick);
      setTab('player');
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", color: 'var(--lumon-cyan)', letterSpacing: '0.1em' }}>
          <FontAwesomeIcon icon={['fas', 'chart-bar']} className="me-2" />
          STATS
        </h4>
        <button className="terminal-btn terminal-btn-sm" onClick={() => navigate('/quiz')}>
          <FontAwesomeIcon icon={['fas', 'arrow-left']} className="me-1" /> Retour
        </button>
      </div>

      {/* Tabs */}
      <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
        <button
          className="terminal-btn terminal-btn-sm"
          style={tab === 'global' ? { backgroundColor: 'var(--lumon-cyan)', color: 'var(--lumon-void)' } : {}}
          onClick={() => { setTab('global'); setError(''); }}
        >
          <FontAwesomeIcon icon={['fas', 'globe']} className="me-1" /> Global
        </button>
        <button
          className="terminal-btn terminal-btn-sm"
          style={tab === 'player' ? { backgroundColor: 'var(--lumon-cyan)', color: 'var(--lumon-void)' } : {}}
          onClick={() => { setTab('player'); setError(''); if (!activeNick && twitchNick) handleMyStats(); }}
        >
          <FontAwesomeIcon icon={['fas', 'user']} className="me-1" /> Joueur
        </button>

        {tab === 'player' && (
          <>
            <div style={{ flex: 1 }} />
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Rechercher un joueur..."
              value={searchNick}
              onChange={(e) => setSearchNick(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ maxWidth: '200px', background: 'var(--lumon-void)', color: 'var(--lumon-text)', border: '1px solid var(--lumon-border)' }}
            />
            <button className="terminal-btn terminal-btn-sm" onClick={handleSearch}>
              <FontAwesomeIcon icon={['fas', 'search']} />
            </button>
            {twitchNick && (
              <button className="terminal-btn terminal-btn-sm" onClick={handleMyStats} title="Mes stats">
                <FontAwesomeIcon icon={['fas', 'user-circle']} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-4" style={{ color: 'var(--lumon-text-dim)' }}>
          <FontAwesomeIcon icon={['fas', 'spinner']} spin className="me-2" />
          Chargement des statistiques...
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-4" style={{ color: 'var(--lumon-danger)' }}>
          {error}
        </div>
      )}

      {/* Global Stats */}
      {tab === 'global' && globalStats && !loading && (
        <GlobalStatsView stats={globalStats} onPlayerClick={(nick) => { setSearchNick(nick); setActiveNick(nick); setTab('player'); }} />
      )}

      {/* Player Stats */}
      {tab === 'player' && playerStats && !loading && (
        <PlayerStatsView stats={playerStats} />
      )}

      {/* No player selected */}
      {tab === 'player' && !activeNick && !loading && !error && (
        <div className="text-center py-4" style={{ color: 'var(--lumon-text-dim)' }}>
          {twitchNick ? (
            <button className="terminal-btn" onClick={handleMyStats}>
              <FontAwesomeIcon icon={['fas', 'user-circle']} className="me-2" />
              Voir mes stats
            </button>
          ) : (
            <span>Recherchez un joueur pour voir ses statistiques.</span>
          )}
        </div>
      )}

      {/* Share link */}
      {tab === 'player' && activeNick && playerStats && !loading && (
        <div className="text-center mt-3">
          <button
            className="terminal-btn terminal-btn-sm"
            onClick={() => {
              const url = `${window.location.origin}/stats/${encodeURIComponent(activeNick)}`;
              navigator.clipboard.writeText(url).then(() => {
                // Feedback visuel basique
                const btn = document.activeElement as HTMLButtonElement;
                if (btn) { btn.textContent = '✓ Copié !'; setTimeout(() => { btn.innerHTML = '<i class="fas fa-share-alt"></i> Partager'; }, 2000); }
              });
            }}
          >
            <FontAwesomeIcon icon={['fas', 'share-alt']} className="me-1" /> Partager
          </button>
        </div>
      )}
    </div>
  );
};

export default Stats;
