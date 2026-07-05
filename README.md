# Prior Authorization Assistant

An AI-powered prior authorization workflow assistant that demonstrates tool-use agent design, human-in-the-loop review, and evaluation harness — all deployable to Vercel.

## What This Does

This application automates the evaluation of prior authorization requests in healthcare. Given a patient case and a payer's coverage policy, an AI agent (powered by DeepSeek) uses three tools to:

1. **Look up** coverage criteria for the requested procedure
2. **Check** whether clinical documentation meets each criterion
3. **Draft** a prior authorization request letter when all criteria are met

A human reviewer can then approve or reject the agent's decision via the UI.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Vercel                              │
│                                                          │
│  ┌─────────────┐     ┌──────────────────┐               │
│  │   React     │────▶│  Express API     │──▶ DeepSeek   │
│  │  Frontend   │◀────│  (Serverless)    │◀──  API       │
│  └─────────────┘     └────────┬─────────┘               │
│                               │                          │
│                        ┌──────▼──────┐                   │
│                        │   SQLite    │                   │
│                        │  Database   │                   │
│                        └─────────────┘                   │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer       | Technology          |
|-------------|---------------------|
| Frontend    | React 18            |
| Backend     | Node.js / Express 4 |
| LLM         | DeepSeek API (deepseek-chat) |
| Database    | SQLite (better-sqlite3) |
| Deployment  | Vercel              |

## Project Structure

```
prior-auth-assistant/
├── backend/
│   ├── api/                  # Serverless API functions
│   │   ├── patients.js       # GET /api/patients
│   │   ├── policies.js       # GET /api/policies
│   │   ├── analyze-case.js   # POST /api/analyze-case
│   │   ├── submit-review.js  # POST /api/submit-review
│   │   └── eval-results.js   # GET /api/eval-results
│   ├── db.js                 # SQLite setup & schema
│   ├── seed.js               # 15 synthetic cases + 1 policy
│   ├── deepseek-agent.js     # Agent loop + 3 tools
│   ├── server.js             # Local dev server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx       # Dashboard with case list
│   │   │   ├── CaseAnalysis.jsx # Agent analysis + review
│   │   │   └── EvalResults.jsx  # Accuracy & failure analysis
│   │   ├── App.jsx            # Router + sidebar nav
│   │   ├── index.js
│   │   └── index.css          # Full application styles
│   ├── public/
│   └── package.json
├── vercel.json                # Vercel deployment config
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- A DeepSeek API key ([platform.deepseek.com](https://platform.deepseek.com))

### Local Development

```bash
# 1. Clone and enter the project
cd prior-auth-assistant

# 2. Install backend dependencies
cd backend && npm install

# 3. Seed the database with synthetic data
node seed.js

# 4. Set your DeepSeek API key (Windows PowerShell)
$env:DEEPSEEK_API_KEY="sk-your-key-here"
# (Linux/macOS)
export DEEPSEEK_API_KEY="sk-your-key-here"

# 5. Start the backend server
node server.js
# → Runs on http://localhost:3001

# 6. In another terminal, start the frontend
cd frontend && npm install && npm start
# → Runs on http://localhost:3000
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variable in Vercel dashboard:
# DEEPSEEK_API_KEY = your-api-key
```

## API Endpoints

| Method | Endpoint              | Description                          |
|--------|-----------------------|--------------------------------------|
| GET    | `/api/patients`       | List all patient cases               |
| GET    | `/api/policies`       | List payer policies                  |
| POST   | `/api/analyze-case`   | Run the AI agent on a case           |
| POST   | `/api/submit-review`  | Submit human review decision         |
| GET    | `/api/eval-results`   | Get evaluation accuracy & failures   |

### Example: Analyze Case

```bash
curl -X POST http://localhost:3001/api/analyze-case \
  -H "Content-Type: application/json" \
  -d '{"patient_id": 1, "payer_id": 1}'
