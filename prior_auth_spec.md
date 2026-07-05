# Prior Authorization Assistant - Implementation Specification

## Executive Summary
Build a deployable prior authorization assistant that demonstrates FDE-level thinking: tool-use agent design, human-in-loop workflow, observability, and eval harness. Target: 2-day build, Vercel deployment.

---

## Architecture Overview

```
Frontend (React) → Backend (Node.js/Express) → DeepSeek API
                ↓
             SQLite DB
```

**Deployment**: Vercel (frontend + serverless backend functions)

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React 18+ | Latest |
| Backend | Node.js Express | 4.x |
| LLM | DeepSeek API | deepseek-v4-pro |
| Database | SQLite | 3.x |
| HTTP Client | axios or fetch | Latest |
| Deployment | Vercel | Native support |

---

## Database Schema (SQLite)

### Table: `patients`
```sql
CREATE TABLE patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER,
    diagnosis TEXT NOT NULL,
    requested_procedure TEXT NOT NULL,
    clinical_notes TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `policies`
```sql
CREATE TABLE policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payer_name TEXT NOT NULL UNIQUE,
    policy_text TEXT NOT NULL,
    coverage_rules TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `prior_auth_cases`
```sql
CREATE TABLE prior_auth_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    payer_id INTEGER NOT NULL,
    agent_outcome TEXT, -- 'approved', 'denied', 'missing_info'
    drafted_letter TEXT,
    missing_documentation TEXT,
    agent_trace JSON,
    human_review_status TEXT, -- 'pending', 'approved', 'rejected'
    human_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (payer_id) REFERENCES policies(id)
);
```

### Table: `eval_results`
```sql
CREATE TABLE eval_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    expected_outcome TEXT, -- ground truth
    actual_outcome TEXT,
    is_correct INTEGER, -- 0 or 1
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES prior_auth_cases(id)
);
```

---

## Backend API Specification

### Base URL
`/api`

### Endpoints

#### 1. `GET /api/patients`
Returns all synthetic patient cases.
```json
Response:
[
  {
    "id": 1,
    "name": "John Doe",
    "age": 45,
    "diagnosis": "Chronic lower back pain",
    "requested_procedure": "MRI lumbar spine",
    "clinical_notes": "..."
  }
]
```

#### 2. `GET /api/policies`
Returns available payer policies.
```json
Response:
[
  {
    "id": 1,
    "payer_name": "BlueCross Insurance",
    "coverage_rules": "..."
  }
]
```

#### 3. `POST /api/analyze-case`
**Core endpoint.** Runs the prior auth agent on a patient case.

```json
Request:
{
  "patient_id": 1,
  "payer_id": 1
}

Response:
{
  "case_id": 101,
  "outcome": "approved" | "denied" | "missing_info",
  "drafted_letter": "string or null",
  "missing_documentation": ["criterion_1", "criterion_2"],
  "agent_trace": [
    {
      "step": 1,
      "tool": "lookup_policy",
      "input": {...},
      "output": {...}
    },
    {
      "step": 2,
      "tool": "check_documentation",
      "input": {...},
      "output": {...}
    }
  ],
  "reasoning": "Step-by-step explanation of agent decisions"
}
```

#### 4. `POST /api/submit-review`
Human reviewer submits approval/rejection.

```json
Request:
{
  "case_id": 101,
  "review_status": "approved" | "rejected",
  "human_notes": "string (optional)"
}

Response:
{
  "success": true,
  "message": "Review recorded"
}
```

#### 5. `GET /api/eval-results`
Returns eval harness results.
```json
Response:
{
  "total_cases": 15,
  "correct": 12,
  "accuracy": 0.8,
  "failures": [
    {
      "case_id": 5,
      "expected": "approved",
      "actual": "missing_info",
      "reason": "Agent flagged required doc that is actually optional"
    }
  ]
}
```

---

## DeepSeek Agent Implementation

### LLM Configuration
- **Model**: `deepseek-v4-pro`
- **API Base**: `https://api.deepseek.com/v1`
- **Temperature**: 0.3 (low, for consistency)
- **Max tokens**: 2000

### Tool Definitions (Function Calling Schema)

The agent has three tools, defined in OpenAI-compatible function calling format:

