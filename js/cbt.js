// SSC CGL Full-Stack CBT Platform Client Controller
const API_BASE = '/api';

let cbtState = {
  activeView: 'dashboard', // 'dashboard' | 'cbt' | 'mistakes' | 'bookmarks'
  tests: [],
  currentTest: null,
  questions: [],
  sections: [],
  currentIndex: 0,
  userResponses: {}, // qnum -> { option: 'A'|'B'|'C'|'D'|null, status: '...', timeSpent: 0 }
  testMode: 'exam',
  timeRemaining: 3600,
  timerInterval: null,
  isSubmitted: false,
  dashFilter: 'all',
  dashQuery: '',
  mistakesSection: 'all',
  mistakesStatus: 'all',
  bookmarksSection: 'all'
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboard();
  bindEvents();
});

// VIEW SWITCHER
function switchAppView(viewName) {
  cbtState.activeView = viewName;

  document.querySelectorAll('.app-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.dashboard-view, .cbt-view-wrapper, .subpage-container').forEach(el => {
    el.style.display = 'none';
  });

  const timerWrap = document.getElementById('exam-timer-wrapper');
  const modeToggle = document.getElementById('exam-mode-toggle');

  if (viewName === 'dashboard') {
    document.getElementById('nav-dash').classList.add('active');
    document.getElementById('view-dashboard').style.display = 'block';
    if (timerWrap) timerWrap.style.display = 'none';
    if (modeToggle) modeToggle.style.display = 'none';
    loadDashboard();
  } else if (viewName === 'cbt') {
    document.getElementById('nav-cbt').classList.add('active');
    document.getElementById('view-cbt').style.display = 'flex';
    if (timerWrap) timerWrap.style.display = 'flex';
    if (modeToggle) modeToggle.style.display = 'flex';
    if (!cbtState.currentTest && cbtState.tests.length > 0) {
      openShiftSelector();
    }
  } else if (viewName === 'mistakes') {
    document.getElementById('nav-mistakes').classList.add('active');
    document.getElementById('view-mistakes').style.display = 'block';
    if (timerWrap) timerWrap.style.display = 'none';
    if (modeToggle) modeToggle.style.display = 'none';
    loadMistakes();
  } else if (viewName === 'bookmarks') {
    document.getElementById('nav-bookmarks').classList.add('active');
    document.getElementById('view-bookmarks').style.display = 'block';
    if (timerWrap) timerWrap.style.display = 'none';
    if (modeToggle) modeToggle.style.display = 'none';
    loadBookmarks();
  }
}

