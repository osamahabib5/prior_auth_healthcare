# Prior Authorization Assistant — Technical Documentation

This document covers the technical architecture, database schema, API specifications, agent design, LLM provider abstraction, and deployment configuration. For a non-technical overview, see [README.md](README.md).

---

## Architecture

```
Frontend (React 18)  →  Backend (Express API)  →  LLM Provider
                                               →  SQLite Database
```

- **Frontend**: React 18 single-page application with React Router
- **Backend**: Node.js Express server; also deployable as Vercel serverless functions via `api/`
- **LLM**: Multi-provider abstraction layer supporting DeepSeek, OpenAI, Anthropic Claude, and Groq
- **Database**: SQLite via `better-sqlite3` (single file, zero-config)

---

## Project Structure

```
prior-auth-assistant/
├── api/                          # Vercel serverless function entry points
│   ├── patients.js               # GET  /api/patients
│   ├── policies.js               # GET  /api/policies
│   ├── analyze-case.js           # POST /api/analyze-case
│   ├── submit-review.js          # POST /api/submit-review
│   └── eval-results.js           # GET  /api/eval-results
├── backend/
│   ├── api/                      # Express route handlers (local dev)
│   │   ├── patients.js
│   │   ├── policies.js
│   │   ├── analyze-case.js
│   │   ├── submit-review.js
│   │   └── eval-results.js
│   ├── db.js                     # SQLite connection + schema initialization
│   ├── seed.js                   # 15 synthetic patients + 1 payer policy
│   ├── deepseek-agent.js         # Agent loop + 3 tools + local fallback
│   ├── llm-provider.js           # Multi-LLM abstraction layer
│   ├── server.js                 # Express dev server (port 3001)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── CaseAnalysis.jsx
│   │   │   └── EvalResults.jsx
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── index.css
│   ├── public/index.html
│   └── package.json
├── .env                          # LLM_PROVIDER + API keys (not committed)
├── vercel.json                   # Vercel deployment config
├── prior_auth.db                 # SQLite database (committed, read-only on Vercel)
├── README.md                     # End-user documentation
└── documentation.md              # This file
```

---

## Database Schema

### Table: patients

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment ID |
| name | TEXT | Patient full name |
| age | INTEGER | Patient age |
| diagnosis | TEXT | Primary diagnosis |
| requested_procedure | TEXT | Procedure being requested |
| clinical_notes | TEXT | Full clinical notes |
| created_at | DATETIME | Timestamp |

### Table: policies

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment ID |
| payer_name | TEXT UNIQUE | Insurance company name |
| policy_text | TEXT | Full policy document text |
| coverage_rules | TEXT | JSON object: procedure → criteria, required docs, decision rules |
| created_at | DATETIME | Timestamp |

### Table: prior_auth_cases

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment ID |
| patient_id | INTEGER FK | References patients(id) |
| payer_id | INTEGER FK | References policies(id) |
| agent_outcome | TEXT | approved, denied, or missing_info |
| drafted_letter | TEXT | Generated PA letter (if approved) |
| missing_documentation | TEXT | JSON array of missing criteria |
| agent_trace | TEXT | JSON array of tool call steps |
| human_review_status | TEXT | pending, approved, rejected |
| human_notes | TEXT | Reviewer notes |
| created_at | DATETIME | Timestamp |

### Table: eval_results

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment ID |
| case_id | INTEGER FK | References prior_auth_cases(id) |
| expected_outcome | TEXT | Ground truth label |
| actual_outcome | TEXT | Agent's decision |
| is_correct | INTEGER | 0 or 1 |
| created_at | DATETIME | Timestamp |

---

## API Reference

All endpoints are prefixed with `/api`.

### GET /api/patients

Returns all patient cases with their latest analysis status.

**Response**: Array of patient objects, each with `id`, `name`, `age`, `diagnosis`, `requested_procedure`, `clinical_notes`, `latest_outcome`, `review_status`, `latest_case_id`.

### GET /api/policies

Returns all payer policies.

**Response**: Array of policy objects, each with `id`, `payer_name`, `policy_text`, `coverage_rules`.

### POST /api/analyze-case

Runs the AI agent on a patient case.

**Request body**:
```json
{ "patient_id": 1, "payer_id": 1 }
```

**Response**:
```json
{
  "case_id": 101,
  "outcome": "approved",
  "drafted_letter": "string or null",
  "missing_documentation": ["criterion_1"],
  "agent_trace": [{ "step": 1, "tool": "lookup_policy", "input": {}, "output": {} }],
  "reasoning": "Step-by-step explanation"
}
```

### POST /api/submit-review

Records a human reviewer's decision.

**Request body**:
```json
{ "case_id": 101, "review_status": "approved", "human_notes": "optional" }
```

**Response**: `{ "success": true, "message": "Review recorded" }`

### GET /api/eval-results

Returns evaluation harness results.

**Response**:
```json
{
  "total_cases": 15, "correct": 14, "accuracy": 0.93,
  "failures": [{ "case_id": 5, "expected": "approved", "actual": "missing_info" }],
  "breakdown": [{ "case_id": 1, "expected": "approved", "actual": "approved", "correct": true }]
}
```

---

## Agent Design

### Tool Definitions

The agent has three tools, defined in OpenAI-compatible function calling format:

#### 1. lookup_policy
Retrieves coverage rules for a procedure from the payer's policy.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| procedure | string | Yes | e.g. "MRI lumbar spine" |

