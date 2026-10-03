const express = require('express');
const router = express.Router();

const testController = require('../controllers/testController');
const analyticsController = require('../controllers/analyticsController');
const mistakeController = require('../controllers/mistakeController');
const bookmarkController = require('../controllers/bookmarkController');

// Test sets and CBT sessions
router.get('/tests', testController.getTests);
router.get('/tests/:id', testController.getTestById);
router.post('/tests/:id/save-progress', testController.saveProgress);
router.post('/tests/:id/reset', testController.resetTestSession);
router.post('/tests/:id/submit', testController.submitTest);
router.get('/attempts/:id', testController.getAttemptScorecard);

// Analytics & Dashboard
router.get('/analytics', analyticsController.getAnalytics);

// Mistakes Notebook
router.get('/mistakes', mistakeController.getMistakes);
router.patch('/mistakes/:questionId/status', mistakeController.updateMasteryStatus);

// Bookmarks
router.get('/bookmarks', bookmarkController.getBookmarks);
router.post('/bookmarks/toggle', bookmarkController.toggleBookmark);
router.patch('/bookmarks/:questionId/note', bookmarkController.updateBookmarkNote);

module.exports = router;
