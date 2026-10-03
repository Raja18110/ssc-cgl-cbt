const db = require('../config/database');

// GET /api/bookmarks - list all bookmarked questions
async function getBookmarks(req, res) {
  try {
    const bookmarks = await db.allAsync(`
      SELECT bm.*, q.qnum, q.section, q.stem_img, q.solution_img, q.correct_option,
             ts.title as test_title, ts.shift_id
      FROM bookmarks bm
      JOIN questions q ON bm.question_id = q.id
      JOIN test_sets ts ON bm.set_id = ts.id
      ORDER BY bm.created_at DESC
    `);
    res.json({ success: true, count: bookmarks.length, bookmarks });
  } catch (err) {
    console.error('getBookmarks error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// POST /api/bookmarks/toggle - toggle bookmark on question
async function toggleBookmark(req, res) {
  try {
    let { questionId, setId, userNote, tag } = req.body;

    if (!setId) {
      const q = await db.getAsync(`SELECT set_id FROM questions WHERE id = ?`, [questionId]);
      if (q) setId = q.set_id;
    }

    const existing = await db.getAsync(`SELECT * FROM bookmarks WHERE question_id = ?`, [questionId]);
    if (existing) {
      await db.runAsync(`DELETE FROM bookmarks WHERE question_id = ?`, [questionId]);
      res.json({ success: true, bookmarked: false });
    } else {
      await db.runAsync(`
        INSERT INTO bookmarks (question_id, set_id, user_note, tag)
        VALUES (?, ?, ?, ?)
      `, [questionId, setId, userNote || '', tag || 'Important']);
      res.json({ success: true, bookmarked: true });
    }
  } catch (err) {
    console.error('toggleBookmark error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// PATCH /api/bookmarks/:questionId/note - update user note and tag
async function updateBookmarkNote(req, res) {
  try {
    const questionId = req.params.questionId;
    const { userNote, tag } = req.body;
    await db.runAsync(`
      UPDATE bookmarks
      SET user_note = COALESCE(?, user_note),
          tag = COALESCE(?, tag)
      WHERE question_id = ?
    `, [userNote, tag, questionId]);
    res.json({ success: true });
  } catch (err) {
    console.error('updateBookmarkNote error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getBookmarks,
  toggleBookmark,
  updateBookmarkNote
};
