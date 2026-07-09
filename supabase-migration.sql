-- Supabase Migration: Prior Authorization Assistant
-- Paste this into your Supabase SQL Editor (https://app.supabase.com)
-- Go to: SQL Editor → New Query → Paste → Run

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  diagnosis TEXT NOT NULL,
  requested_procedure TEXT NOT NULL,
  clinical_notes TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Policies table
CREATE TABLE IF NOT EXISTS policies (
  id SERIAL PRIMARY KEY,
  payer_name TEXT NOT NULL UNIQUE,
  policy_text TEXT NOT NULL,
  coverage_rules TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prior auth cases table
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

-- Eval results table
CREATE TABLE IF NOT EXISTS eval_results (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES prior_auth_cases(id),
  expected_outcome TEXT,
  actual_outcome TEXT,
  is_correct INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (optional, for future use)
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
