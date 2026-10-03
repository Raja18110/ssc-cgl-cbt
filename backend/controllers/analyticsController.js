const db = require('../config/database');

// GET /api/analytics - aggregate performance overview
async function getAnalytics(req, res) {
  try {
    const summary = await db.getAsync(`
      SELECT 
        COUNT(id) as total_tests_taken,
        COALESCE(AVG(score), 0) as avg_score,
        COALESCE(MAX(score), 0) as best_score,
        COALESCE(SUM(correct_count), 0) as total_correct,
        COALESCE(SUM(wrong_count), 0) as total_wrong,
        COALESCE(SUM(unattempted_count), 0) as total_skipped,
        COALESCE(AVG(accuracy), 0) as overall_accuracy,
        COALESCE(SUM(time_spent_seconds), 0) as total_time_spent
      FROM attempts
    `);

    // Sectional performance
    const sectionalAttempts = await db.allAsync(`
      SELECT q.section, 
             COUNT(ar.id) as total_attempted,
             SUM(ar.is_correct) as correct_count,
             (COUNT(ar.id) - SUM(ar.is_correct)) as wrong_count
      FROM attempt_responses ar
      JOIN questions q ON ar.question_id = q.id
      WHERE ar.selected_option IS NOT NULL
      GROUP BY q.section
    `);

    const sectionAnalysis = {};
    ["General Intelligence & Reasoning", "General Awareness", "Quantitative Aptitude", "English Comprehension"].forEach(sec => {
      sectionAnalysis[sec] = { attempted: 0, correct: 0, wrong: 0, accuracy: 0 };
    });

    sectionalAttempts.forEach(row => {
      if (sectionAnalysis[row.section]) {
        const acc = row.total_attempted > 0 ? ((row.correct_count / row.total_attempted) * 100).toFixed(1) : 0;
        sectionAnalysis[row.section] = {
          attempted: row.total_attempted,
          correct: row.correct_count,
          wrong: row.wrong_count,
          accuracy: Number(acc)
        };
      }
    });

    // Recent attempts list
    const recentAttempts = await db.allAsync(`
      SELECT a.id, a.score, a.correct_count, a.wrong_count, a.accuracy, a.time_spent_seconds, a.submitted_at,
             ts.title as test_title, ts.shift_id
      FROM attempts a
      JOIN test_sets ts ON a.set_id = ts.id
      ORDER BY a.submitted_at DESC
      LIMIT 10
    `);

    // Count of items in mistakes notebook and bookmarks
    const mistakesCount = (await db.getAsync(`SELECT COUNT(*) as count FROM mistakes_notebook WHERE mastery_status != 'MASTERED'`)).count;
    const bookmarksCount = (await db.getAsync(`SELECT COUNT(*) as count FROM bookmarks`)).count;

    res.json({
      success: true,
      summary: {
        totalTestsTaken: summary.total_tests_taken,
        avgScore: Number(summary.avg_score).toFixed(1),
        bestScore: Number(summary.best_score).toFixed(1),
        totalCorrect: summary.total_correct,
        totalWrong: summary.total_wrong,
        totalSkipped: summary.total_skipped,
        overallAccuracy: Number(summary.overall_accuracy).toFixed(1),
        totalTimeMinutes: Math.round(summary.total_time_spent / 60)
      },
      sectionAnalysis,
      recentAttempts,
      mistakesCount,
      bookmarksCount
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getAnalytics
};