// DASHBOARD & ANALYTICS
async function loadDashboard() {
  try {
    // 1. Fetch analytics overview
    const anRes = await fetch(`${API_BASE}/analytics`);
    const anData = await anRes.json();
    if (anData.success) {
      document.getElementById('dash-total-tests').textContent = anData.summary.totalTestsTaken;
      document.getElementById('dash-avg-score').innerHTML = `${anData.summary.avgScore} <span style="font-size:14px; color:#64748b; font-weight:600;">/ 200</span>`;
      document.getElementById('dash-best-score').innerHTML = `${anData.summary.bestScore} <span style="font-size:14px; color:#64748b; font-weight:600;">/ 200</span>`;
      document.getElementById('dash-accuracy').textContent = `${anData.summary.overallAccuracy}%`;

      // Header Badges
      const mistBadge = document.getElementById('nav-mistakes-badge');
      if (anData.mistakesCount > 0) {
        mistBadge.textContent = anData.mistakesCount;
        mistBadge.style.display = 'inline-block';
      } else {
        mistBadge.style.display = 'none';
      }

      const bmBadge = document.getElementById('nav-bookmarks-badge');
      if (anData.bookmarksCount > 0) {
        bmBadge.textContent = anData.bookmarksCount;
        bmBadge.style.display = 'inline-block';
      } else {
        bmBadge.style.display = 'none';
      }

      // Render Sectional Breakdown Cards
      renderSectionalBreakdown(anData.sectionAnalysis);

      // Render Recent Attempts History
      renderRecentAttempts(anData.recentAttempts);
    }

    // 2. Fetch tests list
    const testsRes = await fetch(`${API_BASE}/tests`);
    const testsData = await testsRes.json();
    if (testsData.success) {
      cbtState.tests = testsData.tests;
      const countEl = document.getElementById('count-all-shifts');
      if (countEl) countEl.textContent = testsData.tests.length;
      renderDashboardShifts();
      populateShiftSelectorDropdown(testsData.tests);
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

function renderSectionalBreakdown(secAnalysis) {
  const container = document.getElementById('dash-sectional-container');
  if (!container || !secAnalysis) return;

  const sections = [
    { key: "General Intelligence & Reasoning", short: "Reasoning", icon: "🧠" },
    { key: "General Awareness", short: "General Awareness", icon: "🌍" },
    { key: "Quantitative Aptitude", short: "Quantitative Aptitude", icon: "📐" },
    { key: "English Comprehension", short: "English Comprehension", icon: "📖" }
  ];

  container.innerHTML = sections.map(sec => {
    const data = secAnalysis[sec.key] || { attempted: 0, correct: 0, wrong: 0, accuracy: 0 };
    const accColor = data.accuracy >= 75 ? '#16a34a' : (data.accuracy >= 50 ? '#2563eb' : (data.attempted > 0 ? '#ef4444' : '#64748b'));
    
    return `
      <div class="sec-card">
        <div class="sec-card-header" title="${sec.key}">
          ${sec.icon} ${sec.short}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:6px;">
          <span style="font-size:20px; font-weight:800; color:${accColor}; font-family:var(--font-heading);">${data.accuracy}%</span>
          <span style="font-size:11px; color:#64748b;">${data.correct} correct / ${data.attempted} att</span>
        </div>
        <div class="sec-progress-bar">
          <div class="sec-progress-fill" style="width:${Math.min(100, Math.max(0, data.accuracy))}%; background:${accColor};"></div>
        </div>
        <div class="sec-card-meta">
          <span style="color:#16a34a; font-weight:600;">+${data.correct * 2} pts</span>
          <span style="color:#ef4444; font-weight:600;">-${(data.wrong * 0.5).toFixed(1)} neg</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentAttempts(attempts) {
  const container = document.getElementById('dash-recent-section');
  const tbody = document.getElementById('dash-recent-tbody');
  if (!container || !tbody) return;

  if (!attempts || attempts.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  tbody.innerHTML = attempts.map(a => {
    const dateStr = a.submitted_at ? new Date(a.submitted_at).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    }) : 'Recent';

    const scoreColor = a.score >= 130 ? '#16a34a' : (a.score >= 90 ? '#2563eb' : '#dc2626');
    const mins = Math.round(a.time_spent_seconds / 60);

    return `
      <tr>
        <td style="color:#64748b; font-size:12px;">${dateStr}</td>
        <td style="font-weight:700; color:#0f172a;">${a.test_title}</td>
        <td><b style="color:${scoreColor}; font-size:14px;">${a.score}</b> <span style="font-size:11px; color:#64748b;">/ 200</span></td>
        <td><span style="background:#eff6ff; color:#1e40af; font-weight:700; padding:2px 8px; border-radius:4px; font-size:12px;">${a.accuracy}%</span></td>
        <td style="color:#64748b;">${mins} mins</td>
        <td>
          <button class="btn-cbt" style="background:#f1f5f9; color:#1e293b; border:1px solid #cbd5e1; font-size:11px; padding:4px 10px;" onclick="loadScorecardModal(${a.id})">
            📊 View Scorecard
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function setDashboardShiftFilter(filter, btn) {
  cbtState.dashFilter = filter;
  document.querySelectorAll('.dash-controls-bar .filter-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDashboardShifts();
}

function filterDashboardShifts() {
  const input = document.getElementById('dash-shift-search');
  cbtState.dashQuery = input ? input.value.trim().toLowerCase() : '';
  renderDashboardShifts();
}

function renderDashboardShifts() {
  const container = document.getElementById('dash-shifts-grid');
  if (!container) return;

  const q = cbtState.dashQuery;
  const f = cbtState.dashFilter;

  const filtered = cbtState.tests.filter(t => {
    // Search query match
    if (q) {
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchShift = t.shift_id.toLowerCase().includes(q);
      if (!matchTitle && !matchShift) return false;
    }

    // Status filter match
    if (f === 'completed') return t.status === 'COMPLETED';
    if (f === 'in_progress') return t.status === 'IN_PROGRESS';
    if (f === 'not_started') return t.status === 'NOT_STARTED';
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:50px; background:#fff; border-radius:8px; border:1px solid #e2e8f0;">
        <div style="font-size:32px; margin-bottom:8px;">🔍</div>
        <h4 style="font-size:16px; font-weight:700; color:#1e293b;">No test shifts match your filter</h4>
        <p style="font-size:13px; color:#64748b; margin-top:4px;">Try searching for a different date or select "All Shifts".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(t => {
    let statusBadge = '<span class="status-badge status-not-started">Not Attempted</span>';
    let btnText = 'Start Mock Test &rarr;';
    let btnClass = 'btn-save-next';
    let resetBtn = '';

    if (t.status === 'COMPLETED') {
      const best = t.best_score !== null ? t.best_score : '0.0';
      statusBadge = `<span class="status-badge status-completed">Best: ${best} / 200</span>`;
      btnText = 'Retake Mock Test';
      btnClass = 'btn-save-next';
      resetBtn = `<button class="btn-cbt" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; font-size:11px; padding:6px 10px;" onclick="resetShiftSession(${t.id}, event)" title="Reset attempt session">🔄 Reset</button>`;
    } else if (t.status === 'IN_PROGRESS') {
      statusBadge = '<span class="status-badge status-in-progress">In Progress</span>';
      btnText = 'Resume Test &rarr;';
      btnClass = 'btn-prev';
      resetBtn = `<button class="btn-cbt" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; font-size:11px; padding:6px 10px;" onclick="resetShiftSession(${t.id}, event)" title="Restart test from beginning">🔄 Restart</button>`;
    }

    return `
      <div class="shift-box">
        <div>
          <div class="shift-box-header">
            ${statusBadge}
            <span style="font-size:12px; color:#64748b;">⏱️ 60 Mins</span>
          </div>
          <h4 style="font-size:15px; font-weight:700; color:#0f172a; margin-bottom:8px; font-family:var(--font-heading);">${t.title}</h4>
          <div style="font-size:12px; color:#64748b; margin-bottom:15px;">
            100 Questions &bull; 200 Marks &bull; Official SSC PYQ
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-cbt ${btnClass}" style="flex:1; justify-content:center;" onclick="startShiftFromDash(${t.id})">
            ${btnText}
          </button>
          ${resetBtn}
        </div>
      </div>
    `;
  }).join('');
}

async function resetShiftSession(setId, event) {
  if (event) event.stopPropagation();
  if (!confirm('Are you sure you want to reset and restart this test from the beginning?')) return;

  try {
    const res = await fetch(`${API_BASE}/tests/${setId}/reset`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      await loadDashboard();
    }
  } catch (err) {
    console.error('Reset error:', err);
  }
}

function startShiftFromDash(setId) {
  switchAppView('cbt');
  loadAndStartShift(setId, 'exam');
}

// SHIFT SELECTION MODAL
function populateShiftSelectorDropdown(tests) {
  const container = document.getElementById('shifts-list-container');
  if (!container) return;

  container.innerHTML = tests.map((s, idx) => `
    <div class="shift-select-card ${idx === 0 ? 'selected' : ''}" onclick="selectShiftCard(${s.id}, this)">
      <div class="shift-card-header">
        <span class="shift-card-badge">Tier-1 CBT</span>
        <span class="shift-card-time">⏱️ 60 Mins</span>
      </div>
      <h3 class="shift-card-title">${s.title}</h3>
      <div class="shift-card-stats">
        <span>📝 100 Qs</span>
        <span>🎯 200 Marks</span>
        <span>${s.status === 'COMPLETED' ? '🏆 ' + s.best_score : (s.status === 'IN_PROGRESS' ? '⏳ In Progress' : '⚡ Ready')}</span>
      </div>
    </div>
  `).join('');
}

let selectedShiftIdForStart = null;
function selectShiftCard(shiftId, elem) {
  selectedShiftIdForStart = shiftId;
  document.querySelectorAll('.shift-select-card').forEach(c => c.classList.remove('selected'));
  elem.classList.add('selected');
}

function openShiftSelector() {
  const modal = document.getElementById('shift-modal');
  if (modal) modal.style.display = 'flex';
  if (cbtState.tests.length > 0 && !selectedShiftIdForStart) {
    selectedShiftIdForStart = cbtState.tests[0].id;
  }
}

function closeShiftSelector() {
  const modal = document.getElementById('shift-modal');
  if (modal) modal.style.display = 'none';
}

async function startSelectedShift() {
  const shiftId = selectedShiftIdForStart || (cbtState.tests[0] && cbtState.tests[0].id);
  const modeRadio = document.querySelector('input[name="start-mode"]:checked');
  const mode = modeRadio ? modeRadio.value : 'exam';

  closeShiftSelector();
  switchAppView('cbt');
  await loadAndStartShift(shiftId, mode);
}

// LOAD & START TEST SESSION
async function loadAndStartShift(shiftId, mode = 'exam') {
  try {
    const res = await fetch(`${API_BASE}/tests/${shiftId}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    cbtState.currentTest = data.test;
    cbtState.questions = data.questions;
    cbtState.sections = data.sections;
    cbtState.testMode = mode;
    cbtState.isSubmitted = false;

    // Check for active session recovery
    if (data.activeSession && mode === 'exam') {
      cbtState.currentIndex = data.activeSession.currentQIndex || 0;
      cbtState.timeRemaining = data.activeSession.timeRemaining || (data.test.duration_minutes * 60);
      cbtState.userResponses = data.activeSession.responses || {};
    } else {
      cbtState.currentIndex = 0;
      cbtState.timeRemaining = data.test.duration_minutes * 60;
      cbtState.userResponses = {};
      data.questions.forEach((q, i) => {
        cbtState.userResponses[q.qnum] = {
          option: null,
          status: i === 0 ? 'not_answered' : 'not_visited',
          timeSpent: 0
        };
      });
    }

    document.getElementById('exam-shift-title').textContent = data.test.title;
    updateModeDisplay();
    renderSectionTabs();
    renderPalette();
    renderCurrentQuestion();
    startTimer();
  } catch (err) {
    console.error('Failed to load shift:', err);
    alert('Error loading test paper: ' + err.message);
  }
}

function updateModeDisplay() {
  const examBtn = document.getElementById('mode-btn-exam');
  const pracBtn = document.getElementById('mode-btn-practice');
  const checkAnsBtn = document.getElementById('btn-check-answer');
  const timerLabel = document.getElementById('timer-label');

  if (cbtState.testMode === 'practice') {
    if (pracBtn) pracBtn.classList.add('active');
    if (examBtn) examBtn.classList.remove('active');
    if (checkAnsBtn) checkAnsBtn.style.display = 'inline-block';
    if (timerLabel) timerLabel.textContent = 'Practice Mode';
  } else {
    if (examBtn) examBtn.classList.add('active');
    if (pracBtn) pracBtn.classList.remove('active');
    if (checkAnsBtn) checkAnsBtn.style.display = 'none';
    if (timerLabel) timerLabel.textContent = 'Time Left';
  }
}

function setTestMode(mode) {
  cbtState.testMode = mode;
  updateModeDisplay();
}

// TIMER & AUTOSAVE
function startTimer() {
  if (cbtState.timerInterval) clearInterval(cbtState.timerInterval);
  updateTimerDisplay();

  let autoSaveCounter = 0;

  cbtState.timerInterval = setInterval(() => {
    if (cbtState.isSubmitted) {
      clearInterval(cbtState.timerInterval);
      return;
    }

    cbtState.timeRemaining--;

    // Time spent on current question
    const currQ = cbtState.questions[cbtState.currentIndex];
    if (currQ && cbtState.userResponses[currQ.qnum]) {
      cbtState.userResponses[currQ.qnum].timeSpent++;
    }

    updateTimerDisplay();

    // Autosave progress every 15 seconds in exam mode
    autoSaveCounter++;
    if (autoSaveCounter >= 15 && cbtState.testMode === 'exam' && cbtState.currentTest) {
      autoSaveCounter = 0;
      saveActiveSessionProgress();
    }

    if (cbtState.timeRemaining <= 0) {
      clearInterval(cbtState.timerInterval);
      alert('Time is up! Submitting your test automatically.');
      submitTestFinal();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-val');
  if (!display) return;

  const m = Math.floor(Math.max(0, cbtState.timeRemaining) / 60);
  const s = Math.max(0, cbtState.timeRemaining) % 60;
  display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  if (cbtState.timeRemaining <= 300) {
    display.className = 'timer-display danger';
  } else if (cbtState.timeRemaining <= 900) {
    display.className = 'timer-display warning';
  } else {
    display.className = 'timer-display';
  }
}

async function saveActiveSessionProgress() {
  if (!cbtState.currentTest || cbtState.isSubmitted) return;
  try {
    await fetch(`${API_BASE}/tests/${cbtState.currentTest.id}/save-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentQIndex: cbtState.currentIndex,
        timeRemaining: cbtState.timeRemaining,
        testMode: cbtState.testMode,
        responses: cbtState.userResponses
      })
    });
  } catch (err) {
    console.warn('Autosave warning:', err);
  }
}

// SECTIONS
function renderSectionTabs() {
  const container = document.getElementById('section-tabs');
  if (!container) return;

  const currQ = cbtState.questions[cbtState.currentIndex];
  const currSec = currQ ? currQ.section : (cbtState.sections[0] && cbtState.sections[0].name);

  container.innerHTML = cbtState.sections.map((s, idx) => {
    const isActive = s.name === currSec;
    const answeredCount = cbtState.questions
      .filter(q => q.section === s.name && cbtState.userResponses[q.qnum]?.status.includes('answered'))
      .length;

    return `
      <button class="sec-tab ${isActive ? 'active' : ''}" onclick="jumpToSection(${idx})">
        <span>${s.name}</span>
        <span class="sec-badge">${answeredCount}/${s.questions_count}</span>
      </button>
    `;
  }).join('');
}

function jumpToSection(secIndex) {
  const sec = cbtState.sections[secIndex];
  if (!sec) return;
  const targetIndex = cbtState.questions.findIndex(q => q.qnum === sec.start_id);
  if (targetIndex !== -1) {
    jumpToQuestion(targetIndex);
  }
}

// QUESTION RENDERING
function renderCurrentQuestion() {
  const q = cbtState.questions[cbtState.currentIndex];
  if (!q) return;

  if (cbtState.userResponses[q.qnum].status === 'not_visited') {
    cbtState.userResponses[q.qnum].status = 'not_answered';
  }

  document.getElementById('q-title').textContent = `Question ${q.qnum}`;
  document.getElementById('q-section-name').textContent = q.section;
  
  const qImg = document.getElementById('q-image');
  qImg.src = q.stem_img;

  // Bookmark status
  const bmBtn = document.getElementById('q-bookmark-btn');
  if (q.is_bookmarked) {
    bmBtn.classList.add('bookmarked');
    bmBtn.innerHTML = '⭐ <span>Bookmarked</span>';
  } else {
    bmBtn.classList.remove('bookmarked');
    bmBtn.innerHTML = '☆ <span>Bookmark</span>';
  }

  // Solution Box
  const solBox = document.getElementById('solution-box');
  solBox.classList.remove('show');
  document.getElementById('solution-img').src = q.solution_img;

  // Radio selection state
  const savedResponse = cbtState.userResponses[q.qnum];
  const labels = document.querySelectorAll('.opt-label');
  labels.forEach(lbl => {
    const radio = lbl.querySelector('input[name="opt-radio"]');
    const isChecked = (radio && radio.value === savedResponse.option);
    if (radio) radio.checked = isChecked;
    if (isChecked) lbl.classList.add('selected');
    else lbl.classList.remove('selected');
  });

  renderSectionTabs();
  renderPalette();
}

function selectOption(letter) {
  const q = cbtState.questions[cbtState.currentIndex];
  if (!q) return;

  const radio = document.querySelector(`input[name="opt-radio"][value="${letter}"]`);
  if (radio) radio.checked = true;

  document.querySelectorAll('.opt-label').forEach(lbl => {
    if (lbl.dataset.opt === letter) lbl.classList.add('selected');
    else lbl.classList.remove('selected');
  });

  // Save selected option into current response state
  const userResp = cbtState.userResponses[q.qnum];
  userResp.option = letter;
  if (userResp.status === 'not_answered' || userResp.status === 'not_visited') {
    userResp.status = 'answered';
  } else if (userResp.status === 'marked_review') {
    userResp.status = 'ans_marked_review';
  }

  renderPalette();
}

// ACTION BUTTONS
function saveAndNext() {
  const q = cbtState.questions[cbtState.currentIndex];
  if (!q) return;

  const selectedRadio = document.querySelector('input[name="opt-radio"]:checked');
  const userResp = cbtState.userResponses[q.qnum];

  if (selectedRadio) {
    userResp.option = selectedRadio.value;
    userResp.status = 'answered';
  } else {
    userResp.option = null;
    userResp.status = 'not_answered';
  }

  saveActiveSessionProgress();

  if (cbtState.currentIndex < cbtState.questions.length - 1) {
    cbtState.currentIndex++;
    renderCurrentQuestion();
  } else {
    renderPalette();
  }
}

function markForReviewAndNext() {
  const q = cbtState.questions[cbtState.currentIndex];
  if (!q) return;

  const selectedRadio = document.querySelector('input[name="opt-radio"]:checked');
  const userResp = cbtState.userResponses[q.qnum];

  if (selectedRadio) {
    userResp.option = selectedRadio.value;
    userResp.status = 'ans_marked_review';
  } else {
    userResp.option = null;
    userResp.status = 'marked_review';
  }

  saveActiveSessionProgress();

  if (cbtState.currentIndex < cbtState.questions.length - 1) {
    cbtState.currentIndex++;
    renderCurrentQuestion();
  } else {
    renderPalette();
  }
}

function clearResponse() {
  const q = cbtState.questions[cbtState.currentIndex];
  if (!q) return;

  document.querySelectorAll('input[name="opt-radio"]').forEach(r => r.checked = false);
  document.querySelectorAll('.opt-label').forEach(l => l.classList.remove('selected'));

  const userResp = cbtState.userResponses[q.qnum];
  userResp.option = null;
  userResp.status = 'not_answered';

  saveActiveSessionProgress();
  renderPalette();
}

function previousQuestion() {
  if (cbtState.currentIndex > 0) {
    cbtState.currentIndex--;
    renderCurrentQuestion();
  }
}

function jumpToQuestion(index) {
  if (index >= 0 && index < cbtState.questions.length) {
    cbtState.currentIndex = index;
    renderCurrentQuestion();
  }
}

// CHECK ANSWER (PRACTICE MODE)
function checkAnswer() {
  const q = cbtState.questions[cbtState.currentIndex];
  if (!q) return;

  const selectedRadio = document.querySelector('input[name="opt-radio"]:checked');
  const userChoice = selectedRadio ? selectedRadio.value : null;

  const solBox = document.getElementById('solution-box');
  const feedbackElem = document.getElementById('practice-feedback');

  if (!userChoice) {
    feedbackElem.innerHTML = `<span style="color:#ef4444; font-weight:700;">Please select an option first!</span> Official answer is <b>Option ${q.correct_option}</b>.`;
  } else if (userChoice === q.correct_option) {
    feedbackElem.innerHTML = `<span style="color:#16a34a; font-weight:700;">🎉 Correct!</span> You selected <b>Option ${userChoice}</b> which matches the official key.`;
  } else {
    feedbackElem.innerHTML = `<span style="color:#ef4444; font-weight:700;">❌ Incorrect.</span> You selected <b>Option ${userChoice}</b>, but official key is <b>Option ${q.correct_option}</b>.`;
  }

  solBox.classList.add('show');
  solBox.scrollIntoView({ behavior: 'smooth' });
}

// BOOKMARK TOGGLE
async function toggleCurrentBookmark() {
  const q = cbtState.questions[cbtState.currentIndex];
  if (!q || !cbtState.currentTest) return;

  try {
    const res = await fetch(`${API_BASE}/bookmarks/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: q.id,
        setId: cbtState.currentTest.id
      })
    });
    const data = await res.json();
    if (data.success) {
      q.is_bookmarked = data.bookmarked;
      renderCurrentQuestion();
    }
  } catch (err) {
    console.error('Bookmark error:', err);
  }
}

// PALETTE GRID
function renderPalette() {
  const container = document.getElementById('palette-grid');
  if (!container) return;

  const currQ = cbtState.questions[cbtState.currentIndex];
  const summaryEl = document.getElementById('palette-sec-summary');
  if (currQ && summaryEl) {
    const secQuestions = cbtState.questions.filter(q => q.section === currQ.section);
    const answeredCount = secQuestions.filter(q => cbtState.userResponses[q.qnum]?.status.includes('answered')).length;
    summaryEl.textContent = `${answeredCount}/${secQuestions.length} in Section`;
  }

  container.innerHTML = cbtState.questions.map((q, idx) => {
    const resp = cbtState.userResponses[q.qnum] || { status: 'not_visited' };
    const isCurrent = idx === cbtState.currentIndex;

    let statusClass = 'not-visited';
    if (resp.status === 'answered') statusClass = 'answered';
    else if (resp.status === 'not_answered') statusClass = 'not-answered';
    else if (resp.status === 'marked_review') statusClass = 'marked-review';
    else if (resp.status === 'ans_marked_review') statusClass = 'ans-marked-review';

    return `
      <button class="palette-btn ${statusClass} ${isCurrent ? 'current' : ''}" onclick="jumpToQuestion(${idx})">
        ${q.qnum}
      </button>
    `;
  }).join('');
}

// SUBMISSION & SCORECARD
function promptSubmitConfirmation() {
  const modal = document.getElementById('submit-confirm-modal');
  if (!modal) return;

  let answered = 0, notAnswered = 0, marked = 0, ansMarked = 0, notVisited = 0;
  cbtState.questions.forEach(q => {
    const status = cbtState.userResponses[q.qnum]?.status || 'not_visited';
    if (status === 'answered') answered++;
    else if (status === 'not_answered') notAnswered++;
    else if (status === 'marked_review') marked++;
    else if (status === 'ans_marked_review') ansMarked++;
    else notVisited++;
  });

  document.getElementById('sum-total').textContent = cbtState.questions.length;
  document.getElementById('sum-answered').textContent = answered;
  document.getElementById('sum-not-answered').textContent = notAnswered;
  document.getElementById('sum-marked').textContent = marked;
  document.getElementById('sum-ans-marked').textContent = ansMarked;
  document.getElementById('sum-not-visited').textContent = notVisited;

  modal.style.display = 'flex';
}

function closeSubmitConfirmation() {
  const modal = document.getElementById('submit-confirm-modal');
  if (modal) modal.style.display = 'none';
}

async function submitTestFinal() {
  closeSubmitConfirmation();
  cbtState.isSubmitted = true;
  clearInterval(cbtState.timerInterval);

  const totalTimeSpent = (cbtState.currentTest.duration_minutes * 60) - cbtState.timeRemaining;

  try {
    const res = await fetch(`${API_BASE}/tests/${cbtState.currentTest.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responses: cbtState.userResponses,
        timeSpentSeconds: totalTimeSpent
      })
    });
    const result = await res.json();
    if (result.success) {
      loadScorecardModal(result.attemptId);
    }
  } catch (err) {
    console.error('Submit error:', err);
    alert('Error submitting test: ' + err.message);
  }
}

async function loadScorecardModal(attemptId) {
  try {
    const res = await fetch(`${API_BASE}/attempts/${attemptId}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const a = data.attempt;

    const modalTitle = document.getElementById('scorecard-modal-title');
    if (modalTitle) modalTitle.textContent = `${a.test_title} - Performance Report`;

    document.getElementById('score-value').textContent = a.score;
    document.getElementById('score-accuracy').textContent = `${a.accuracy}%`;
    document.getElementById('score-attempted').textContent = `${a.correct_count + a.wrong_count}/100`;
    document.getElementById('score-correct').textContent = a.correct_count;
    document.getElementById('score-wrong').textContent = a.wrong_count;

    // Section Table
    const tableBody = document.getElementById('sec-score-tbody');
    tableBody.innerHTML = Object.keys(a.section_scores).map(sec => {
      const s = a.section_scores[sec];
      return `
        <tr>
          <td><b>${sec}</b></td>
          <td>${s.attempted}</td>
          <td><span style="color:#10b981; font-weight:700;">${s.correct}</span></td>
          <td><span style="color:#ef4444; font-weight:700;">${s.wrong}</span></td>
          <td><b>${s.score}</b> / 50</td>
        </tr>
      `;
    }).join('');

    // Dynamic Filter Tab Labels
    const totalCount = data.responses.length;
    const correctCount = data.responses.filter(r => r.is_correct === 1).length;
    const wrongCount = data.responses.filter(r => r.selected_option && r.is_correct === 0).length;
    const skippedCount = data.responses.filter(r => !r.selected_option).length;

    const btnAll = document.getElementById('btn-rev-all');
    if (btnAll) btnAll.textContent = `All (${totalCount})`;
    const btnCor = document.getElementById('btn-rev-correct');
    if (btnCor) btnCor.textContent = `Correct (${correctCount})`;
    const btnWro = document.getElementById('btn-rev-wrong');
    if (btnWro) btnWro.textContent = `Incorrect (${wrongCount})`;
    const btnSkp = document.getElementById('btn-rev-skipped');
    if (btnSkp) btnSkp.textContent = `Unattempted (${skippedCount})`;

    renderReviewCardsFromResponses(data.responses, 'all');

    const modal = document.getElementById('scorecard-modal');
    if (modal) modal.style.display = 'flex';
  } catch (err) {
    console.error('Failed to load scorecard:', err);
  }
}

let lastAttemptResponses = [];
function renderReviewCardsFromResponses(responses, filter = 'all') {
  lastAttemptResponses = responses;
  const container = document.getElementById('review-list-container');
  if (!container) return;

  const filtered = responses.filter(r => {
    if (filter === 'correct') return r.is_correct === 1;
    if (filter === 'wrong') return r.selected_option && r.is_correct === 0;
    if (filter === 'skipped') return !r.selected_option;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px; background:#f8fafc; border-radius:6px; color:#64748b;">
        No questions in this filter.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(r => {
    let cardClass = 'skipped-card';
    let badgeHtml = '<span style="color:#64748b; font-weight:700;">Unattempted</span>';

    if (r.selected_option) {
      if (r.is_correct === 1) {
        cardClass = 'correct-card';
        badgeHtml = '<span style="color:#10b981; font-weight:700;">+2.0 Marks (Correct)</span>';
      } else {
        cardClass = 'wrong-card';
        badgeHtml = '<span style="color:#ef4444; font-weight:700;">-0.5 Marks (Wrong)</span>';
      }
    }

    return `
      <div class="review-card ${cardClass}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-weight:700; color:#1e293b;">Question ${r.qnum} &bull; ${r.section}</span>
          ${badgeHtml}
        </div>
        <div style="margin-bottom:14px; text-align:center;">
          <img src="${r.stem_img}" style="max-width:100%; border:1px solid #e2e8f0; border-radius:6px; cursor:zoom-in;" onclick="openImageZoom('${r.stem_img}', 'Question ${r.qnum}')" />
        </div>
        <div style="display:flex; gap:20px; font-size:14px; margin-bottom:12px; background:#f8fafc; padding:10px 14px; border-radius:6px; border:1px solid #e2e8f0;">
          <div>Your Choice: <b>${r.selected_option ? 'Option ' + r.selected_option : 'None'}</b></div>
          <div>Official Answer: <b style="color:#16a34a;">Option ${r.correct_option}</b></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <button class="btn-cbt" style="background:#f1f5f9; color:#1e293b; border:1px solid #cbd5e1; font-size:12px;" onclick="toggleReviewSolution('rev-sol-${r.id}')">
            🔍 Toggle Official Solution Key
          </button>
          <button class="btn-cbt" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:12px;" onclick="toggleBookmarkInReview(${r.question_id}, this)">
            ⭐ Bookmark Question
          </button>
        </div>
        <div id="rev-sol-${r.id}" style="display:none; margin-top:12px; text-align:center;">
          <img src="${r.solution_img}" style="max-width:100%; border:1px solid #86efac; border-radius:6px; cursor:zoom-in;" onclick="openImageZoom('${r.solution_img}', 'Question ${r.qnum} Official Solution')" />
        </div>
      </div>
    `;
  }).join('');
}

async function toggleBookmarkInReview(questionId, btn) {
  try {
    const res = await fetch(`${API_BASE}/bookmarks/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId })
    });
    const data = await res.json();
    if (data.success) {
      if (data.bookmarked) {
        btn.innerHTML = '⭐ Bookmarked!';
        btn.style.background = '#fef3c7';
      } else {
        btn.innerHTML = '☆ Bookmark Question';
        btn.style.background = '#f1f5f9';
      }
    }
  } catch (err) {
    console.error('Bookmark error:', err);
  }
}

function filterReview(type, btn) {
  document.querySelectorAll('.review-filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReviewCardsFromResponses(lastAttemptResponses, type);
}

function toggleReviewSolution(elemId) {
  const elem = document.getElementById(elemId);
  if (!elem) return;
  elem.style.display = elem.style.display === 'none' ? 'block' : 'none';
}

function closeScorecard() {
  const modal = document.getElementById('scorecard-modal');
  if (modal) modal.style.display = 'none';
  loadDashboard();
}

// MISTAKES NOTEBOOK VIEW
function setMistakesSectionFilter(sec, btn) {
  cbtState.mistakesSection = sec;
  document.querySelectorAll('#view-mistakes .subpage-filter-bar .filter-pill').forEach(b => {
    if (b.getAttribute('onclick')?.includes('setMistakesSectionFilter')) b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
  loadMistakes();
}

function setMistakesStatusFilter(status, btn) {
  cbtState.mistakesStatus = status;
  document.querySelectorAll('#view-mistakes .subpage-filter-bar .filter-pill').forEach(b => {
    if (b.getAttribute('onclick')?.includes('setMistakesStatusFilter')) b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
  loadMistakes();
}

async function loadMistakes() {
  const container = document.getElementById('mistakes-container');
  if (!container) return;

  try {
    let url = `${API_BASE}/mistakes?`;
    if (cbtState.mistakesSection !== 'all') url += `section=${encodeURIComponent(cbtState.mistakesSection)}&`;
    if (cbtState.mistakesStatus !== 'all') url += `status=${encodeURIComponent(cbtState.mistakesStatus)}`;

    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    if (data.mistakes.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:#fff; border-radius:10px; border:1px solid #e2e8f0;">
          <div style="font-size:40px; margin-bottom:10px;">🎉</div>
          <h3 style="font-size:17px; font-weight:700; color:#1e293b;">Your Mistakes Notebook is clean!</h3>
          <p style="font-size:13px; color:#64748b; margin-top:4px;">No mistakes found for the selected filter. Keep taking mock tests to pinpoint revision targets.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data.mistakes.map(m => {
      const isMastered = m.mastery_status === 'MASTERED';
      const statusBtnText = isMastered ? '↺ Move to Needs Practice' : '✓ Mark as Mastered';
      const statusBtnColor = isMastered ? 'background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;' : 'background:#16a34a; color:#fff;';

      return `
        <div class="review-card ${isMastered ? '' : 'wrong-card'}" style="margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-weight:700; color:#1e293b;">${m.test_title} &bull; Q.${m.qnum} &bull; ${m.section}</span>
            <div style="display:flex; gap:8px;">
              <span style="font-size:11px; background:#fee2e2; color:#b91c1c; font-weight:700; padding:2px 8px; border-radius:4px;">Mistakes: ${m.error_count}</span>
              ${isMastered ? '<span style="font-size:11px; background:#dcfce7; color:#166534; font-weight:700; padding:2px 8px; border-radius:4px;">Mastered</span>' : ''}
            </div>
          </div>
          <div style="margin-bottom:12px; text-align:center;">
            <img src="${m.stem_img}" style="max-width:100%; border:1px solid #e2e8f0; border-radius:6px; cursor:zoom-in;" onclick="openImageZoom('${m.stem_img}', '${m.test_title} Q.${m.qnum}')" />
          </div>
          <div style="background:#f0fdf4; padding:10px 14px; border-radius:6px; font-size:13px; color:#166534; font-weight:700; margin-bottom:12px; border:1px solid #bbf7d0;">
            Official Answer: Option ${m.correct_option}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <button class="btn-cbt" style="background:#f1f5f9; color:#1e293b; border:1px solid #cbd5e1; font-size:12px;" onclick="toggleReviewSolution('mistake-sol-${m.question_id}')">
              🔍 View Official Solution Key
            </button>
            <button class="btn-cbt" style="${statusBtnColor} font-size:12px;" onclick="toggleMistakeMastery(${m.question_id}, '${isMastered ? 'NEEDS_PRACTICE' : 'MASTERED'}')">
              ${statusBtnText}
            </button>
          </div>
          <div id="mistake-sol-${m.question_id}" style="display:none; margin-top:12px; text-align:center;">
            <img src="${m.solution_img}" style="max-width:100%; border:1px solid #86efac; border-radius:6px; cursor:zoom-in;" onclick="openImageZoom('${m.solution_img}', 'Solution Q.${m.qnum}')" />
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load mistakes:', err);
  }
}

async function toggleMistakeMastery(questionId, newStatus) {
  try {
    await fetch(`${API_BASE}/mistakes/${questionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    loadMistakes();
  } catch (err) {
    console.error('Mastery update error:', err);
  }
}

// BOOKMARKS VIEW
function setBookmarksSectionFilter(sec, btn) {
  cbtState.bookmarksSection = sec;
  document.querySelectorAll('#view-bookmarks .subpage-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadBookmarks();
}

async function loadBookmarks() {
  const container = document.getElementById('bookmarks-container');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/bookmarks`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    let bookmarks = data.bookmarks;
    if (cbtState.bookmarksSection !== 'all') {
      bookmarks = bookmarks.filter(b => b.section === cbtState.bookmarksSection);
    }

    if (bookmarks.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:#fff; border-radius:10px; border:1px solid #e2e8f0;">
          <div style="font-size:40px; margin-bottom:10px;">⭐</div>
          <h3 style="font-size:17px; font-weight:700; color:#1e293b;">No bookmarked questions!</h3>
          <p style="font-size:13px; color:#64748b; margin-top:4px;">Click the "Bookmark" button during CBT tests to save tricky questions for high-yield revision.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = bookmarks.map(b => `
      <div class="review-card" style="margin-bottom:20px; border-left:5px solid #f59e0b;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-weight:700; color:#1e293b;">${b.test_title} &bull; Q.${b.qnum} &bull; ${b.section}</span>
          <span style="font-size:11px; background:#fef3c7; color:#b45309; font-weight:700; padding:2px 8px; border-radius:4px;">Bookmarked</span>
        </div>
        <div style="margin-bottom:12px; text-align:center;">
          <img src="${b.stem_img}" style="max-width:100%; border:1px solid #e2e8f0; border-radius:6px; cursor:zoom-in;" onclick="openImageZoom('${b.stem_img}', '${b.test_title} Q.${b.qnum}')" />
        </div>
        <div style="margin-bottom:12px;">
          <div style="display:flex; gap:8px;">
            <input type="text" id="bm-note-${b.question_id}" value="${b.user_note || ''}" placeholder="Add a revision note (e.g. Formula: area of sector)..." style="flex:1; padding:6px 10px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" />
            <button class="btn-cbt" style="background:#2563eb; color:#fff; font-size:11px; padding:6px 12px;" onclick="saveBookmarkNote(${b.question_id})">Save Note</button>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <button class="btn-cbt" style="background:#f1f5f9; color:#1e293b; border:1px solid #cbd5e1; font-size:12px;" onclick="toggleReviewSolution('bm-sol-${b.question_id}')">
            🔍 View Official Solution Key
          </button>
          <button class="btn-cbt" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; font-size:12px;" onclick="removeBookmark(${b.question_id}, ${b.set_id})">
            ✕ Remove Bookmark
          </button>
        </div>
        <div id="bm-sol-${b.question_id}" style="display:none; margin-top:12px; text-align:center;">
          <img src="${b.solution_img}" style="max-width:100%; border:1px solid #86efac; border-radius:6px; cursor:zoom-in;" onclick="openImageZoom('${b.solution_img}', 'Solution Q.${b.qnum}')" />
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load bookmarks:', err);
  }
}

async function saveBookmarkNote(questionId) {
  const input = document.getElementById(`bm-note-${questionId}`);
  const userNote = input ? input.value : '';

  try {
    const res = await fetch(`${API_BASE}/bookmarks/${questionId}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userNote })
    });
    const data = await res.json();
    if (data.success) {
      alert('Bookmark note saved!');
    }
  } catch (err) {
    console.error('Note save error:', err);
  }
}

async function removeBookmark(questionId, setId) {
  try {
    await fetch(`${API_BASE}/bookmarks/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, setId })
    });
    loadBookmarks();
  } catch (err) {
    console.error('Remove bookmark error:', err);
  }
}

// IMAGE LIGHTBOX / ZOOM
function openImageZoom(imgSrc, title = 'Enlarged View') {
  const modal = document.getElementById('image-zoom-modal');
  const modalImg = document.getElementById('zoom-modal-img');
  const titleEl = document.getElementById('zoom-modal-title');
  if (!modal || !modalImg) return;

  modalImg.src = imgSrc;
  if (titleEl) titleEl.textContent = title;
  modal.style.display = 'flex';
}

function closeImageZoom() {
  const modal = document.getElementById('image-zoom-modal');
  if (modal) modal.style.display = 'none';
}

function handleZoomBackdropClick(event) {
  if (event.target.id === 'image-zoom-modal') {
    closeImageZoom();
  }
}

// EVENT BINDINGS
function bindEvents() {
  // Option label clicks
  document.querySelectorAll('.opt-label').forEach(lbl => {
    lbl.addEventListener('click', (e) => {
      const opt = lbl.dataset.opt;
      if (opt) selectOption(opt);
    });
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // If a modal is open, Escape closes it
    if (e.key === 'Escape') {
      closeImageZoom();
      closeShiftSelector();
      closeSubmitConfirmation();
      return;
    }

    // Hotkeys active only in CBT Exam view
    if (cbtState.activeView !== 'cbt' || cbtState.isSubmitted) return;

    // Do not trigger hotkeys if user is typing in an input
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (['1', 'a', 'A'].includes(e.key)) selectOption('A');
    else if (['2', 'b', 'B'].includes(e.key)) selectOption('B');
    else if (['3', 'c', 'C'].includes(e.key)) selectOption('C');
    else if (['4', 'd', 'D'].includes(e.key)) selectOption('D');
    else if (e.key === 'Enter' || e.key === 'ArrowRight') saveAndNext();
    else if (e.key === 'ArrowLeft') previousQuestion();
    else if (['m', 'M', 'r', 'R'].includes(e.key)) markForReviewAndNext();
    else if (['c', 'C', 'Delete', 'Backspace'].includes(e.key)) clearResponse();
  });
}
