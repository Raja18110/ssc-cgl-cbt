# SSC CGL Tier-1 Full-Stack CBT Mock Test Platform

A full-stack Computer-Based Test (CBT) examination and performance analytics platform designed for authentic SSC CGL Tier-1 preparation. Powered by official previous year questions (September 2025 – October 2025) extracted with zero answer leaks.

---

## 🚀 Quick Start & Running the Project

You can run the application with any of the following methods:

### Option 1: Double-Click Launcher (Recommended)
Double-click either:
- `Start_FullStack_App.bat`
- `Start_SSC_Test_Series.bat`

This will automatically launch the Node.js backend server and open `http://localhost:8085` in your default browser.

### Option 2: Command Line (Node.js)
```bash
npm start
```
or
```bash
node backend/server.js
```

### Option 3: Python Launcher
```bash
python server.py
```
*(Automatically bootstraps the backend and opens the browser).*

---

## 🎯 Platform Features

1. **Authentic TCS iON CBT Interface**:
   - Strict 60-minute countdown timer with color alerts at 15m and 5m.
   - Section tabs: *General Intelligence & Reasoning* (Q1-25), *General Awareness* (Q26-50), *Quantitative Aptitude* (Q51-75), and *English Comprehension* (Q76-100).
   - 100-Question interactive palette with standard TCS color coding (*Answered*, *Not Answered*, *Not Visited*, *Marked for Review*, *Answered & Marked for Review*).
   - Option selection (+2.0 positive, -0.5 negative marking).

2. **Exam & Practice Modes**:
   - **Exam Simulation Mode**: Real examination conditions, auto-save every 15 seconds, session recovery, strict timer.
   - **Practice / Tutor Mode**: Instant answer check and explanation cards on demand.

3. **High-Resolution Card Lightbox / Zoom**:
   - Click on any question card or solution card to view an enlarged, high-resolution lightbox view.

4. **Speed Keyboard Shortcuts**:
   - `1` - `4` or `A` - `D`: Select Option
   - `Enter` or `→`: Save & Next
   - `←`: Previous Question
   - `M` or `R`: Mark for Review & Next
   - `C` or `Delete` / `Backspace`: Clear Response
   - `Esc`: Close any open modal or image zoom

5. **Performance Intelligence & Analytics Command Center**:
   - Total tests taken, average score, highest score, overall accuracy.
   - Sectional mastery breakdown across all 4 subjects with accuracy bars and score contributions.
   - Recent test attempts history table with one-click access to review past scorecards.
   - Live search and filter pills across all 38 shift test papers.

6. **📕 Mistakes & Revision Notebook**:
   - Automatically catalogs every question answered incorrectly across all mock tests.
   - Filter by subject and mastery status (*Needs Practice* vs *Mastered*).
   - Track mistake repetition counts and master tricky concepts.

7. **⭐ Bookmarks Hub**:
   - Bookmark difficult questions during the test or directly from the review scorecard.
   - Attach personal revision notes and tags to any bookmarked question.

8. **Persistent SQLite Database**:
   - Fully backed by SQLite (`backend/db/cbt_platform.sqlite`) with schema migrations and seed scripts.
