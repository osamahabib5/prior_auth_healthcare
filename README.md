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
- **An API key** for one of the supported AI providers (see below)

### Supported AI providers

This application works with four different AI providers. You only need an API key for one:

| Provider | Set LLM_PROVIDER to | API key variable | Get a key at |
|----------|---------------------|-------------------|--------------|
| DeepSeek | deepseek | DEEPSEEK_API_KEY | platform.deepseek.com |
| OpenAI | openai | OPENAI_API_KEY | platform.openai.com |
| Anthropic Claude | claude | ANTHROPIC_API_KEY | console.anthropic.com |
| Groq | groq | GROQ_API_KEY | console.groq.com |

If you do not set an API key, the app will still work — it uses a built-in local analyzer.

### Setup steps

```
# 1. Get the code
git clone <your-repo-url>
cd prior-auth-assistant

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# 3. Configure your AI provider
#    Edit the .env file in the project root:
#    - Set LLM_PROVIDER to your chosen provider
#    - Paste your API key for that provider

# 4. Seed the database
cd backend && node seed.js

# 5. Start the backend server
node server.js
# -> Runs at http://localhost:3001

# 6. In another terminal, start the frontend
cd frontend && npm start
# -> Opens at http://localhost:3000
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

This demo includes **15 synthetic (fake) patient cases** covering MRI scans, diabetes monitors, sleep apnea devices, surgeries, and medications. All cases are evaluated against a single **BlueCross Insurance** payer policy. No real patient data is ever used.

---

## Need more details?

For technical documentation — database schema, API reference, agent architecture, LLM provider setup, and deployment configuration — see **[documentation.md](documentation.md)**.
