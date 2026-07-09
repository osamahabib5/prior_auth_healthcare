/**
 * Database layer — Postgres via Supabase (local + Vercel).
 * Requires DATABASE_URL environment variable.
 *
 * Interface (all query methods are async):
 *   const db = getDb();
 *   await db.all(sql, [params])      → rows[]
 *   await db.get(sql, [params])      → row | undefined
 *   await db.run(sql, [params])      → { changes, lastInsertRowid }
 *   await db.exec(sql)               → void
 *   await db.ensureSeeded()          → seeds if empty
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[db] FATAL: DATABASE_URL is not set. Set it to your Supabase pooler URL.');
}

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5
    });
  }
  return pool;
}

// Convert SQLite-style ? placeholders to Postgres $1, $2, ...
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

async function all(sql, params = []) {
  const { query, mappedParams } = convertPlaceholders(sql, params);
  const result = await getPool().query(query, mappedParams);
  return result.rows;
}

async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0];
}

async function run(sql, params = []) {
  let { query, mappedParams } = convertPlaceholders(sql, params);
  if (/^\s*INSERT\s/i.test(query) && !/RETURNING/i.test(query)) {
    query = query.replace(/;?\s*$/, ' RETURNING id');
  }
  const result = await getPool().query(query, mappedParams);
  return { changes: result.rowCount || 0, lastInsertRowid: result.rows?.[0]?.id || null };
}

async function exec(sql) {
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await getPool().query(stmt);
  }
}

// ── Schema ────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
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
`;

async function initSchema() {
  await exec(SCHEMA_SQL);
}

// ── Auto-seeding ──────────────────────────────────────────────────────

let seeded = false;

async function ensureSeeded() {
  if (seeded) return;
  await initSchema();

  const rows = await all('SELECT COUNT(*) as c FROM patients');
  const count = rows[0]?.c || 0;

  if (count === 0) {
    const { patients, policy } = require('./seed-data');
    await run(
      'INSERT INTO policies (payer_name, policy_text, coverage_rules) VALUES ($1, $2, $3)',
      [policy.payer_name, policy.policy_text, policy.coverage_rules]
    );
    for (const p of patients) {
      await run(
        'INSERT INTO patients (name, age, diagnosis, requested_procedure, clinical_notes) VALUES ($1, $2, $3, $4, $5)',
        [p.name, p.age, p.diagnosis, p.procedure, p.notes]
      );
    }
    await exec("SELECT setval('patients_id_seq', (SELECT MAX(id) FROM patients))");
    await exec("SELECT setval('policies_id_seq', (SELECT MAX(id) FROM policies))");
    console.log('[db] Auto-seeded database with', patients.length, 'patients + 1 policy');
  }

  seeded = true;
}

// ── Public API ────────────────────────────────────────────────────────

function getDb() {
  return { all, get, run, exec, ensureSeeded };
}

function closeDb() {
  if (pool) { pool.end(); pool = null; }
}

module.exports = { getDb, closeDb };