```json
{
  "type": "function",
  "function": {
    "name": "lookup_policy",
    "description": "Retrieves coverage rules for a specific procedure from the payer policy",
    "parameters": {
      "type": "object",
      "properties": {
        "procedure": {
          "type": "string",
          "description": "The requested medical procedure (e.g., 'MRI lumbar spine')"
        }
      },
      "required": ["procedure"]
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "check_documentation",
    "description": "Checks which required documentation criteria are met/missing based on clinical notes",
    "parameters": {
      "type": "object",
      "properties": {
        "clinical_notes": {
          "type": "string",
          "description": "Patient clinical notes"
        },
        "required_criteria": {
          "type": "array",
          "items": {"type": "string"},
          "description": "List of required documentation criteria from policy"
        }
      },
      "required": ["clinical_notes", "required_criteria"]
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "draft_request",
    "description": "Generates a prior authorization request letter",
    "parameters": {
      "type": "object",
      "properties": {
        "patient_name": {"type": "string"},
        "diagnosis": {"type": "string"},
        "procedure": {"type": "string"},
        "clinical_justification": {"type": "string"},
        "payer_name": {"type": "string"}
      },
      "required": ["patient_name", "diagnosis", "procedure", "clinical_justification", "payer_name"]
    }
  }
}
```

### Agent Loop Logic

```
1. System prompt establishes role: "You are a healthcare administrative assistant evaluating prior authorization requests."

2. User input: Patient case + payer policy

3. Agent reasoning:
   a. Call lookup_policy(requested_procedure) → returns payer's coverage rules & required docs
   b. Call check_documentation(clinical_notes, required_criteria) → returns met/missing
   c. IF all criteria met:
      - Call draft_request(...) → generates letter
      - Return outcome: "approved"
   ELSE:
      - Return outcome: "missing_info"
      - Include list of missing documentation

4. Store full agent_trace (every tool call + result) in DB

5. Return structured response to frontend
```

### System Prompt Template
```
You are a healthcare administrative assistant evaluating prior authorization requests for {payer_name}.

Your job is to:
1. Look up the coverage criteria for the requested procedure using the lookup_policy tool
2. Check if the patient's clinical notes contain sufficient documentation using the check_documentation tool
3. If all required documentation is present, draft a prior authorization letter using the draft_request tool
4. If documentation is missing, clearly state what is missing

Always call tools in order. Explain your reasoning. Be concise but thorough.
```

### Tool Implementation (Backend)

#### `lookup_policy(procedure)`
- Query the `policies` table
- Extract relevant sections from `coverage_rules` matching the procedure
- Return: required documentation list, coverage decision rules

#### `check_documentation(clinical_notes, required_criteria)`
- For each criterion, check if it's mentioned in clinical_notes (simple substring/keyword match is fine for v1)
- Return: object mapping each criterion to {met: true/false, evidence: "quote from notes"}

#### `draft_request(patient_name, diagnosis, procedure, clinical_justification, payer_name)`
- Return a formatted text block (letter format)
- Template:
```
[Date]

To: {payer_name} Prior Authorization Team

Re: Prior Authorization Request for {procedure}
Patient: {patient_name}
Diagnosis: {diagnosis}

Clinical Justification:
{clinical_justification}

Based on medical necessity, we request approval for the above procedure.

Respectfully submitted,
[Clinic Name]
```

---

## Frontend (React) Specification

### Pages/Components

#### 1. **Home/Dashboard**
- Display list of all patient cases (table)
- Columns: Patient Name, Diagnosis, Procedure, Status (pending/analyzed/reviewed)
- "Analyze Case" button per row
- Summary stats: total cases, cases analyzed, accuracy

#### 2. **Case Analysis Page**
- Shows selected patient details (read-only)
- "Run Analysis" button → triggers `/api/analyze-case`
- Loading state while agent runs
- Once complete, shows:
  - **Agent Outcome**: "Approved" / "Denied" / "Missing Information" (color-coded badge)
  - **Reasoning**: Step-by-step text explanation
  - **Agent Trace** (expandable): JSON-formatted list of all tool calls
    - Each step shows: Tool name → Input → Output
  - **Drafted Letter** (if approved): Formatted text block in a card
  - **Missing Documentation** (if missing_info): Bullet list
