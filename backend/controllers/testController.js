const db = require('../config/database');

// GET /api/tests - list all test sets with user attempt summary
async function getTests(req, res) {
  try {
    const tests = await db.allAsync(`
      SELECT 
        ts.id, 
        ts.shift_id, 
        ts.title, 
        ts.total_questions, 
        ts.total_marks, 
        ts.duration_minutes,
        COUNT(DISTINCT a.id) as attempts_count,
        MAX(a.score) as best_score,
        CASE 
          WHEN act.set_id IS NOT NULL THEN 'IN_PROGRESS'
          WHEN COUNT(DISTINCT a.id) > 0 THEN 'COMPLETED'
          ELSE 'NOT_STARTED'
        END as status
      FROM test_sets ts
      LEFT JOIN attempts a ON ts.id = a.set_id
      LEFT JOIN active_sessions act ON ts.id = act.set_id
      GROUP BY ts.id
      ORDER BY ts.id ASC
    `);
    res.json({ success: true, count: tests.length, tests });
  } catch (err) {
    console.error('getTests error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/tests/:id - get questions for test set
async function getTestById(req, res) {
  try {
    const setId = req.params.id;
    const test = await db.getAsync(`SELECT * FROM test_sets WHERE id = ? OR shift_id = ?`, [setId, setId]);
    if (!test) {
      return res.status(404).json({ success: false, error: 'Test set not found' });
    }

    const questions = await db.allAsync(`
      SELECT q.id, q.qnum, q.section, q.stem_img, q.solution_img, q.correct_option,
             bm.question_id as is_bookmarked
      FROM questions q
      LEFT JOIN bookmarks bm ON q.id = bm.question_id
      WHERE q.set_id = ?
      ORDER BY q.qnum ASC
    `, [test.id]);

    // Active session if any
    const session = await db.getAsync(`SELECT * FROM active_sessions WHERE set_id = ?`, [test.id]);

    const sections = [
      { name: "General Intelligence & Reasoning", start_id: 1, end_id: 25, questions_count: 25 },
      { name: "General Awareness", start_id: 26, end_id: 50, questions_count: 25 },
      { name: "Quantitative Aptitude", start_id: 51, end_id: 75, questions_count: 25 },
      { name: "English Comprehension", start_id: 76, end_id: 100, questions_count: 25 }
    ];

    res.json({
      success: true,
      test,
      sections,
      questions,
      activeSession: session ? {
        currentQIndex: session.current_q_index,
        timeRemaining: session.time_remaining,
        testMode: session.test_mode,
        responses: JSON.parse(session.responses_json || '{}')
      } : null
    });
  } catch (err) {
    console.error('getTestById error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// POST /api/tests/:id/save-progress - autosave test session
async function saveProgress(req, res) {
  try {
    const setId = req.params.id;
    const { currentQIndex, timeRemaining, testMode, responses } = req.body;

    await db.runAsync(`
      INSERT INTO active_sessions (set_id, current_q_index, time_remaining, test_mode, responses_json, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(set_id) DO UPDATE SET
        current_q_index = excluded.current_q_index,
        time_remaining = excluded.time_remaining,
        test_mode = excluded.test_mode,
        responses_json = excluded.responses_json,
        updated_at = CURRENT_TIMESTAMP
    `, [setId, currentQIndex || 0, timeRemaining || 3600, testMode || 'exam', JSON.stringify(responses || {})]);

    res.json({ success: true });
  } catch (err) {
    console.error('saveProgress error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// POST /api/tests/:id/submit - grade and record attempt
async function submitTest(req, res) {
  try {
    const setId = req.params.id;
    const { responses, timeSpentSeconds } = req.body;

    const test = await db.getAsync(`SELECT * FROM test_sets WHERE id = ? OR shift_id = ?`, [setId, setId]);
    if (!test) return res.status(404).json({ success: false, error: 'Test set not found' });

    const questions = await db.allAsync(`SELECT id, qnum, section, correct_option FROM questions WHERE set_id = ? ORDER BY qnum ASC`, [test.id]);

    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;

    const sectionStats = {
      "General Intelligence & Reasoning": { attempted: 0, correct: 0, wrong: 0, score: 0 },
      "General Awareness": { attempted: 0, correct: 0, wrong: 0, score: 0 },
      "Quantitative Aptitude": { attempted: 0, correct: 0, wrong: 0, score: 0 },
      "English Comprehension": { attempted: 0, correct: 0, wrong: 0, score: 0 }
    };

    const gradedResponses = [];

    for (const q of questions) {
      const userResp = responses[q.qnum] || {};
      const chosenOpt = userResp.option;
      const sec = q.section;

      let isCorrect = 0;
      let status = 'not_answered';

      if (chosenOpt) {
        if (sectionStats[sec]) sectionStats[sec].attempted++;
        if (chosenOpt === q.correct_option) {
          isCorrect = 1;
          correctCount++;
          if (sectionStats[sec]) sectionStats[sec].correct++;
          status = 'answered';
        } else {
          isCorrect = 0;
          wrongCount++;
          if (sectionStats[sec]) sectionStats[sec].wrong++;
          status = 'answered';

          // Add to mistakes notebook
          await db.runAsync(`
            INSERT INTO mistakes_notebook (question_id, set_id, error_count, last_attempted_at, mastery_status)
            VALUES (?, ?, 1, CURRENT_TIMESTAMP, 'NEEDS_PRACTICE')
            ON CONFLICT(question_id) DO UPDATE SET
              error_count = error_count + 1,
              last_attempted_at = CURRENT_TIMESTAMP
          `, [q.id, test.id]);
        }
      } else {
        unattemptedCount++;
        status = 'not_visited';
      }

      gradedResponses.push({
        question_id: q.id,
        qnum: q.qnum,
        selected_option: chosenOpt,
        is_correct: isCorrect,
        status: status,
        time_spent: userResp.timeSpent || 0
      });
    }

    // Calculate sectional and total scores (+2.0 correct, -0.5 wrong)
    const posMarks = test.positive_marks || 2.0;
    const negMarks = test.negative_marking || 0.5;

    Object.keys(sectionStats).forEach(sec => {
      const s = sectionStats[sec];
      s.score = Math.max(0, (s.correct * posMarks) - (s.wrong * negMarks)).toFixed(1);
    });

    const totalScore = (correctCount * posMarks) - (wrongCount * negMarks);
    const attemptedCount = correctCount + wrongCount;
    const accuracy = attemptedCount > 0 ? ((correctCount / attemptedCount) * 100).toFixed(1) : 0;

    // Insert attempt record
    const attemptRes = await db.runAsync(`
      INSERT INTO attempts (
        set_id, score, correct_count, wrong_count, unattempted_count,
        accuracy, time_spent_seconds, section_scores_json, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      test.id,
      totalScore.toFixed(1),
      correctCount,
      wrongCount,
      unattemptedCount,
      accuracy,
      timeSpentSeconds || 0,
      JSON.stringify(sectionStats)
    ]);

    const attemptId = attemptRes.lastID;

    // Insert responses
    for (const r of gradedResponses) {
      await db.runAsync(`
        INSERT INTO attempt_responses (attempt_id, question_id, qnum, selected_option, is_correct, status, time_spent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [attemptId, r.question_id, r.qnum, r.selected_option, r.is_correct, r.status, r.time_spent]);
    }

    // Clear active session
    await db.runAsync(`DELETE FROM active_sessions WHERE set_id = ?`, [test.id]);

    res.json({
      success: true,
      attemptId,
      score: totalScore.toFixed(1),
      maxMarks: test.total_marks,
      accuracy: `${accuracy}%`,
      correctCount,
      wrongCount,
      unattemptedCount,
      sectionStats
    });
  } catch (err) {
    console.error('submitTest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/attempts/:id - get full attempt review
async function getAttemptScorecard(req, res) {
  try {
    const attemptId = req.params.id;
    const attempt = await db.getAsync(`
      SELECT a.*, ts.title as test_title, ts.shift_id, ts.total_marks, ts.duration_minutes
      FROM attempts a
      JOIN test_sets ts ON a.set_id = ts.id
      WHERE a.id = ?
    `, [attemptId]);

    if (!attempt) return res.status(404).json({ success: false, error: 'Attempt not found' });

    const responses = await db.allAsync(`
      SELECT ar.*, q.section, q.stem_img, q.solution_img, q.correct_option,
             bm.question_id as is_bookmarked
      FROM attempt_responses ar
      JOIN questions q ON ar.question_id = q.id
      LEFT JOIN bookmarks bm ON q.id = bm.question_id
      WHERE ar.attempt_id = ?
      ORDER BY ar.qnum ASC
    `, [attemptId]);

    res.json({
      success: true,
      attempt: {
        ...attempt,
        section_scores: JSON.parse(attempt.section_scores_json || '{}')
      },
      responses
    });
  } catch (err) {
    console.error('getAttemptScorecard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// POST /api/tests/:id/reset - reset active session to start test fresh
async function resetTestSession(req, res) {
  try {
    const setId = req.params.id;
    await db.runAsync(`DELETE FROM active_sessions WHERE set_id = ? OR set_id IN (SELECT id FROM test_sets WHERE shift_id = ?)`, [setId, setId]);
    res.json({ success: true, message: 'Test session reset successfully' });
  } catch (err) {
    console.error('resetTestSession error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getTests,
  getTestById,
  saveProgress,
  submitTest,
  getAttemptScorecard,
  resetTestSession
};
