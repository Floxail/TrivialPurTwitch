import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AnimatePresence, motion } from 'framer-motion';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FormControl } from 'react-bootstrap';
import { apiGetLeaderboard, LeaderboardEntry } from 'services/api-scores-service';
import { usePlayerStore } from './store/player-store';
import TwitchAvatar from './twitch-avatar';

type LeaderboardRow = {
  nick: string,
  displayedRank?: number,
  score: number,
  tid: string,
  avatar?: string,
  // Champs all-time (optionnels)
  sessions?: number,
};

type LeaderboardMode = 'session' | 'alltime';

const DISPLAYED_USER_LIMIT = 100;

const Leaderboard = memo(() => {

  const playerStore = usePlayerStore();

  const [nickFilter, setNickFilter] = useState('');
  const [mode, setMode] = useState<LeaderboardMode>('session');
  const [allTimeData, setAllTimeData] = useState<LeaderboardEntry[]>([]);
  const [allTimeLoading, setAllTimeLoading] = useState(false);
  const [allTimeError, setAllTimeError] = useState<string>('');

  const loadAllTime = useCallback(async () => {
    setAllTimeLoading(true);
    setAllTimeError('');
    try {
      const result = await apiGetLeaderboard(DISPLAYED_USER_LIMIT);
      setAllTimeData(result.leaderboard);
    } catch (err: any) {
      setAllTimeError('Impossible de charger le classement');
      console.warn('Leaderboard all-time error:', err);
    } finally {
      setAllTimeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'alltime' && allTimeData.length === 0 && !allTimeLoading) {
      loadAllTime();
    }
  }, [mode, allTimeData.length, allTimeLoading, loadAllTime]);

  // Données de session (local)
  const sessionRows = useMemo(() => {
    let rows: LeaderboardRow[] = Object.values(playerStore.players).map(player => ({
      nick: player.nick,
      score: player.score,
      tid: player.tid,
      avatar: player.avatar,
      displayedRank: player.rank,
    }));

    if (nickFilter) {
      rows = rows.filter(s => s.nick.toLowerCase().includes(nickFilter));
    }

    rows.sort((a, b) => a.nick.localeCompare(b.nick));
    rows.sort((a, b) => b.score - a.score);

    for (let i = rows.length - 1; i > 0; i--) {
      if (rows[i].score === rows[i - 1].score) {
        rows[i].displayedRank = undefined;
      }
    }

    return rows;
  }, [nickFilter, playerStore]);

  // Données all-time (API)
  const allTimeRows = useMemo(() => {
    let rows: LeaderboardRow[] = allTimeData.map((entry, i) => ({
      nick: entry.nick,
      score: entry.totalScore,
      tid: entry.twitchId,
      displayedRank: i + 1,
      sessions: entry.sessions,
    }));

    if (nickFilter) {
      rows = rows.filter(s => s.nick.toLowerCase().includes(nickFilter));
    }

    // Recalcul des rangs après filtre
    let lastScore = -1;
    let lastRank = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].score !== lastScore) {
        lastRank = i + 1;
        lastScore = rows[i].score;
      }
      rows[i].displayedRank = lastRank;
    }
    for (let i = rows.length - 1; i > 0; i--) {
      if (rows[i].score === rows[i - 1].score) {
        rows[i].displayedRank = undefined;
      }
    }

    return rows;
  }, [nickFilter, allTimeData]);

  const displayedRows = mode === 'session' ? sessionRows : allTimeRows;

  const addPointToPlayer = (nick: string, points: number) => {
    playerStore.addPoints(nick, points);
  };

  const onNickFilterChange = (e: any) => {
    setNickFilter(e.target.value.toLowerCase());
  };

  return (
    <div id="leaderboard" className="p-3 terminal-panel terminal-panel-glow">
      <div className="d-flex gap-2 mb-2 align-items-center">
        <FormControl value={nickFilter} type="text" role="searchbox" placeholder="Nick filter" size="sm" onChange={onNickFilterChange} style={{ flex: 1 }} />
        <div className="d-flex gap-1">
          <button
            className={`terminal-btn terminal-btn-sm${mode === 'session' ? '' : ''}`}
            style={mode === 'session' ? { backgroundColor: 'var(--lumon-cyan)', color: 'var(--lumon-void)' } : {}}
            onClick={() => setMode('session')}
          >
            Session
          </button>
          <button
            className={`terminal-btn terminal-btn-sm`}
            style={mode === 'alltime' ? { backgroundColor: 'var(--lumon-cyan)', color: 'var(--lumon-void)' } : {}}
            onClick={() => { setMode('alltime'); }}
          >
            <FontAwesomeIcon icon={['fas', 'trophy']} className="me-1" />
            All-time
          </button>
        </div>
      </div>

      {mode === 'alltime' && allTimeLoading && (
        <div className="text-center py-2" style={{ color: 'var(--lumon-text-dim)' }}>Chargement...</div>
      )}
      {mode === 'alltime' && allTimeError && (
        <div className="text-center py-2" style={{ color: 'var(--lumon-danger)' }}>
          {allTimeError}
          <button className="terminal-btn terminal-btn-sm ms-2" onClick={loadAllTime}>Réessayer</button>
        </div>
      )}

      <table className="table-hover bt-t">
        <thead>
        <tr>
          <th style={{ width: '10%', textAlign: 'center' }}>#</th>
          <th style={{ width: '12%' }}></th>
          <th style={{ width: mode === 'alltime' ? '46%' : '61%' }}>Nick</th>
          <th style={{ width: '17%', textAlign: 'center' }}>Score</th>
          {mode === 'alltime' && (
            <th style={{ width: '15%', textAlign: 'center' }}>Sessions</th>
          )}
        </tr>
        </thead>
        <tbody>
        <AnimatePresence>
          {displayedRows.slice(0, DISPLAYED_USER_LIMIT).map((sc) => (
            <motion.tr
              key={sc.nick}
              className="leaderboard-row"
              initial={{ opacity: 0, top: -20 }}
              animate={{ opacity: 1, top: 0 }}
              exit={{ opacity: 0, top: 20 }}
              transition={{ duration: 0.3 }}
              layout="position"
            >
              <td style={{ textAlign: 'center' }}>
                <span>{sc.displayedRank}</span>
              </td>
              <td>
                <TwitchAvatar tid={sc.tid} avatar={sc.avatar} className="leaderboard-avatar" />
              </td>
              <td style={{ position: 'relative' }}>
                <span className="leaderboard-nick">{sc.nick}</span>
                {mode === 'session' && (
                  <div className="leaderboard-buttons">
                    <button className="terminal-btn terminal-btn-sm terminal-btn-danger" onClick={() => addPointToPlayer(sc.nick, -1)}>
                      <FontAwesomeIcon icon={['fas', 'minus']} size="lg" />
                    </button>
                    <button className="terminal-btn terminal-btn-sm terminal-btn-success" onClick={() => addPointToPlayer(sc.nick, 1)}>
                      <FontAwesomeIcon icon={['fas', 'plus']} size="lg" />
                    </button>
                  </div>
                )}
              </td>
              <td style={{ textAlign: 'center' }}>
                <span>{sc.score}</span>
              </td>
              {mode === 'alltime' && (
                <td style={{ textAlign: 'center' }}>
                  <span style={{ color: 'var(--lumon-text-dim)' }}>{sc.sessions}</span>
                </td>
              )}
            </motion.tr>
          ))}
          {displayedRows.length > DISPLAYED_USER_LIMIT &&
            <tr style={{ textAlign: 'center' }}>
              <td colSpan={mode === 'alltime' ? 5 : 4}><span><i>...{displayedRows.length - DISPLAYED_USER_LIMIT} more players</i></span></td>
            </tr>
          }
        </AnimatePresence>
        </tbody>
      </table>

      {mode === 'alltime' && !allTimeLoading && !allTimeError && allTimeData.length > 0 && (
        <div className="text-center mt-2">
          <button className="terminal-btn terminal-btn-sm" onClick={loadAllTime}>
            <FontAwesomeIcon icon={['fas', 'shuffle']} className="me-1" />
            Rafraîchir
          </button>
        </div>
      )}
    </div>
  );
});

export default Leaderboard;
