const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

async function seedDatabase() {
  console.log('Seeding SQLite database from extracted shifts...');
  
  // Wait a short moment for schema initialization
  await new Promise(r => setTimeout(r, 500));

  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('ssc_cgl_') && f.endsWith('.json'));
  console.log(`Found ${files.length} shift JSON files to seed.`);

  let totalSets = 0;
  let totalQuestions = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!data.questions || data.questions.length === 0) continue;

      // Insert or replace test_set
      const setRes = await db.runAsync(`
        INSERT INTO test_sets (shift_id, title, total_questions, total_marks, duration_minutes, positive_marks, negative_marking)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(shift_id) DO UPDATE SET
          title = excluded.title,
          total_questions = excluded.total_questions,
          total_marks = excluded.total_marks
      `, [
        data.shift_id,
        data.title,
        data.total_questions || data.questions.length,
        data.total_marks || 200,
        data.duration_minutes || 60,
        data.marks_per_question || 2.0,
        data.negative_marks || 0.5
      ]);

      const setId = setRes.lastID || (await db.getAsync(`SELECT id FROM test_sets WHERE shift_id = ?`, [data.shift_id])).id;
      totalSets++;

      // Insert questions
      for (const q of data.questions) {
        await db.runAsync(`
          INSERT INTO questions (set_id, qnum, section, stem_img, solution_img, correct_option)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(set_id, qnum) DO UPDATE SET
            section = excluded.section,
            stem_img = excluded.stem_img,
            solution_img = excluded.solution_img,
            correct_option = excluded.correct_option
        `, [
          setId,
          q.id,
          q.section,
          q.stem_img,
          q.solution_img,
          q.correct
        ]);
        totalQuestions++;
      }

      console.log(`✓ Seeded ${data.title} (${data.questions.length} questions)`);
    } catch (err) {
      console.error(`Error seeding ${file}:`, err);
    }
  }

  console.log(`\n🎉 SEED COMPLETE! Inserted ${totalSets} test sets and ${totalQuestions} questions into SQLite.`);
  process.exit(0);
}

seedDatabase();
