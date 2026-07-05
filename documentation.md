# Prior Authorization Assistant — User Guide

## What this application does

This tool helps healthcare staff evaluate prior authorization requests faster and more consistently. You select a patient case, click a button, and an AI assistant reviews it against the payer's coverage policy. It tells you whether the request meets the criteria, what documentation is missing (if anything), and can even draft the authorization letter for you.

## The problem it solves

Prior authorization is one of the most time-consuming administrative tasks in healthcare. Staff must manually compare each patient's clinical notes against dense payer policy documents to determine if a requested procedure is covered. This application automates that comparison, so you can focus on the cases that need human judgment.

---

## How to use it

### Step 1: Open the dashboard

When you open the app, you'll see a **Home page** with a table of all patient cases. Each row shows:
- Patient name and age
- Their diagnosis
- The procedure being requested
- Current status (Pending, Approved, Missing Info, etc.)

The top of the page shows summary stats: total cases, how many have been analyzed, and how many have been reviewed.

### Step 2: Click "Analyze" on any case

Click the blue **Analyze** button next to any patient. This takes you to the Case Analysis page, where you'll see the patient's full details — their diagnosis, the procedure requested, and their clinical notes.

### Step 3: Run the analysis

Click the green **Run Analysis** button. The AI assistant will:

1. **Look up** the payer's coverage policy for that specific procedure
2. **Check** whether the patient's clinical notes contain all the required documentation
3. **Decide** whether the request should be approved, denied, or needs more information
4. **Draft** a formal prior authorization letter if the request is approved

This usually takes 5-15 seconds. You'll see a spinner while it works.

### Step 4: Review the results

Once complete, you'll see:

- **Outcome badge** — A colored label showing Approved (green), Missing Information (yellow), or Denied (red)
- **Reasoning** — A step-by-step explanation of why the AI made its decision
- **Agent Trace** — Click to expand each step and see exactly what the AI looked at and found
- **Drafted Letter** — If approved, a complete authorization letter ready to submit
- **Missing Documentation** — If something is missing, a bullet list of exactly what's needed

### Step 5: Human review (important!)

The AI is an assistant, not the final decision-maker. At the bottom of the results, you'll find the **Human Review** section:

- Select **Approve** if you agree with the AI's decision
- Select **Reject** if you disagree (and optionally add notes explaining why)
- Click **Submit Review**

This records your decision and creates an audit trail.

### Step 6: Check evaluation results

The **Eval Results** page shows how accurate the AI has been across all cases. It compares the AI's decisions against ground-truth labels and shows:
- Overall accuracy percentage
- Which cases the AI got right vs. wrong
- Detailed failure analysis for cases where the AI made a mistake

---

## What the AI can and cannot do

### The AI CAN:
- Compare clinical notes against specific policy criteria
- Identify which required documentation is present or missing
- Draft professional prior authorization letters
- Explain its reasoning step by step

### The AI CANNOT:
- Make final authorization decisions (that's your job)
- Access real patient records or EHR systems
- Handle unusual or edge-case clinical scenarios perfectly
- Replace clinical judgment about medical necessity

---

## Understanding the status badges

| Badge | Meaning |
|-------|---------|
| **Pending** | Case hasn't been analyzed yet |
| **Approved** (green) | AI found all required documentation is present |
| **Missing Info** (yellow) | AI found some required documentation is missing |
| **Denied** (red) | AI determined the request doesn't meet coverage criteria |
| **Reviewed ✓** (green) | A human reviewer approved the AI's decision |
| **Reviewed ✗** (red) | A human reviewer rejected the AI's decision |

---

## Current test data

This demo includes **15 synthetic patient cases** (not real patients) covering a variety of common procedures:

- MRI scans (spine, knee)
- Diabetes devices (continuous glucose monitor)
- Sleep apnea treatment (CPAP)
- Migraine treatment (Botox)
- Cardiac testing (stress echocardiogram)
- Arthritis medication (Humira)
- Eye surgery (cataract)
- Knee surgery (ACL reconstruction)
- Pain management (epidural steroid injection)
- Joint replacement (knee arthroplasty)
- Mental health treatment (TMS)
- Gynecologic procedures (fibroid embolization, laparoscopy)
- Sinus surgery

All cases are evaluated against a single payer policy (BlueCross Insurance).

---

## Privacy & security note

This demo uses **synthetic (fake) patient data** — no real patient information is stored or processed. All data lives in a local database on your machine. In a production setting, the application would connect to your existing systems with proper security and compliance measures (HIPAA, etc.).

---

## Questions?

If you have questions about how to use this tool or want to report an issue with the AI's decisions, contact your system administrator.
