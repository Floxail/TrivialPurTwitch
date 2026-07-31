import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, requireAnyTwitchAuth } from './_utils.js';
import { getDb, runMigrations } from './_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await runMigrations();
    const { action } = req.query;

    // ==================== GET /api/stats?action=global ====================
    if (req.method === 'GET' && action === 'global') {
      const [sessionsResult, playersResult, questionsResult, channelsResult, questionStatsResult] = await Promise.all([
        // Total sessions + total questions posées
        getDb().execute(`
          SELECT
            COUNT(DISTINCT session_id) as total_sessions,
            SUM(answers) as total_questions_answered,
            COUNT(*) as total_score_entries
          FROM scores
        `),
        // Total joueurs uniques
        getDb().execute(`SELECT COUNT(DISTINCT nick) as total_players FROM scores`),
        // Total questions en DB
        getDb().execute(`SELECT COUNT(*) as total_questions FROM questions`),
        // Chaînes qui ont lancé des quiz (avec channel_name)
        getDb().execute(`
          SELECT
            channel_name,
            MAX(channel_id) as channel_id,
            COUNT(DISTINCT session_id) as quiz_count,
            COUNT(DISTINCT nick) as player_count,
            MIN(created_at) as first_quiz,
            MAX(created_at) as last_quiz
          FROM scores
          WHERE channel_name IS NOT NULL AND channel_name != ''
          GROUP BY channel_name
          ORDER BY quiz_count DESC
        `),
        // Questions les plus ratées / réussies
        getDb().execute(`
          SELECT question_id, times_asked, times_correct, times_wrong, fastest_correct_ms
          FROM question_stats
          WHERE times_asked >= 3 AND times_correct < times_asked
          ORDER BY CAST(times_correct AS REAL) / times_asked ASC
          LIMIT 10
        `),
      ]);

      const sr = sessionsResult.rows[0];

      // Questions les plus réussies
      const bestQuestions = await getDb().execute(`
        SELECT question_id, times_asked, times_correct, times_wrong
        FROM question_stats
        WHERE times_asked >= 3 AND times_correct > 0
        ORDER BY CAST(times_correct AS REAL) / times_asked DESC
        LIMIT 10
      `);

      // Enrichir les question_stats avec le texte de la question
      const allQuestionIds = [
        ...questionStatsResult.rows.map(r => r.question_id),
        ...bestQuestions.rows.map(r => r.question_id),
      ].filter((v, i, a) => a.indexOf(v) === i);

      let questionTexts: Record<string, string> = {};
      if (allQuestionIds.length > 0) {
        const placeholders = allQuestionIds.map(() => '?').join(',');
        const qResult = await getDb().execute({
          sql: `SELECT id, question FROM questions WHERE id IN (${placeholders})`,
          args: allQuestionIds as string[],
        });
        for (const r of qResult.rows) {
          questionTexts[r.id as string] = r.question as string;
        }
      }

      return res.json({
        totalSessions: Number(sr.total_sessions),
        totalPlayers: Number(playersResult.rows[0].total_players),
        totalQuestionsInDB: Number(questionsResult.rows[0].total_questions),
        totalQuestionsAnswered: Number(sr.total_questions_answered),
        channels: channelsResult.rows.map(r => ({
          channelName: r.channel_name,
          channelId: r.channel_id,
          quizCount: Number(r.quiz_count),
          playerCount: Number(r.player_count),
          firstQuiz: r.first_quiz,
          lastQuiz: r.last_quiz,
        })),
        hardestQuestions: questionStatsResult.rows.map(r => ({
          questionId: r.question_id,
          questionText: questionTexts[r.question_id as string] || '(question supprimée)',
          timesAsked: Number(r.times_asked),
          timesCorrect: Number(r.times_correct),
          timesWrong: Number(r.times_wrong),
          successRate: Number(r.times_asked) > 0
            ? Math.round((Number(r.times_correct) / Number(r.times_asked)) * 100)
            : 0,
        })),
        easiestQuestions: bestQuestions.rows.map(r => ({
          questionId: r.question_id,
          questionText: questionTexts[r.question_id as string] || '(question supprimée)',
          timesAsked: Number(r.times_asked),
          timesCorrect: Number(r.times_correct),
          timesWrong: Number(r.times_wrong),
          successRate: Number(r.times_asked) > 0
            ? Math.round((Number(r.times_correct) / Number(r.times_asked)) * 100)
            : 0,
        })),
      });
    }

    // ==================== GET /api/stats?action=player&nick=xxx ====================
    if (req.method === 'GET' && action === 'player') {
      const nick = req.query.nick as string;
      if (!nick) return res.status(400).json({ error: 'nick requis' });

      // Recherche case-insensitive : trouver le nick exact en DB
      const nickLookup = await getDb().execute({
        sql: `SELECT nick FROM scores WHERE LOWER(nick) = LOWER(?) LIMIT 1`,
        args: [nick],
      });
      const resolvedNick = nickLookup.rows.length > 0 ? nickLookup.rows[0].nick as string : nick;

      const [statsResult, categoryResult, streamsResult, bestSessionResult, questionsSubmittedResult, questionsAddedResult, boxesCreatedResult] = await Promise.all([
        // Stats agrégées
        getDb().execute({
          sql: `SELECT
                  nick,
                  twitch_id,
                  SUM(score) as total_score,
                  SUM(answers) as total_answers,
                  SUM(firsts) as total_firsts,
                  SUM(combos) as total_combos,
                  MIN(CASE WHEN fastest > 0 THEN fastest ELSE NULL END) as best_fastest,
                  MAX(score) as best_score,
                  AVG(score) as avg_score,
                  COUNT(DISTINCT session_id) as sessions,
                  MIN(created_at) as first_game,
                  MAX(created_at) as last_game
                FROM scores
                WHERE nick = ?
                GROUP BY nick`,
          args: [resolvedNick],
        }),
        // Stats par catégorie (via les sessions + box_name)
        getDb().execute({
          sql: `SELECT
                  box_name,
                  COUNT(*) as games,
                  SUM(score) as total_score,
                  SUM(answers) as total_answers,
                  AVG(score) as avg_score
                FROM scores
                WHERE nick = ? AND box_name IS NOT NULL
                GROUP BY box_name
                ORDER BY total_score DESC`,
          args: [resolvedNick],
        }),
        // Streams où le joueur a participé
        getDb().execute({
          sql: `SELECT
                  channel_name,
                  channel_id,
                  COUNT(DISTINCT session_id) as sessions,
                  SUM(score) as total_score,
                  MIN(created_at) as first_played,
                  MAX(created_at) as last_played
                FROM scores
                WHERE nick = ? AND channel_name IS NOT NULL AND channel_name != ''
                GROUP BY channel_name
                ORDER BY sessions DESC`,
          args: [resolvedNick],
        }),
        // Meilleure session
        getDb().execute({
          sql: `SELECT session_id, box_name, score, answers, firsts, combos, fastest, channel_name, created_at
                FROM scores
                WHERE nick = ?
                ORDER BY score DESC
                LIMIT 1`,
          args: [resolvedNick],
        }),
        // Questions soumises (depuis pending_questions — approuvées)
        getDb().execute({
          sql: `SELECT COUNT(*) as count FROM pending_questions WHERE LOWER(submitted_by) = LOWER(?) AND status = 'approved'`,
          args: [nick],
        }),
        // Questions ajoutées directement (admin)
        getDb().execute({
          sql: `SELECT box_name, COUNT(*) as count FROM questions WHERE LOWER(created_by) = LOWER(?) GROUP BY box_name ORDER BY count DESC`,
          args: [nick],
        }),
        // Boîtes créées
        getDb().execute({
          sql: `SELECT name FROM boxes WHERE LOWER(created_by) = LOWER(?)`,
          args: [nick],
        }),
      ]);

      if (statsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Joueur non trouvé' });
      }

      const s = statsResult.rows[0];
      const bs = bestSessionResult.rows[0];

      return res.json({
        player: {
          nick: s.nick,
          twitchId: s.twitch_id,
          totalScore: Number(s.total_score),
          totalAnswers: Number(s.total_answers),
          totalFirsts: Number(s.total_firsts),
          totalCombos: Number(s.total_combos),
          bestFastest: s.best_fastest ? Number(s.best_fastest) : null,
          bestScore: Number(s.best_score),
          avgScore: Math.round(Number(s.avg_score)),
          sessions: Number(s.sessions),
          firstGame: s.first_game,
          lastGame: s.last_game,
          questionsSubmitted: Number(questionsSubmittedResult.rows[0].count),
          questionsAdded: questionsAddedResult.rows.reduce((sum, r) => sum + Number(r.count), 0),
          boxesCreated: boxesCreatedResult.rows.length,
        },
        questionsAddedByBox: questionsAddedResult.rows.map(r => ({
          boxName: r.box_name as string,
          count: Number(r.count),
        })),
        boxesCreatedNames: boxesCreatedResult.rows.map(r => r.name as string),
        bestSession: bs ? {
          sessionId: bs.session_id,
          boxName: bs.box_name,
          score: Number(bs.score),
          answers: Number(bs.answers),
          firsts: Number(bs.firsts),
          combos: Number(bs.combos),
          fastest: bs.fastest ? Number(bs.fastest) : null,
          channelName: bs.channel_name || null,
          createdAt: bs.created_at,
        } : null,
        byBox: categoryResult.rows.map(r => ({
          boxName: r.box_name,
          games: Number(r.games),
          totalScore: Number(r.total_score),
          totalAnswers: Number(r.total_answers),
          avgScore: Math.round(Number(r.avg_score)),
        })),
        streams: streamsResult.rows.map(r => ({
          channelName: r.channel_name,
          channelId: r.channel_id,
          sessions: Number(r.sessions),
          totalScore: Number(r.total_score),
          firstPlayed: r.first_played,
          lastPlayed: r.last_played,
        })),
      });
    }

    // ==================== POST /api/stats?action=record_questions ====================
    // Enregistre les stats de questions jouées (appelé en fin de quiz)
    if (req.method === 'POST' && action === 'record_questions') {
      const user = await requireAnyTwitchAuth(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { questions } = req.body;
      // questions: [{ questionId, correct: boolean, answerTimeMs: number }]

      if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: 'questions[] requis' });
      }

      const BATCH_SIZE = 50;
      for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);
        const statements = batch.map((q: any) => ({
          sql: `INSERT INTO question_stats (question_id, times_asked, times_correct, times_wrong, fastest_correct_ms)
                VALUES (?, 1, ?, ?, ?)
                ON CONFLICT(question_id) DO UPDATE SET
                  times_asked = times_asked + 1,
                  times_correct = times_correct + excluded.times_correct,
                  times_wrong = times_wrong + excluded.times_wrong,
                  fastest_correct_ms = CASE
                    WHEN excluded.fastest_correct_ms > 0 AND (fastest_correct_ms = 0 OR excluded.fastest_correct_ms < fastest_correct_ms)
                    THEN excluded.fastest_correct_ms
                    ELSE fastest_correct_ms
                  END`,
          args: [
            q.questionId,
            q.correct ? 1 : 0,
            q.correct ? 0 : 1,
            q.correct && q.answerTimeMs ? q.answerTimeMs : 0,
          ],
        }));
        await getDb().batch(statements as any);
      }

      return res.json({ recorded: questions.length });
    }

    return res.status(400).json({ error: 'action requise: global | player | record_questions' });
  } catch (err: any) {
    console.error('Stats API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