- **Human Review Section**:
  - Radio buttons: "Approve" / "Reject"
  - Text field: "Optional notes"
  - "Submit Review" button → calls `/api/submit-review`
  - Confirmation message on success

#### 3. **Eval Results Page**
- Calls `GET /api/eval-results`
- Shows:
  - **Accuracy Score**: Large number (e.g., "80% accuracy on 15 test cases")
  - **Breakdown by Outcome**: Table showing expected vs. actual for all cases
  - **Failure Analysis**: Expandable section listing cases where agent got it wrong + why

#### 4. **Synthetic Data Seed Page** (optional)
- Button: "Seed Database with Test Cases"
- Creates 15 synthetic patient cases + 1 payer policy on first load
- Useful for demo/reset

### UI/UX Guidelines
- **Color scheme**: Clinical/professional (blues, whites, subtle grays)
- **Layout**: Sidebar navigation (Home, Analyze, Eval Results, About)
- **Agent trace**: Collapsible JSON tree (use a library like `react-json-tree`)
- **Loading states**: Show spinner + "Agent is analyzing..." message (can be 5-30 seconds depending on DeepSeek latency)
- **Error handling**: Toast notifications for API failures

---

## Synthetic Data (Seed Dataset)

### 15 Test Cases: Create these hand-coded or with Claude

Example structure:
```json
[
  {
    "name": "Alice Johnson",
    "age": 52,
    "diagnosis": "Chronic lower back pain",
    "procedure": "MRI lumbar spine",
    "clinical_notes": "Patient reports 6 weeks of persistent lower back pain radiating to left leg. Conservative treatment with physical therapy and NSAIDs for 8 weeks without improvement. Imaging needed to rule out disc herniation or spinal stenosis."
  },
  {
    "name": "Bob Smith",
    "age": 67,
    "diagnosis": "Type 2 Diabetes",
    "procedure": "Continuous Glucose Monitor",
    "clinical_notes": "Patient on insulin therapy. Frequent hypoglycemic episodes (3+ per week) despite medication adjustments. CGM warranted for improved glucose control monitoring."
  }
  // ... 13 more cases
]
```

### 1 Payer Policy: Write one realistic policy document

Example:
```
BlueCross Insurance - Prior Authorization Policy

MRI Services (Lumbar Spine)

Coverage Criteria:
1. Diagnosis of chronic lower back pain or suspected lumbar pathology
2. Conservative treatment attempted for minimum 4 weeks (physical therapy and/or NSAIDs)
3. Failure of conservative therapy documented in clinical notes
4. Imaging medically necessary to guide treatment decisions

Required Documentation:
- Clinical notes documenting diagnosis
- Evidence of conservative treatment (dates, type of therapy)
- Justification for imaging based on clinical exam findings

Coverage Decision:
- APPROVE if all criteria met
- DENY if criteria not met
- REQUEST ADDITIONAL INFO if documentation incomplete
```

---

## Deployment (Vercel)

### File Structure
```
prior-auth-assistant/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── CaseAnalysis.jsx
│   │   │   ├── EvalResults.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   ├── package.json
│   ├── vercel.json (if needed)
├── backend/
│   ├── api/
│   │   ├── patients.js (serverless function)
│   │   ├── policies.js
│   │   ├── analyze-case.js
│   │   ├── submit-review.js
│   │   ├── eval-results.js
│   ├── db.js (SQLite setup/initialization)
│   ├── deepseek-agent.js (agent logic)
│   ├── package.json
├── prior_auth.db (SQLite file, committed to repo)
└── README.md
```

