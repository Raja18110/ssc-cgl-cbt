const db = require('../config/database');

// GET /api/mistakes - list all questions answered incorrectly
async function getMistakes(req, res) {
  try {
    const { section, status } = req.query;
    let query = `
      SELECT mn.*, q.qnum, q.section, q.stem_img, q.solution_img, q.correct_option,
             ts.title as test_title, ts.shift_id
      FROM mistakes_notebook mn
      JOIN questions q ON mn.question_id = q.id
      JOIN test_sets ts ON mn.set_id = ts.id
      WHERE 1=1
    `;
    const params = [];

    if (section && section !== 'all') {
      query += ` AND q.section = ?`;
      params.push(section);
    }
    if (status && status !== 'all') {
      query += ` AND mn.mastery_status = ?`;
      params.push(status);
    }

    query += ` ORDER BY mn.last_attempted_at DESC`;

    const mistakes = await db.allAsync(query, params);
    res.json({ success: true, count: mistakes.length, mistakes });
  } catch (err) {
    console.error('getMistakes error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// PATCH /api/mistakes/:questionId/status - update mastery status
async function updateMasteryStatus(req, res) {
  try {
    const questionId = req.params.questionId;
    const { status } = req.body; // 'NEEDS_PRACTICE' | 'REVISED' | 'MASTERED'

    await db.runAsync(`
      UPDATE mistakes_notebook 
      SET mastery_status = ?
      WHERE question_id = ?
    `, [status, questionId]);

    res.json({ success: true });
  } catch (err) {
    console.error('updateMasteryStatus error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getMistakes,
  updateMasteryStatus
};
