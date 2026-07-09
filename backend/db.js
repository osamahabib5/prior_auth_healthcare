/**
 * Unified database layer — auto-switches between Postgres (Supabase/Vercel)
 * and SQLite (local dev) based on the DATABASE_URL environment variable.
 *
 * Interface (all query methods are async):
 *   const db = getDb();
 *   await db.all(sql, [params])      → rows[]
 *   await db.get(sql, [params])      → row | undefined
 *   await db.run(sql, [params])      → { changes, lastInsertRowid }
 *   await db.exec(sql)               → void
 *   await db.ensureSeeded()          → seeds if empty
 */

const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || '';
const isPostgres = !!DATABASE_URL;

// ── Postgres backend ──────────────────────────────────────────────────

let pgPool = null;

function getPgPool() {
  if (!pgPool) {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5
    });
  }
  return pgPool;
}

async function pgAll(sql, params = []) {
  const pool = getPgPool();
  const { query, mappedParams } = convertPlaceholders(sql, params);
  const result = await pool.query(query, mappedParams);
  return result.rows;
}

async function pgGet(sql, params = []) {
  const rows = await pgAll(sql, params);
  return rows[0];
}

async function pgRun(sql, params = []) {
  const pool = getPgPool();
  const { query, mappedParams } = convertPlaceholders(sql, params);
  const result = await pool.query(query, mappedParams);
  return {
    changes: result.rowCount || 0,
    lastInsertRowid: result.rows?.[0]?.id || null
  };
}

async function pgExec(sql) {
  const pool = getPgPool();
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
}

function convertPlaceholders(sql, params) {
  let index = 0;
  const mappedParams = [];
  const query = sql.replace(/\?/g, () => {
    index++;
    mappedParams.push(params[index - 1]);
    return '$' + index;
  });
  return { query, mappedParams };
}

// ── SQLite backend ────────────────────────────────────────────────────

const DB_PATH = process.env.DATABASE_PATH ||
  (process.env.VERCEL ? '/tmp/prior_auth.db' : path.join(__dirname, '..', 'prior_auth.db'));

let sqliteDb = null;

function getSqliteDb() {
  if (!sqliteDb) {
    const Database = require('better-sqlite3');
    sqliteDb = new Database(DB_PATH);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
  }
  return sqliteDb;
}

async function sqliteAll(sql, params = []) {
  const db = getSqliteDb();
  return db.prepare(sql).all(...params);
}

async function sqliteGet(sql, params = []) {
  const db = getSqliteDb();
  return db.prepare(sql).get(...params);
}

async function sqliteRun(sql, params = []) {
  const db = getSqliteDb();
  const result = db.prepare(sql).run(...params);
  return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
}

async function sqliteExec(sql) {
  const db = getSqliteDb();
  db.exec(sql);
}

// ── Schema ────────────────────────────────────────────────────────────

const SCHEMA_SQL = isPostgres ? `
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  diagnosis TEXT NOT NULL,
  requested_procedure TEXT NOT NULL,
  clinical_notes TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS policies (
  id SERIAL PRIMARY KEY,
  payer_name TEXT NOT NULL UNIQUE,
  policy_text TEXT NOT NULL,
  coverage_rules TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prior_auth_cases (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  payer_id INTEGER NOT NULL REFERENCES policies(id),
  agent_outcome TEXT,
  drafted_letter TEXT,
  missing_documentation TEXT,
  agent_trace TEXT,
  human_review_status TEXT DEFAULT 'pending',
  human_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS eval_results (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES prior_auth_cases(id),
  expected_outcome TEXT,
  actual_outcome TEXT,
  is_correct INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
` : `
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
`;

async function initSchema() {
  if (isPostgres) {
    await pgExec(SCHEMA_SQL);
  } else {
    getSqliteDb().exec(SCHEMA_SQL);
  }
}

// ── Auto-seeding ──────────────────────────────────────────────────────

let seeded = false;

async function ensureSeeded() {
  if (seeded) return;
  await initSchema();

  const checkSql = 'SELECT COUNT(*) as c FROM patients';
  const rows = isPostgres ? await pgAll(checkSql) : [getSqliteDb().prepare(checkSql).get()];
  const count = rows[0]?.c || 0;

  if (count === 0) {
    const { patients, policy } = require('./seed-data');

    if (isPostgres) {
      await pgRun(
        'INSERT INTO policies (payer_name, policy_text, coverage_rules) VALUES ($1, $2, $3)',
        [policy.payer_name, policy.policy_text, policy.coverage_rules]
      );
      for (const p of patients) {
        await pgRun(
          'INSERT INTO patients (name, age, diagnosis, requested_procedure, clinical_notes) VALUES ($1, $2, $3, $4, $5)',
          [p.name, p.age, p.diagnosis, p.procedure, p.notes]
        );
      }
      // Reset the sequence after manual ID inserts
      await pgExec("SELECT setval('patients_id_seq', (SELECT MAX(id) FROM patients))");
      await pgExec("SELECT setval('policies_id_seq', (SELECT MAX(id) FROM policies))");
    } else {
      const sdb = getSqliteDb();
      const insertPolicy = sdb.prepare(
        'INSERT INTO policies (payer_name, policy_text, coverage_rules) VALUES (?, ?, ?)'
      );
      const insertPatient = sdb.prepare(
        'INSERT INTO patients (name, age, diagnosis, requested_procedure, clinical_notes) VALUES (?, ?, ?, ?, ?)'
      );
      sdb.transaction(() => {
        insertPolicy.run(policy.payer_name, policy.policy_text, policy.coverage_rules);
        for (const p of patients) {
          insertPatient.run(p.name, p.age, p.diagnosis, p.procedure, p.notes);
        }
      })();
    }
    console.log('[db] Auto-seeded database with', patients.length, 'patients + 1 policy');
  }

  seeded = true;
}

// ── Public API ────────────────────────────────────────────────────────

function getDb() {
  return {
    all: isPostgres ? pgAll : sqliteAll,
    get: isPostgres ? pgGet : sqliteGet,
    run: isPostgres ? pgRun : sqliteRun,
    exec: isPostgres ? pgExec : sqliteExec,
    ensureSeeded,
    isPostgres
  };
}

function closeDb() {
  if (pgPool) { pgPool.end(); pgPool = null; }
  if (sqliteDb) { sqliteDb.close(); sqliteDb = null; }
}

module.exports = { getDb, closeDb, DB_PATH };
