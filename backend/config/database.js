const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'db', 'cbt_platform.sqlite');
const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
    initSchema();
  }
});

function initSchema() {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schemaSql, (err) => {
    if (err) {
      console.error('Error initializing database schema:', err);
    } else {
      console.log('Database schema successfully initialized.');
    }
  });
}

// Promisified helpers for clean async/await
db.getAsync = function(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

db.allAsync = function(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

db.runAsync = function(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

module.exports = db;