### Vercel Configuration
Create `vercel.json` in root:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "frontend/build",
  "env": {
    "DEEPSEEK_API_KEY": "@deepseek_api_key"
  },
  "functions": {
    "backend/api/**/*.js": {
      "memory": 512,
      "maxDuration": 30
    }
  }
}
```

### Environment Variables (set in Vercel dashboard)
- `DEEPSEEK_API_KEY`: Your DeepSeek API key
- `DATABASE_PATH`: Path to SQLite DB (or use in-memory for demo)

---

## Scope Boundaries (What NOT to Do)

### Out of Scope (Save for future versions)
- [ ] Multi-payer support (hardcode one payer)
- [ ] Real FHIR data ingestion (use synthetic cases)
- [ ] PDF parsing or OCR
- [ ] ICD-10/CPT code lookup service (hardcode examples)
- [ ] Real user authentication
- [ ] Advanced RAG or vector embeddings
- [ ] Audit logging beyond agent trace
- [ ] Mobile optimization
- [ ] Real prior authorization API integrations

### In Scope (Minimal Viable Demo)
- [x] Single-payer workflow
- [x] 15 synthetic test cases
- [x] Agent with 3 tools
- [x] Human-in-loop review
- [x] Agent trace logging
- [x] Eval harness with accuracy
- [x] Clean React UI
- [x] Vercel deployment

---

## Testing & Eval Harness

### Manual Eval (Day 2)
1. Before running agent: hand-label each of 15 cases with expected outcome (approve/deny/missing_info)
2. Run agent on all cases, store results
3. Compare expected vs. actual
4. Compute accuracy score
5. Analyze failures: Why did agent get it wrong? (e.g., "Missed that patient tried PT for 6 weeks, not 4" → improve tool or policy doc clarity)

### Automation (Optional)
Create a script `test/eval.js`:
```javascript
const cases = require('../data/test-cases.json');
const expectedOutcomes = require('../data/expected-outcomes.json');
const { analyzeCase } = require('../backend/deepseek-agent');

async function runEval() {
  let correct = 0;
  const failures = [];
  
  for (const testCase of cases) {
    const result = await analyzeCase(testCase.patientId, testCase.payerId);
    const expected = expectedOutcomes[testCase.id];
    
    if (result.outcome === expected) {
      correct++;
    } else {
      failures.push({
        caseId: testCase.id,
        expected,
        actual: result.outcome,
        reason: result.reasoning
      });
    }
  }
  
  console.log(`\nEval Results:\nAccuracy: ${correct}/${cases.length} (${(correct/cases.length*100).toFixed(1)}%)`);
  console.log('\nFailures:', failures);
}

runEval();
```

---

## README Structure

Include:
1. **What this does** (1-2 sentence summary)
2. **Architecture diagram** (ASCII or simple)
3. **Setup instructions** (git clone, npm install, set env var, npm start)
4. **How to use** (click case → run analysis → review → submit)
5. **Eval results** (Accuracy: 80%, Failure analysis)
6. **Future work** (multi-payer, real FHIR, RAG, etc.)
7. **Design decisions** (why SQLite, why DeepSeek, why single tool-loop, etc.)

---

## Interview Story

When asked about this project, emphasize:

1. **FDE mindset**: "I built this with deployment in mind — SQLite, Vercel serverless, observable agent traces so a non-technical stakeholder can audit the agent's reasoning."

2. **Tool use**: "The agent calls three tools (lookup policy, check docs, draft letter) in sequence, showing how you'd compose LLM capabilities with domain logic."

3. **Human-in-loop**: "The UI includes a review step before anything ships — this is crucial for healthcare because full autonomy isn't always appropriate."

4. **Eval discipline**: "I pre-labeled ground truth outcomes, measured accuracy on 15 cases, and analyzed the 3 failure modes — this is how you know if something actually works."

5. **Domain understanding**: "Prior auth is a $2B+ pain point in healthcare. Understanding why (incentive misalignment, regulation, volume) is what makes this agent useful, not just clever."

---

## Checkpoints (2-Day Timeline)

### Day 1 (Target: Agent + Backend API working)
- [ ] SQLite schema created, 15 synthetic cases seeded
- [ ] DeepSeek agent loop implemented + tested locally (PostMan/curl)
- [ ] Three tools functional: lookup_policy, check_documentation, draft_request
- [ ] Backend API endpoints stubbed (at least `/api/analyze-case`)
- [ ] Agent trace logging working

### Day 2 (Target: UI + Deploy)
- [ ] React frontend pages built (Home, CaseAnalysis, EvalResults)
- [ ] Frontend wired to backend API
- [ ] Human review flow functional
- [ ] Eval results page shows accuracy + failures
- [ ] Deploy to Vercel
- [ ] README + eval analysis written

---

## Success Criteria

- ✓ App runs end-to-end: select case → click "analyze" → see agent trace + outcome → human review
- ✓ Accuracy ≥ 70% on test cases (at least 10/15 correct)
- ✓ Agent trace is readable and explains every decision
- ✓ Deployed to live Vercel URL (shareable link)
- ✓ README documents architecture + design choices + eval results