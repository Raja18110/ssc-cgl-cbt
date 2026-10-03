-- Schema for SSC CGL Tier-1 CBT Full-Stack Platform
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS test_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    total_questions INTEGER DEFAULT 100,
    total_marks REAL DEFAULT 200.0,
    duration_minutes INTEGER DEFAULT 60,
    positive_marks REAL DEFAULT 2.0,
    negative_marking REAL DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL,
    qnum INTEGER NOT NULL,
    section TEXT NOT NULL,
    stem_img TEXT NOT NULL,
    solution_img TEXT NOT NULL,
    correct_option TEXT NOT NULL, -- 'A', 'B', 'C', 'D'
    FOREIGN KEY (set_id) REFERENCES test_sets(id) ON DELETE CASCADE,
    UNIQUE(set_id, qnum)
);

CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL,
    candidate_id TEXT DEFAULT 'Aspirant #CGL2025',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME,
    score REAL DEFAULT 0.0,
    correct_count INTEGER DEFAULT 0,
    wrong_count INTEGER DEFAULT 0,
    unattempted_count INTEGER DEFAULT 0,
    accuracy REAL DEFAULT 0.0,
    time_spent_seconds INTEGER DEFAULT 0,
    section_scores_json TEXT,
    FOREIGN KEY (set_id) REFERENCES test_sets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attempt_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    qnum INTEGER NOT NULL,
    selected_option TEXT,
    is_correct INTEGER DEFAULT 0,
    status TEXT DEFAULT 'not-visited',
    time_spent INTEGER DEFAULT 0,
    FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mistakes_notebook (
    question_id INTEGER PRIMARY KEY,
    set_id INTEGER NOT NULL,
    error_count INTEGER DEFAULT 1,
    last_attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mastery_status TEXT DEFAULT 'NEEDS_PRACTICE', -- 'NEEDS_PRACTICE' | 'REVISED' | 'MASTERED'
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (set_id) REFERENCES test_sets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookmarks (
    question_id INTEGER PRIMARY KEY,
    set_id INTEGER NOT NULL,
    user_note TEXT,
    tag TEXT DEFAULT 'Important',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (set_id) REFERENCES test_sets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS active_sessions (
    set_id INTEGER PRIMARY KEY,
    candidate_id TEXT DEFAULT 'Aspirant #CGL2025',
    current_q_index INTEGER DEFAULT 0,
    time_remaining INTEGER DEFAULT 3600,
    test_mode TEXT DEFAULT 'exam',
    responses_json TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (set_id) REFERENCES test_sets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questions_set ON questions(set_id);
CREATE INDEX IF NOT EXISTS idx_attempts_set ON attempts(set_id);
CREATE INDEX IF NOT EXISTS idx_attempt_responses ON attempt_responses(attempt_id);
