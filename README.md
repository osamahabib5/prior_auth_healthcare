# Prior Authorization Assistant

An AI-powered tool that helps healthcare teams evaluate prior authorization requests faster, more consistently, and with a clear audit trail.

---

## What problem does this solve?

**Prior authorization** is one of the biggest administrative headaches in healthcare. When a doctor orders a procedure — an MRI, a surgery, a medication — the insurance company (the "payer") often requires approval first. To get that approval, staff must manually compare the patient's medical records against dense, multi-page coverage policies to see if the request meets every criterion.

This is slow, tedious, and error-prone. A single missed detail can mean a denied claim and delayed care.

**This application automates that comparison.** Instead of a person reading through policy documents line by line, an AI assistant does it in seconds — and shows its work so a human can review, approve, or override every decision.

---

## How it works (step by step)

### 1. Open the Dashboard

The home screen shows a list of patient cases. Each row tells you:
- Who the patient is
- What they are diagnosed with
- What procedure they need
- Whether the case has been analyzed yet

Summary cards at the top show totals: how many cases exist, how many have been analyzed, and how many have been reviewed.

### 2. Select a case and run the analysis

Click the blue **Analyze** button next to any patient. You will see their full details — diagnosis, procedure, and clinical notes. Then click **Run Analysis**.

The AI assistant goes to work:

- **Step 1 — Look up the policy**: It finds the payer's coverage rules for that specific procedure.
- **Step 2 — Check the documentation**: It compares the patient's clinical notes against every required criterion.
- **Step 3 — Make a decision**: If everything is in order, the AI drafts a complete prior authorization letter. If something is missing, it tells you exactly what is needed.

This usually takes 5–15 seconds.

### 3. Review the results

Once the analysis finishes, you will see:

- **A colored outcome badge**: Green for Approved, Yellow for Missing Information, Red for Denied
- **A step-by-step explanation** of why the AI reached its conclusion
- **An expandable trace** showing every tool the AI used and what it found
- **A drafted letter** (if approved) — a complete, professional prior authorization letter
- **A missing documentation list** (if something is incomplete)

### 4. Human review (you have the final say)

The AI is an assistant, not a decision-maker. At the bottom of every analysis, there is a **Human Review** section where you:

- Choose **Approve** if you agree with the AI's decision
- Choose **Reject** if you disagree, and optionally add notes explaining why
- Click **Submit Review**

Your decision is recorded permanently, creating an audit trail.

### 5. Check accuracy on the Eval Results page

The **Eval Results** page shows how well the AI is performing. Fifteen test cases were hand-labeled with expected outcomes. The page shows:
- Overall accuracy (93% — 14 out of 15 correct)
- A case-by-case breakdown of every decision
- Detailed analysis of any mismatches

---

## Getting started

### What you need

- **Node.js** version 18 or later ([nodejs.org](https://nodejs.org))
- A free **[Supabase](https://supabase.com)** account (for the database)
- **An API key** for one of the supported AI providers (see below)

### Supported AI providers

This application works with four different AI providers. You only need an API key for one:

| Provider | Set LLM_PROVIDER to | API key variable | Get a key at |
|----------|---------------------|-------------------|--------------|
| DeepSeek | deepseek | DEEPSEEK_API_KEY | platform.deepseek.com |
| OpenAI | openai | OPENAI_API_KEY | platform.openai.com |
| Anthropic Claude | claude | ANTHROPIC_API_KEY | console.anthropic.com |
| Groq | groq | GROQ_API_KEY | console.groq.com |

### ⚠️ Two operating modes

This app has two modes, and which one runs depends entirely on whether you configure an LLM API key:

| Mode | When it runs | What it actually does | Accuracy |
|------|-------------|----------------------|----------|
| **LLM agent** | API key is set in `.env` (or Vercel env vars) | Sends the case to the AI provider (DeepSeek, GPT-4o, Claude, or Groq), which reads the clinical notes and reasons about whether each policy criterion is met. The LLM calls the three tools (`lookup_policy`, `check_documentation`, `draft_request`) and produces a decision based on actual language understanding. | Not yet formally measured (expected ≥80%) |
| **Local fallback** | No API key is configured | Runs a deterministic keyword-matching algorithm built into the backend. It looks for specific words and phrases in the clinical notes (e.g. "physical therapy", "conservative treatment", "imaging needed") and checks them against the policy criteria mechanically. **No AI model is involved.** | 93% (14/15 correct on test data) |

**Important**: If your Vercel deployment doesn't have `LLM_PROVIDER` and the corresponding API key set as environment variables, anyone clicking "Run Analysis" on your demo link is seeing the keyword matcher — not an LLM agent — even though the UI still calls it "AI-powered." The local fallback is surprisingly accurate on this dataset but cannot handle novel cases, unusual phrasing, or edge-case clinical reasoning the way an actual LLM can.

To confirm which mode is active, check the Vercel function logs after running an analysis:
- **LLM mode**: you'll see `[llm-provider]` messages and no fallback trace
- **Fallback mode**: you'll see an error like `Authentication Fails…` followed by the keyword-matching trace

If you do not set an API key, the app will still work — it uses the built-in keyword-based fallback described above.

### Setup steps

```bash
# 1. Get the code
git clone <your-repo-url>
cd prior-auth-assistant

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# 3. Set up Supabase (free tier)
#    - Create a project at https://supabase.com
#    - Go to SQL Editor → paste supabase-migration.sql → Run
#    - Go to Settings → Database → Connection String → Transaction pooler
#    - Copy the pooler URL

# 4. Configure .env
#    - Set LLM_PROVIDER to your chosen AI provider
#    - Paste your API key for that provider
#    - Set DATABASE_URL to your Supabase pooler URL

# 5. (Optional) Seed the database from your machine
cd backend && node seed.js

# 6. Start the backend server
node server.js
# → API running at http://localhost:3001

# 7. In another terminal, start the frontend
cd frontend && npm start
# → App opens at http://localhost:3000
```

---

## What the AI can and cannot do

### It CAN:
- Compare clinical notes against policy criteria automatically
- Identify exactly which documentation is present or missing
- Draft professional prior authorization letters
- Show its work step by step

### It CANNOT:
- Make final authorization decisions — that is always your call
- Access real patient records or hospital systems
- Handle every unusual edge case perfectly
- Replace clinical judgment about medical necessity

---

## The test data

This demo includes **15 synthetic (fake) patient cases** covering MRI scans, diabetes monitors, sleep apnea devices, surgeries, and medications. All cases are evaluated against a single **BlueCross Insurance** payer policy. Data is stored in a Supabase Postgres database — no real patient data is ever used.

All environments (local dev + Vercel production) share the same Supabase database, so cases analyzed locally appear on the live site and vice versa.

---

## Need more details?

For technical documentation — database schema, API reference, agent architecture, LLM provider setup, and deployment configuration — see **[documentation.md](documentation.md)**.