```

Response:
```json
{
  "case_id": 1,
  "outcome": "approved",
  "drafted_letter": "[July 3, 2026]\n\nTo: BlueCross Insurance...",
  "missing_documentation": [],
  "agent_trace": [
    {
      "step": 1,
      "tool": "lookup_policy",
      "input": {"procedure": "MRI lumbar spine"},
      "output": {"criteria": [...], "required_documentation": [...]}
    }
  ],
  "reasoning": "All required documentation criteria are met..."
}
```

## Agent Tools

The agent has three tools, defined in OpenAI-compatible function calling format:

1. **`lookup_policy`** — Retrieves coverage rules for a procedure from the payer's policy
2. **`check_documentation`** — Checks which required clinical documentation criteria are met
3. **`draft_request`** — Generates a formatted prior authorization request letter

## Test Dataset

- **15 synthetic patient cases** covering diverse procedures (MRI, CGM, CPAP, surgeries, medications, etc.)
- **1 payer policy** (BlueCross Insurance) with coverage rules for all 15 procedures
- **Ground truth labels**: Pre-labeled expected outcomes for eval harness

## Eval Results

**Local fallback accuracy: 93% (14/15 correct)**

| Case | Patient | Procedure | Expected | Actual | Correct |
|------|---------|-----------|----------|--------|---------|
| 1 | Alice Johnson | MRI lumbar spine | approved | approved | ✓ |
| 2 | Bob Smith | CGM | approved | approved | ✓ |
| 3 | Carol Davis | MRI knee | missing_info | approved | ✗* |
| 4 | David Martinez | CPAP | approved | approved | ✓ |
| 5 | Eva Thompson | Botox | approved | approved | ✓ |
| 6 | Frank Wilson | Stress echo | approved | approved | ✓ |
| 7 | Grace Lee | Humira | approved | approved | ✓ |
| 8 | Henry Brown | Cataract surgery | approved | approved | ✓ |
| 9 | Iris Kim | ACL reconstruction | approved | approved | ✓ |
| 10 | Jack Rodriguez | Epidural injection | approved | approved | ✓ |
| 11 | Karen White | Knee arthroplasty | missing_info | missing_info | ✓ |
| 12 | Larry Green | TMS | approved | approved | ✓ |
| 13 | Maria Sanchez | UFE | approved | approved | ✓ |
| 14 | Nathan Patel | FESS | approved | approved | ✓ |
| 15 | Olivia Taylor | Laparoscopy | approved | approved | ✓ |

*\*Carol Davis: Ground truth expected "missing_info" due to only 2 weeks of conservative treatment, but the policy states "minimum 2 weeks" — the agent correctly applied the policy. This represents a ground-truth labeling issue the eval harness successfully identified.*

With the DeepSeek LLM (API key configured), accuracy is expected to remain ≥90% with more nuanced clinical reasoning.

### Why SQLite?
- Zero-configuration, file-based — works naturally with Vercel serverless
- No separate database server needed
- `better-sqlite3` is synchronous and fast; sufficient for demo scale
- For production, would migrate to PostgreSQL with connection pooling

### Why DeepSeek?
- Cost-effective compared to GPT-4 for structured tool-use tasks
- OpenAI-compatible API makes swapping models trivial
- Sufficient reasoning capability for rule-based prior auth evaluation
- The agent includes a **local fallback** that works without an API key

### Why Single Tool-Loop?
- Prior auth is a deterministic, rule-based workflow (lookup → check → decide)
- A fixed sequence of tool calls matches the actual business process
- Simpler to debug, audit, and evaluate than open-ended agent behavior

### Why Human-in-the-Loop?
- Healthcare decisions require human oversight
- The UI includes explicit approve/reject for every agent decision
- Demonstrates responsible AI deployment patterns

## Future Work

- [ ] Multi-payer support with policy comparison
- [ ] Real FHIR data ingestion from EHR systems
- [ ] PDF parsing for clinical notes and policy documents
- [ ] ICD-10 / CPT code lookup integration
- [ ] User authentication and role-based access
- [ ] RAG-enhanced policy search with vector embeddings
- [ ] Comprehensive audit logging
- [ ] Mobile-responsive design
- [ ] Production database (PostgreSQL)

## License

MIT
