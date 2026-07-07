const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isVercel = !!process.env.VERCEL;

// On Vercel, the filesystem is read-only except /tmp/.
// We copy the seeded DB to /tmp/ so it can be opened for reads.
// (Writes won't persist across invocations — this is a known serverless limitation.)
let DB_PATH;
if (process.env.DATABASE_PATH) {
  DB_PATH = process.env.DATABASE_PATH;
} else if (isVercel) {
  DB_PATH = '/tmp/prior_auth.db';
  // Copy the pre-seeded database from the deployment bundle to /tmp/
  const sourcePath = path.join(__dirname, '..', 'prior_auth.db');
  if (!fs.existsSync(DB_PATH) && fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, DB_PATH);
  }
} else {
  DB_PATH = path.join(__dirname, '..', 'prior_auth.db');
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER,
      diagnosis TEXT NOT NULL,
      requested_procedure TEXT NOT NULL,
      clinical_notes TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payer_name TEXT NOT NULL UNIQUE,
      policy_text TEXT NOT NULL,
      coverage_rules TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prior_auth_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      payer_id INTEGER NOT NULL,
      agent_outcome TEXT,
      drafted_letter TEXT,
      missing_documentation TEXT,
      agent_trace TEXT,
      human_review_status TEXT DEFAULT 'pending',
      human_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (payer_id) REFERENCES policies(id)
    );

    CREATE TABLE IF NOT EXISTS eval_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      expected_outcome TEXT,
      actual_outcome TEXT,
      is_correct INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES prior_auth_cases(id)
    );
  `);
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb, DB_PATH };
