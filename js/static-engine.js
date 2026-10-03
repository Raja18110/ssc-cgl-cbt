// Static CBT Client-Side Engine & Offline Storage Provider
// Enables 100% standalone execution on GitHub Pages and static web hosts

(function() {
  'use strict';

  const STORAGE_KEYS = {
    ATTEMPTS: 'ssc_cbt_attempts_v1',
    MISTAKES: 'ssc_cbt_mistakes_v1',
    BOOKMARKS: 'ssc_cbt_bookmarks_v1',
    PROGRESS_PREFIX: 'ssc_cbt_progress_'
  };

  function getLocalJSON(key, defaultVal) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultVal;
    } catch (e) {
      console.warn('localStorage read error for key:', key, e);
      return defaultVal;
    }
  }

  function setLocalJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('localStorage write error for key:', key, e);
    }
  }

  function getDataUrl(relativePath) {
    const p = window.location.pathname;
    const base = p.endsWith('/') ? p : p.substring(0, p.lastIndexOf('/') + 1);
    return base + relativePath;
  }

  function cleanId(str) {
    return (str || '').split('?')[0].replace(/^\/+|\/+$/g, '').replace(/\.json$/, '');
  }

  // Cache loaded shift JSONs
  const shiftDataCache = {};

  const StaticCbtEngine = {
    isStaticMode: false,

    async init() {
      // Determine if backend API is reachable
      const isGitHubPages = window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
      if (isGitHubPages) {
        this.isStaticMode = true;
        console.log('🌐 SSC CBT Platform running in Static / GitHub Pages Mode.');
      } else {
        try {
          const testRes = await originalFetch('/api/tests', { method: 'GET', signal: AbortSignal.timeout ? AbortSignal.timeout(1200) : undefined });
          const ct = testRes.headers.get('content-type') || '';
          if (testRes.ok && ct.includes('application/json')) {
            this.isStaticMode = false;
            console.log('🚀 Connected to Node.js / SQLite backend.');
          } else {
            this.isStaticMode = true;
            console.log('⚡ Backend not responding, switching to Static CBT Engine.');
          }
        } catch (e) {
          this.isStaticMode = true;
          console.log('⚡ Backend offline, switching to Static CBT Engine.');
        }
      }
    },

    // Fetch shift index
    async getShiftsIndex() {
      if (this._shiftsIndex) return this._shiftsIndex;
      try {
        const res = await originalFetch(getDataUrl('data/shifts_index.json'));
        this._shiftsIndex = await res.json();
        return this._shiftsIndex;
      } catch (err) {
        console.error('Error loading shifts_index.json:', err);
        return [];
      }
    },

    // Fetch single shift JSON
    async getShiftData(shiftId) {
      const cid = cleanId(shiftId);
      if (shiftDataCache[cid]) return shiftDataCache[cid];
      try {
        const res = await originalFetch(getDataUrl(`data/${cid}.json`));
        const data = await res.json();
        shiftDataCache[cid] = data;
        return data;
      } catch (err) {
        console.error(`Error loading data/${cid}.json:`, err);
        return null;
      }
    },

    // 1. GET /api/tests
    async handleGetTests() {
      const shifts = await this.getShiftsIndex();
      const attempts = getLocalJSON(STORAGE_KEYS.ATTEMPTS, []);

      const tests = shifts.map(s => {
        const shiftAttempts = attempts.filter(a => a.shift_id === s.shift_id || a.set_id === s.shift_id);
        const bestScore = shiftAttempts.length > 0 ? Math.max(...shiftAttempts.map(a => a.score)) : null;
        const hasProgress = !!localStorage.getItem(STORAGE_KEYS.PROGRESS_PREFIX + s.shift_id);

        let status = 'NOT_STARTED';
        if (hasProgress) status = 'IN_PROGRESS';
        else if (shiftAttempts.length > 0) status = 'COMPLETED';

        return {
          id: s.shift_id,
          shift_id: s.shift_id,
          title: s.title,
          total_questions: s.total_questions,
          total_marks: s.total_marks || 200,
          duration_minutes: s.duration_minutes || 60,
          attempts_count: shiftAttempts.length,
          best_score: bestScore !== null ? Number(bestScore).toFixed(1) : null,
          status: status
        };
      });

      return { success: true, count: tests.length, tests };
    },

    // 2. GET /api/tests/:shiftId
    async handleGetTestById(shiftId) {
      const data = await this.getShiftData(shiftId);
      if (!data) {
        return { success: false, error: 'Shift test paper not found' };
      }

      const bookmarks = getLocalJSON(STORAGE_KEYS.BOOKMARKS, {});
      const savedProgress = getLocalJSON(STORAGE_KEYS.PROGRESS_PREFIX + shiftId, null);

      const questions = (data.questions || []).map(q => {
        const qid = `${data.shift_id}_${q.id}`;
        return {
          id: qid,
          qnum: q.id,
          section: q.section,
          stem_img: q.stem_img,
          solution_img: q.solution_img,
          correct_option: q.correct,
          options: q.options || ['A', 'B', 'C', 'D'],
          is_bookmarked: bookmarks[qid] ? 1 : 0
        };
      });

      const sections = data.sections || [
        { name: "General Intelligence & Reasoning", start_id: 1, end_id: 25, questions_count: 25 },
        { name: "General Awareness", start_id: 26, end_id: 50, questions_count: 25 },
        { name: "Quantitative Aptitude", start_id: 51, end_id: 75, questions_count: 25 },
        { name: "English Comprehension", start_id: 76, end_id: 100, questions_count: 25 }
      ];

      return {
        success: true,
        test: {
          id: data.shift_id,
          shift_id: data.shift_id,
          title: data.title,
          total_questions: data.total_questions || questions.length,
          duration_minutes: data.duration_minutes || 60,
          total_marks: data.total_marks || 200,
          positive_marks: data.marks_per_question || 2.0,
          negative_marking: data.negative_marks || 0.5
        },
        sections,
        questions,
        activeSession: savedProgress ? {
          currentQIndex: savedProgress.currentQIndex || 0,
          timeRemaining: savedProgress.timeRemaining || (data.duration_minutes * 60),
          testMode: savedProgress.testMode || 'exam',
          responses: savedProgress.responses || {}
        } : null
      };
    },

    // 3. POST /api/tests/:shiftId/save-progress
    async handleSaveProgress(shiftId, body) {
      setLocalJSON(STORAGE_KEYS.PROGRESS_PREFIX + shiftId, body);
      return { success: true };
    },

    // 4. POST /api/tests/:shiftId/reset
    async handleReset(shiftId) {
      localStorage.removeItem(STORAGE_KEYS.PROGRESS_PREFIX + shiftId);
      return { success: true };
    },

    // 5. POST /api/tests/:shiftId/submit
    async handleSubmit(shiftId, body) {
      const shiftData = await this.getShiftData(shiftId);
      const userResponses = body.responses || {};
      const timeSpent = body.timeSpentSeconds || 0;

      const questions = (shiftData && shiftData.questions) || [];
      const bookmarks = getLocalJSON(STORAGE_KEYS.BOOKMARKS, {});
      const mistakes = getLocalJSON(STORAGE_KEYS.MISTAKES, {});

      let totalCorrect = 0;
      let totalWrong = 0;
      let totalUnattempted = 0;
      let totalScore = 0;

      const sectionScores = {
        "General Intelligence & Reasoning": { attempted: 0, correct: 0, wrong: 0, score: 0 },
        "General Awareness": { attempted: 0, correct: 0, wrong: 0, score: 0 },
        "Quantitative Aptitude": { attempted: 0, correct: 0, wrong: 0, score: 0 },
        "English Comprehension": { attempted: 0, correct: 0, wrong: 0, score: 0 }
      };

      const evaluatedResponses = questions.map(q => {
        const qid = `${shiftData.shift_id}_${q.id}`;
        const uResp = userResponses[q.id] || {};
        const selOpt = uResp.option || null;
        const correctOpt = q.correct ? String(q.correct).trim().toUpperCase() : '';
        const userOpt = selOpt ? String(selOpt).trim().toUpperCase() : null;

        let isCorrect = 0;
        let points = 0;

        if (userOpt) {
          if (userOpt === correctOpt) {
            isCorrect = 1;
            points = 2.0;
            totalCorrect++;
          } else {
            isCorrect = 0;
            points = -0.5;
            totalWrong++;
          }
        } else {
          totalUnattempted++;
        }

        totalScore += points;

        const secName = q.section || "General Intelligence & Reasoning";
        if (sectionScores[secName]) {
          if (userOpt) {
            sectionScores[secName].attempted++;
            if (isCorrect) sectionScores[secName].correct++;
            else sectionScores[secName].wrong++;
          }
          sectionScores[secName].score = Number((sectionScores[secName].score + points).toFixed(1));
        }

        // Mistakes Notebook Entry
        if (userOpt && isCorrect === 0) {
          const existing = mistakes[qid] || {
            question_id: qid,
            test_id: shiftData.shift_id,
            shift_id: shiftData.shift_id,
            test_title: shiftData.title,
            qnum: q.id,
            section: q.section,
            stem_img: q.stem_img,
            solution_img: q.solution_img,
            correct_option: q.correct,
            error_count: 0,
            mastery_status: 'NEEDS_PRACTICE'
          };
          existing.error_count = (existing.error_count || 0) + 1;
          existing.mastery_status = 'NEEDS_PRACTICE';
          existing.updated_at = new Date().toISOString();
          mistakes[qid] = existing;
        }

        return {
          id: `r_${qid}`,
          question_id: qid,
          qnum: q.id,
          section: q.section,
          stem_img: q.stem_img,
          solution_img: q.solution_img,
          correct_option: q.correct,
          selected_option: userOpt,
          is_correct: isCorrect,
          time_spent_seconds: uResp.timeSpent || 0,
          bookmarked: !!bookmarks[qid]
        };
      });

      // Save updated mistakes
      setLocalJSON(STORAGE_KEYS.MISTAKES, mistakes);

      // Clear in-progress session
      localStorage.removeItem(STORAGE_KEYS.PROGRESS_PREFIX + shiftId);

      const totalAttempted = totalCorrect + totalWrong;
      const accuracy = totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : 0;
      const finalScore = Number(Math.max(-50, totalScore).toFixed(1));

      const attemptId = Date.now();
      const attempt = {
        id: attemptId,
        set_id: shiftData.shift_id,
        shift_id: shiftData.shift_id,
        test_title: shiftData.title,
        score: finalScore,
        correct_count: totalCorrect,
        wrong_count: totalWrong,
        unattempted_count: totalUnattempted,
        accuracy: accuracy,
        time_spent_seconds: timeSpent,
        submitted_at: new Date().toISOString(),
        section_scores: sectionScores,
        responses: evaluatedResponses
      };

      const attempts = getLocalJSON(STORAGE_KEYS.ATTEMPTS, []);
      attempts.push(attempt);
      setLocalJSON(STORAGE_KEYS.ATTEMPTS, attempts);

      return {
        success: true,
        attemptId: attempt.id,
        score: attempt.score,
        accuracy: attempt.accuracy,
        correct_count: attempt.correct_count,
        wrong_count: attempt.wrong_count
      };
    },

    // 6. GET /api/attempts/:attemptId
    async handleGetAttempt(attemptId) {
      const attempts = getLocalJSON(STORAGE_KEYS.ATTEMPTS, []);
      const a = attempts.find(x => String(x.id) === String(attemptId));
      if (!a) {
        return { success: false, error: 'Attempt not found' };
      }

      const bookmarks = getLocalJSON(STORAGE_KEYS.BOOKMARKS, {});
      const responses = (a.responses || []).map(r => ({
        ...r,
        bookmarked: !!bookmarks[r.question_id]
      }));

      return {
        success: true,
        attempt: a,
        responses: responses
      };
    },

    // 7. GET /api/analytics
    async handleGetAnalytics() {
      const attempts = getLocalJSON(STORAGE_KEYS.ATTEMPTS, []);
      const mistakes = getLocalJSON(STORAGE_KEYS.MISTAKES, {});
      const bookmarks = getLocalJSON(STORAGE_KEYS.BOOKMARKS, {});

      const totalTestsTaken = attempts.length;
      let totalCorrect = 0;
      let totalWrong = 0;
      let totalSkipped = 0;
      let sumScore = 0;
      let maxScore = 0;
      let totalSeconds = 0;

      const sectionAnalysis = {
        "General Intelligence & Reasoning": { attempted: 0, correct: 0, wrong: 0, accuracy: 0 },
        "General Awareness": { attempted: 0, correct: 0, wrong: 0, accuracy: 0 },
        "Quantitative Aptitude": { attempted: 0, correct: 0, wrong: 0, accuracy: 0 },
        "English Comprehension": { attempted: 0, correct: 0, wrong: 0, accuracy: 0 }
      };

      attempts.forEach(a => {
        totalCorrect += (a.correct_count || 0);
        totalWrong += (a.wrong_count || 0);
        totalSkipped += (a.unattempted_count || 0);
        sumScore += (a.score || 0);
        if (a.score > maxScore) maxScore = a.score;
        totalSeconds += (a.time_spent_seconds || 0);

        (a.responses || []).forEach(r => {
          if (r.selected_option && sectionAnalysis[r.section]) {
            sectionAnalysis[r.section].attempted++;
            if (r.is_correct === 1) sectionAnalysis[r.section].correct++;
            else sectionAnalysis[r.section].wrong++;
          }
        });
      });

      // Calculate accuracy per section
      Object.keys(sectionAnalysis).forEach(sec => {
        const item = sectionAnalysis[sec];
        item.accuracy = item.attempted > 0 ? Number(((item.correct / item.attempted) * 100).toFixed(1)) : 0;
      });

      const totalAttempted = totalCorrect + totalWrong;
      const overallAccuracy = totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : '0.0';
      const avgScore = totalTestsTaken > 0 ? Number((sumScore / totalTestsTaken).toFixed(1)) : '0.0';
      const bestScore = totalTestsTaken > 0 ? Number(maxScore).toFixed(1) : '0.0';

      const recentAttempts = attempts.slice(-10).reverse().map(a => ({
        id: a.id,
        score: a.score,
        correct_count: a.correct_count,
        wrong_count: a.wrong_count,
        accuracy: a.accuracy,
        time_spent_seconds: a.time_spent_seconds,
        submitted_at: a.submitted_at,
        test_title: a.test_title,
        shift_id: a.shift_id
      }));

      const activeMistakesCount = Object.values(mistakes).filter(m => m.mastery_status !== 'MASTERED').length;
      const bookmarksCount = Object.keys(bookmarks).length;

      return {
        success: true,
        summary: {
          totalTestsTaken,
          avgScore,
          bestScore,
          totalCorrect,
          totalWrong,
          totalSkipped,
          overallAccuracy,
          totalTimeMinutes: Math.round(totalSeconds / 60)
        },
        sectionAnalysis,
        recentAttempts,
        mistakesCount: activeMistakesCount,
        bookmarksCount: bookmarksCount
      };
    },

    // 8. GET /api/mistakes
    async handleGetMistakes(url) {
      const u = new URL(url, window.location.href);
      const secParam = u.searchParams.get('section') || 'all';
      const statusParam = u.searchParams.get('status') || 'all';

      const mistakesDict = getLocalJSON(STORAGE_KEYS.MISTAKES, {});
      let list = Object.values(mistakesDict);

      if (secParam !== 'all') {
        list = list.filter(m => m.section === secParam);
      }
      if (statusParam !== 'all') {
        list = list.filter(m => m.mastery_status === statusParam);
      }

      list.sort((a, b) => (b.error_count || 0) - (a.error_count || 0));

      return { success: true, count: list.length, mistakes: list };
    },

    // 9. PATCH /api/mistakes/:id/status
    async handleUpdateMistakeStatus(questionId, body) {
      const mistakes = getLocalJSON(STORAGE_KEYS.MISTAKES, {});
      if (mistakes[questionId]) {
        mistakes[questionId].mastery_status = body.status;
        mistakes[questionId].updated_at = new Date().toISOString();
        setLocalJSON(STORAGE_KEYS.MISTAKES, mistakes);
      }
      return { success: true };
    },

    // 10. GET /api/bookmarks
    async handleGetBookmarks() {
      const dict = getLocalJSON(STORAGE_KEYS.BOOKMARKS, {});
      const list = Object.values(dict).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      return { success: true, count: list.length, bookmarks: list };
    },

    // 11. POST /api/bookmarks/toggle
    async handleToggleBookmark(body) {
      const { questionId, setId, userNote, tag } = body;
      const dict = getLocalJSON(STORAGE_KEYS.BOOKMARKS, {});

      if (dict[questionId]) {
        delete dict[questionId];
        setLocalJSON(STORAGE_KEYS.BOOKMARKS, dict);
        return { success: true, bookmarked: false };
      }

      // Add to bookmarks
      let q = (window.cbtState && window.cbtState.questions ? window.cbtState.questions.find(x => String(x.id) === String(questionId) || String(x.qnum) === String(questionId)) : null);
      const test = window.cbtState && window.cbtState.currentTest;

      dict[questionId] = {
        question_id: questionId,
        set_id: setId || (test ? test.id : ''),
        shift_id: (test ? test.shift_id : '') || (setId || ''),
        test_title: test ? test.title : 'SSC CGL Practice Shift',
        qnum: q ? q.qnum : (questionId.split('_').pop() || 1),
        section: q ? q.section : 'General Intelligence & Reasoning',
        stem_img: q ? q.stem_img : '',
        solution_img: q ? q.solution_img : '',
        correct_option: q ? q.correct_option : '',
        user_note: userNote || '',
        tag: tag || 'Important',
        created_at: new Date().toISOString()
      };

      setLocalJSON(STORAGE_KEYS.BOOKMARKS, dict);
      return { success: true, bookmarked: true };
    },

    // 12. PATCH /api/bookmarks/:id/note
    async handleUpdateBookmarkNote(questionId, body) {
      const dict = getLocalJSON(STORAGE_KEYS.BOOKMARKS, {});
      if (dict[questionId]) {
        dict[questionId].user_note = body.userNote || '';
        setLocalJSON(STORAGE_KEYS.BOOKMARKS, dict);
      }
      return { success: true };
    }
  };

  // Intercept fetch calls for /api
  const originalFetch = window.fetch;

  window.fetch = async function(resource, init) {
    const urlStr = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
    
    // Only intercept /api/... requests
    if (urlStr.includes('/api/')) {
      if (StaticCbtEngine.isStaticMode) {
        return mockApiResponse(await routeApiRequest(urlStr, init));
      } else {
        try {
          const res = await originalFetch(resource, init);
          // If server returns 404 HTML (e.g. GitHub Pages fallback), switch to static mode
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || ct.includes('text/html')) {
            StaticCbtEngine.isStaticMode = true;
            return mockApiResponse(await routeApiRequest(urlStr, init));
          }
          return res;
        } catch (netErr) {
          StaticCbtEngine.isStaticMode = true;
          return mockApiResponse(await routeApiRequest(urlStr, init));
        }
      }
    }

    return originalFetch(resource, init);
  };

  async function routeApiRequest(urlStr, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    const u = new URL(urlStr, window.location.href);
    const path = u.pathname;

    let body = {};
    if (init.body) {
      try {
        body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      } catch (e) {
        body = {};
      }
    }

    // Route matching
    if (path.endsWith('/api/analytics') && method === 'GET') {
      return await StaticCbtEngine.handleGetAnalytics();
    }
    if (path.endsWith('/api/tests') && method === 'GET') {
      return await StaticCbtEngine.handleGetTests();
    }
    if (path.endsWith('/api/bookmarks') && method === 'GET') {
      return await StaticCbtEngine.handleGetBookmarks();
    }
    if (path.includes('/api/bookmarks/toggle') && method === 'POST') {
      return await StaticCbtEngine.handleToggleBookmark(body);
    }
    if (path.includes('/api/bookmarks/') && path.endsWith('/note') && method === 'PATCH') {
      const qid = cleanId(path.split('/api/bookmarks/')[1].replace('/note', ''));
      return await StaticCbtEngine.handleUpdateBookmarkNote(qid, body);
    }
    if (path.includes('/api/mistakes') && method === 'GET') {
      return await StaticCbtEngine.handleGetMistakes(urlStr);
    }
    if (path.includes('/api/mistakes/') && path.endsWith('/status') && method === 'PATCH') {
      const qid = cleanId(path.split('/api/mistakes/')[1].replace('/status', ''));
      return await StaticCbtEngine.handleUpdateMistakeStatus(qid, body);
    }
    if (path.includes('/api/attempts/') && method === 'GET') {
      const attId = cleanId(path.split('/api/attempts/')[1]);
      return await StaticCbtEngine.handleGetAttempt(attId);
    }
    if (path.includes('/api/tests/') && path.endsWith('/save-progress') && method === 'POST') {
      const shiftId = cleanId(path.split('/api/tests/')[1].replace('/save-progress', ''));
      return await StaticCbtEngine.handleSaveProgress(shiftId, body);
    }
    if (path.includes('/api/tests/') && path.endsWith('/reset') && method === 'POST') {
      const shiftId = cleanId(path.split('/api/tests/')[1].replace('/reset', ''));
      return await StaticCbtEngine.handleReset(shiftId);
    }
    if (path.includes('/api/tests/') && path.endsWith('/submit') && method === 'POST') {
      const shiftId = cleanId(path.split('/api/tests/')[1].replace('/submit', ''));
      return await StaticCbtEngine.handleSubmit(shiftId, body);
    }
    if (path.includes('/api/tests/') && method === 'GET') {
      const shiftId = cleanId(path.split('/api/tests/')[1]);
      return await StaticCbtEngine.handleGetTestById(shiftId);
    }

    return { success: false, error: 'Endpoint not found in static engine' };
  }

  function mockApiResponse(dataObj) {
    const jsonStr = JSON.stringify(dataObj);
    return new Response(jsonStr, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // Initialize engine immediately
  StaticCbtEngine.init();
  window.StaticCbtEngine = StaticCbtEngine;
})();
