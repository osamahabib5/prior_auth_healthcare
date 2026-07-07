const Database = require('better-sqlite3');
const path = require('path');

// On Vercel, use /tmp/ (the only writable directory).
// Locally, use the project root.
const DB_PATH = process.env.DATABASE_PATH ||
  (process.env.VERCEL ? '/tmp/prior_auth.db' : path.join(__dirname, '..', 'prior_auth.db'));

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    autoSeed();
  }
  return db;
}

function autoSeed() {
  // Seed the database if it's empty (needed on Vercel where the .db file isn't deployed)
  const count = db.prepare('SELECT COUNT(*) as c FROM patients').get();
  if (count.c === 0) {
    const { patients, policy } = require('./seed-data');
    const insertPatient = db.prepare(
      'INSERT INTO patients (name, age, diagnosis, requested_procedure, clinical_notes) VALUES (?, ?, ?, ?, ?)'
    );
    const insertPolicy = db.prepare(
      'INSERT INTO policies (payer_name, policy_text, coverage_rules) VALUES (?, ?, ?)'
    );
    const seedAll = db.transaction(() => {
      insertPolicy.run(policy.payer_name, policy.policy_text, policy.coverage_rules);
      for (const p of patients) {
        insertPatient.run(p.name, p.age, p.diagnosis, p.procedure, p.notes);
      }
    });
    seedAll();
    console.log('[db] Auto-seeded database with', patients.length, 'patients + 1 policy');
  }
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