#### 2. check_documentation
Checks which required documentation criteria are met in clinical notes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| clinical_notes | string | Yes | Patient clinical notes |
| required_criteria | string[] | Yes | List of criteria from policy |

#### 3. draft_request
Generates a formatted prior authorization request letter.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| patient_name | string | Yes | Patient name |
| diagnosis | string | Yes | Diagnosis |
| procedure | string | Yes | Requested procedure |
| clinical_justification | string | Yes | Clinical justification text |
| payer_name | string | Yes | Insurance company name |

### Agent Loop

```
1. System prompt establishes role
2. User message provides patient case + payer info
3. Loop (max 10 iterations):
   a. Send messages + tools to LLM provider
   b. If LLM returns tool_calls:
      - Execute each tool locally
      - Record in agent_trace
      - Add tool results to message history
      - Continue loop
   c. If LLM returns content (no tool calls):
      - Extract structured JSON from response
      - Return {outcome, reasoning, missing_documentation, drafted_letter, agent_trace}
4. Fallback: If LLM unavailable, run local deterministic analysis
```

### Local Fallback

When no API key is configured or the LLM call fails, the agent uses a deterministic keyword-based document checker. It achieved **93% accuracy (14/15)** on the test dataset. The local fallback uses domain-specific medical-term matching with overrides for conditional requirements, safety assessments, and meta-documentation criteria.

---

## LLM Provider Abstraction Layer

File: `backend/llm-provider.js`

### Supported Providers

| Provider | LLM_PROVIDER value | Model used | API format | Tool-calling support |
|----------|-------------------|------------|------------|---------------------|
| DeepSeek | deepseek | deepseek-chat | OpenAI-compatible | Native |
| OpenAI | openai | gpt-4o | OpenAI (native) | Native |
| Groq | groq | llama-3.1-70b-versatile | OpenAI-compatible | Native |
| Anthropic Claude | claude | claude-3-5-sonnet-20241022 | Anthropic (custom) | Converted |

### How it works

`createProvider()` reads `LLM_PROVIDER` from the environment and returns a normalized provider object. All providers expose the same interface:

```javascript
const provider = createProvider();
const response = await provider.chatCompletion(messages, tools, options);
// response.message = { role, content, tool_calls: [...] }
```

#### OpenAI-compatible providers (DeepSeek, OpenAI, Groq)
These use the standard `/chat/completions` endpoint with `Authorization: Bearer` headers. Tool definitions and responses follow the OpenAI format natively.

#### Anthropic Claude
Claude uses a fundamentally different API:
- **System prompt**: Goes in a top-level `system` parameter, not in the messages array
- **Tool format**: `{name, description, input_schema}` instead of `{type: "function", function: {name, description, parameters}}`
- **Tool responses**: Returned as `content[]` blocks with `type: "tool_use"` instead of a `tool_calls[]` array
- **Auth**: Uses `x-api-key` header (not `Authorization: Bearer`)
- **Version header**: Requires `anthropic-version: 2023-06-01`

The abstraction layer handles all of these conversions transparently:
- Strips system messages from the messages array and moves them to the `system` parameter
- Converts OpenAI-format tools to Anthropic's `input_schema` format
- Converts Anthropic's `tool_use` content blocks back to OpenAI-compatible `tool_calls`
- Routes tool result messages (`role: "tool"`) to Anthropic's `tool_result` user content blocks

### Adding a new provider

1. Add an entry to the `PROVIDERS` object in `llm-provider.js`:
```javascript
newprovider: {
  name: 'NewProvider',
  model: 'model-name',
  baseURL: 'https://api.newprovider.com/v1',
  apiKeyEnv: 'NEWPROVIDER_API_KEY',
  authHeader: (key) => `Bearer ${key}`,
  format: 'openai',  // or 'anthropic' if custom format needed
  defaultTemperature: 0.3,
  defaultMaxTokens: 2000
}
```
2. If the API format is OpenAI-compatible, no further code changes are needed.
3. If the format is custom, add a handler function following the Anthropic pattern — convert messages/tools to the provider's format, call their API, then convert the response back.
4. Add the provider name to the `.env` template and documentation.

---

## Deployment Configuration

### Vercel (vercel.json)

```json
{
  "buildCommand": "cd frontend && npm install && npm run build && cd ../backend && npm install",
  "outputDirectory": "frontend/build",
  "functions": { "api/**/*.js": { "memory": 512, "maxDuration": 30 } },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/frontend/build/$1" },
    { "source": "/", "destination": "/frontend/build/index.html" }
  ]
}
```

**Important caveat**: Vercel serverless functions are stateless. SQLite reads from the deployed `.db` file work, but writes (analyze-case results, review submissions) do not persist across invocations. For production, migrate to Vercel Postgres or deploy as a long-running server on Railway/Render.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| LLM_PROVIDER | Yes | deepseek, openai, claude, or groq |
| DEEPSEEK_API_KEY | If provider=deepseek | DeepSeek API key |
| OPENAI_API_KEY | If provider=openai | OpenAI API key |
| ANTHROPIC_API_KEY | If provider=claude | Anthropic API key |
| GROQ_API_KEY | If provider=groq | Groq API key |
| DATABASE_PATH | No | Custom SQLite path (default: ../prior_auth.db) |

### Express Server (local dev)

`backend/server.js` mounts all five API handlers and serves the React build in production mode. Run with `node server.js` on port 3001.
