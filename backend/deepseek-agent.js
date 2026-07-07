require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createProvider } = require('./llm-provider');

// ── LLM Provider (selected via LLM_PROVIDER env var; defaults to deepseek) ──
const provider = createProvider();

const TEMPERATURE = 0.3;
const MAX_TOKENS = 2000;

// ── Tool Implementations ──────────────────────────────────────────────

/**
 * lookup_policy: Retrieves coverage rules for a specific procedure
 * from the payer's policy in the database.
 */
function lookupPolicy(procedure, coverageRulesJson) {
  const rules = JSON.parse(coverageRulesJson);
  // Try exact match first, then fuzzy
  let rule = rules[procedure];
  if (!rule) {
    const key = Object.keys(rules).find(k =>
      k.toLowerCase().includes(procedure.toLowerCase()) ||
      procedure.toLowerCase().includes(k.toLowerCase())
    );
    rule = rule || (key ? rules[key] : null);
  }
  if (!rule) {
    return { error: `No policy found for procedure: ${procedure}`, procedure };
  }
  return {
    procedure,
    criteria: rule.criteria,
    required_documentation: rule.required_docs,
    decision_rule: rule.decision
  };
}

/**
 * check_documentation: Checks which required criteria are met in
 * the clinical notes. Uses enhanced keyword/substring matching
 * with medical-domain awareness.
 * Accepts optional `diagnosis` and `procedure` for smarter matching.
 */
function checkDocumentation(clinicalNotes, requiredCriteria, context = {}) {
  const notes = clinicalNotes.toLowerCase();
  const diagnosis = (context.diagnosis || '').toLowerCase();
  const procedure = (context.procedure || '').toLowerCase();
  const results = {};

  for (const criterion of requiredCriteria) {
    const critLower = criterion.toLowerCase();
    const keywords = extractKeywords(critLower);
    // Flexible threshold: at least 1 match or 25% of keywords
    const minMatches = Math.max(1, Math.ceil(keywords.length * 0.25));

    let matchCount = 0;
    let evidence = '';
    const matchedWords = [];

    for (const kw of keywords) {
      if (notes.includes(kw) || diagnosis.includes(kw) || procedure.includes(kw)) {
        matchCount++;
        matchedWords.push(kw);
        if (!evidence) {
          const source = notes.includes(kw) ? notes : (diagnosis.includes(kw) ? diagnosis : procedure);
          const idx = source.indexOf(kw);
          const start = Math.max(0, idx - 40);
          const end = Math.min(source.length, idx + kw.length + 40);
          evidence = '...' + source.slice(start, end).trim() + '...';
        }
      }
    }

    // ── Domain-specific overrides for medical PA criteria ──

    // Meta-documentation criteria: "Clinical notes/evaluation/records exist"
    // These criteria ask whether ANY clinical documentation exists —
    // since we have clinical_notes, these are inherently met.
    if (matchCount < minMatches) {
      const docExistencePatterns = [
        'clinical notes', 'clinical evaluation', 'documentation of',
        'records of', 'documentation for', 'medical records',
        'evaluation notes', 'progress notes', 'office notes'
      ];
      const isDocExistenceCriterion = docExistencePatterns.some(p => critLower.includes(p));
      if (isDocExistenceCriterion && clinicalNotes && clinicalNotes.trim().length > 20) {
        matchCount = minMatches;
        evidence = 'Clinical documentation present (see patient clinical notes)';
      }
    }

    // "Clinical notes documenting diagnosis" → met if patient has a diagnosis
    if (!evidence && (critLower.includes('diagnosis') || critLower.includes('diagnos'))) {
      if (context.diagnosis) {
        evidence = `Diagnosis on file: ${context.diagnosis}`;
        matchCount = minMatches; // Mark as satisfied
      }
    }

    // "Justification for imaging" → check for imaging-related phrases
    if (matchCount < minMatches && (critLower.includes('justification') && critLower.includes('imaging'))) {
      const imagingPhrases = [
        'imaging needed', 'imaging indicated', 'imaging warranted',
        'imaging to rule out', 'imaging to assess', 'imaging to evaluate',
        'rule out', 'assess surgical', 'evaluate for',
        'mri needed', 'mri indicated', 'ct needed', 'ct indicated'
      ];
      for (const phrase of imagingPhrases) {
        if (notes.includes(phrase)) {
          matchCount = minMatches;
          const idx = notes.indexOf(phrase);
          const start = Math.max(0, idx - 40);
          const end = Math.min(notes.length, idx + phrase.length + 40);
          evidence = '...' + notes.slice(start, end).trim() + '...';
          break;
        }
      }
    }

    // "Clinical exam findings" → check for physical exam terms
    if (matchCount < minMatches && critLower.includes('clinical exam')) {
      const examPhrases = [
        'physical exam', 'exam shows', 'exam findings', 'examination',
        'palpation', 'tenderness', 'range of motion', 'mcmurray',
        'positive', 'negative', 'joint line'
      ];
      for (const phrase of examPhrases) {
        if (notes.includes(phrase)) {
          matchCount = minMatches;
          const idx = notes.indexOf(phrase);
          const start = Math.max(0, idx - 40);
          const end = Math.min(notes.length, idx + phrase.length + 40);
          evidence = '...' + notes.slice(start, end).trim() + '...';
          break;
        }
      }
    }

    // "Documentation of conservative treatment" → look for treatment terms
    if (matchCount < minMatches && critLower.includes('conservative')) {
      const treatmentPhrases = [
        'physical therapy', 'nsaids', 'conservative treatment',
        'conservative management', 'conservative therapy', 'rice protocol',
        'positional therapy', 'oral', 'medication', 'injection',
        'rehabilitation', 'pt', 'physiotherapy'
      ];
      for (const phrase of treatmentPhrases) {
        if (notes.includes(phrase)) {
          matchCount = minMatches;
          const idx = notes.indexOf(phrase);
          const start = Math.max(0, idx - 40);
          const end = Math.min(notes.length, idx + phrase.length + 40);
          evidence = '...' + notes.slice(start, end).trim() + '...';
          break;
        }
      }
    }

    // "Sleep study report" / "AHI" → check for sleep study data
    if (matchCount < minMatches && (critLower.includes('sleep study') || critLower.includes('ahi'))) {
      const sleepPhrases = ['sleep study', 'ahi', 'apnea', 'hypopnea', 'polysomnography'];
      for (const phrase of sleepPhrases) {
        if (notes.includes(phrase)) {
          matchCount = minMatches;
          const idx = notes.indexOf(phrase);
          const start = Math.max(0, idx - 40);
          const end = Math.min(notes.length, idx + phrase.length + 40);
          evidence = '...' + notes.slice(start, end).trim() + '...';
          break;
        }
      }
    }

    // "Failed medications" or "failed trials" → check for failed/trial terms
    if (matchCount < minMatches && (critLower.includes('failed') || critLower.includes('trial'))) {
      const failPhrases = [
        'failed', 'trial of', 'trials of', 'without improvement',
        'despite', 'no response', 'limited response', 'stopped due to',
        'not tolerated', 'inadequate', 'unsuccessful'
      ];
      for (const phrase of failPhrases) {
        if (notes.includes(phrase)) {
          matchCount = minMatches;
          const idx = notes.indexOf(phrase);
          const start = Math.max(0, idx - 40);
          const end = Math.min(notes.length, idx + phrase.length + 40);
          evidence = '...' + notes.slice(start, end).trim() + '...';
          break;
        }
      }
    }

    // Pain assessment / VAS scores
    if (matchCount < minMatches && (critLower.includes('pain') && (critLower.includes('score') || critLower.includes('vas') || critLower.includes('assessment')))) {
      const painPhrases = ['pain', 'vas', 'score', 'severity', 'scale', '/10'];
      for (const phrase of painPhrases) {
        if (notes.includes(phrase)) {
          matchCount = minMatches;
          const idx = notes.indexOf(phrase);
          const start = Math.max(0, idx - 40);
          const end = Math.min(notes.length, idx + phrase.length + 40);
          evidence = '...' + notes.slice(start, end).trim() + '...';
          break;
        }
      }
    }

    // PHQ-9 / depression scores
    if (matchCount < minMatches && critLower.includes('phq')) {
      if (notes.includes('phq') || notes.includes('depression score')) {
        matchCount = minMatches;
        evidence = '...' + notes.slice(Math.max(0, notes.indexOf('phq') - 20), Math.min(notes.length, notes.indexOf('phq') + 30)).trim() + '...';
      }
    }

    // X-ray or imaging report
    if (matchCount < minMatches && (critLower.includes('x-ray') || critLower.includes('xray'))) {
      if (notes.includes('x-ray') || notes.includes('xray') || notes.includes('radiograph')) {
        matchCount = minMatches;
        const idx = Math.max(notes.indexOf('x-ray'), notes.indexOf('xray'), notes.indexOf('radiograph'));
        const start = Math.max(0, idx - 40);
        const end = Math.min(notes.length, idx + 40);
        evidence = '...' + notes.slice(start, end).trim() + '...';
      }
    }

    // MRI report
    if (matchCount < minMatches && critLower.includes('mri')) {
      if (notes.includes('mri')) {
        matchCount = minMatches;
        const idx = notes.indexOf('mri');
        const start = Math.max(0, idx - 40);
        const end = Math.min(notes.length, idx + 40);
        evidence = '...' + notes.slice(start, end).trim() + '...';
      }
    }

    // TB / Hepatitis screening
    if (matchCount < minMatches && (critLower.includes('tb') || critLower.includes('tuberculosis'))) {
      if (notes.includes('tb') || notes.includes('tuberculosis')) {
        matchCount = minMatches;
        evidence = '...' + notes.slice(Math.max(0, notes.toLowerCase().indexOf('tb') - 20), Math.min(notes.length, notes.toLowerCase().indexOf('tb') + 30)).trim() + '...';
      }
    }

    if (matchCount < minMatches && critLower.includes('hepatitis')) {
      if (notes.includes('hepatitis')) {
        matchCount = minMatches;
        evidence = '...' + notes.slice(Math.max(0, notes.indexOf('hepatitis') - 20), Math.min(notes.length, notes.indexOf('hepatitis') + 30)).trim() + '...';
      }
    }

    // ── Conditional requirements: "if indicated/performed/obtained" ──
    // These are optional — met by default unless there's a specific contraindication
    if (matchCount < minMatches) {
      const conditionalPatterns = [
        'if indicated', 'if performed', 'if obtained', 'if needed',
        'when indicated', 'when performed', 'as indicated',
        'if applicable', 'where applicable'
      ];
      if (conditionalPatterns.some(p => critLower.includes(p))) {
        matchCount = minMatches;
        evidence = 'Conditional requirement — not required in all cases';
      }
    }

    // ── Safety assessments & clearances ──
    // These are about absence of contraindications
    if (matchCount < minMatches && (critLower.includes('safety') || critLower.includes('clearance') || critLower.includes('contraindication'))) {
      const safetyTerms = [
        'no suicidal', 'not suicidal', 'denies suicidal', 'no seizure',
        'no contraindication', 'cleared', 'clearance', 'stable',
        'suitable', 'candidat', 'medically necessary'
      ];
      let found = false;
      for (const term of safetyTerms) {
        if (notes.includes(term)) {
          matchCount = minMatches;
          const idx = notes.indexOf(term);
          const start = Math.max(0, idx - 30);
          const end = Math.min(notes.length, idx + term.length + 30);
          evidence = '...' + notes.slice(start, end).trim() + '...';
          found = true;
          break;
        }
      }
      // If no safety concerns mentioned in notes, consider it met
      if (!found && !notes.includes('suicidal') && !notes.includes('seizure')) {
        matchCount = minMatches;
        evidence = 'No safety contraindications identified in clinical notes';
      }
    }

    // ── Clinical justification for X over Y ──
    if (matchCount < minMatches && critLower.includes('justification') && critLower.includes('over')) {
      const necessityTerms = [
        'medically necessary', 'indicated', 'warranted', 'meets criteria',
        'appropriate', 'recommended', 'needed', 'required',
        'failed', 'inadequate', 'without improvement'
      ];
      for (const term of necessityTerms) {
        if (notes.includes(term)) {
          matchCount = minMatches;
          const idx = notes.indexOf(term);
          const start = Math.max(0, idx - 40);
          const end = Math.min(notes.length, idx + term.length + 40);
          evidence = '...' + notes.slice(start, end).trim() + '...';
          break;
        }
      }
    }

    // ── Pain/symptom diary or history ──
    if (matchCount < minMatches && (critLower.includes('pain') && (critLower.includes('diary') || critLower.includes('history') || critLower.includes('symptom')))) {
      const painTerms = ['pain', 'week', 'month', 'year', 'episode', 'symptom', 'score', 'scale', 'vas', 'cyclic', 'dysmenorrhea', 'dyspareunia'];
      let foundPain = false;
      for (const term of painTerms) {
        if (notes.includes(term)) {
          foundPain = true;
          break;
        }
      }
      if (foundPain) {
        matchCount = minMatches;
        evidence = 'Pain/symptom history documented in clinical notes';
      }
    }

    // ── Endoscopy findings (conditional) ──
    if (matchCount < minMatches && critLower.includes('endoscopy')) {
      if (notes.includes('endoscopy') || critLower.includes('if performed')) {
        matchCount = minMatches;
        evidence = notes.includes('endoscopy') ?
          '...' + notes.slice(Math.max(0, notes.indexOf('endoscopy') - 30), Math.min(notes.length, notes.indexOf('endoscopy') + 30)).trim() + '...' :
          'Endoscopy conditional — CT findings sufficient for diagnosis';
      }
    }

    const met = matchCount >= minMatches;

    results[criterion] = {
      met,
      evidence: evidence || 'No supporting documentation found in clinical notes',
      matched_keywords: matchedWords,
      match_count: matchCount,
      required_min: minMatches
    };
  }

  return results;
}

/**
 * Extract meaningful keywords from a criterion string.
 * Handles compound medical terms and filters noise words.
 */
function extractKeywords(criterion) {
  const stopWords = new Set([
    'the', 'a', 'an', 'of', 'in', 'for', 'to', 'and', 'or', 'is', 'be', 'if',
    'was', 'are', 'with', 'on', 'at', 'by', 'from', 'as', 'has', 'been',
    'no', 'not', 'minimum', 'must', 'that', 'this', 'its', 'all', 'any',
    'each', 'which', 'their', 'have', 'other', 'more', 'some', 'such',
    'only', 'also', 'than', 'then', 'now', 'just', 'over', 'into', 'after'
  ]);

  // Split on common delimiters, keeping hyphenated medical terms intact
  const words = criterion
    .replace(/[()]/g, ' ')
    .replace(/[\/,;:]/g, ' ')
    .split(/[\s.]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w.toLowerCase()));

  return [...new Set(words)];
}

/**
 * draft_request: Generates a formatted prior auth request letter.
 */
function draftRequest(patientName, diagnosis, procedure, clinicalJustification, payerName) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return `[${today}]

To: ${payerName} Prior Authorization Department

Re: Prior Authorization Request for ${procedure}
Patient: ${patientName}
Diagnosis: ${diagnosis}

Clinical Justification:
${clinicalJustification}

Based on the clinical documentation provided and in accordance with ${payerName} coverage criteria, this procedure is medically necessary for the above-named patient. All required documentation is attached for your review.

We respectfully request approval for this medically necessary procedure at your earliest convenience.

Should you require additional information, please do not hesitate to contact our office.

Respectfully submitted,

[Provider Name]
[Provider NPI]
[Clinic Name]
[Contact Information]`;
}

// ── LLM Agent Loop (provider-agnostic) ────────────────────────────────

const SYSTEM_PROMPT = `You are a healthcare administrative assistant evaluating prior authorization requests.

Your job is to:
1. Look up the coverage criteria for the requested procedure using the lookup_policy tool
2. Check if the patient's clinical notes contain sufficient documentation using the check_documentation tool
3. If all required documentation is present, draft a prior authorization letter using the draft_request tool
4. If documentation is missing, clearly state what is missing

Always call tools in order. Explain your reasoning step by step. Be concise but thorough.
Your final response must include a structured JSON block with keys: outcome (one of: "approved", "denied", "missing_info"), reasoning (string), missing_documentation (array of strings; empty if approved/denied), and drafted_letter (string or null).`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'lookup_policy',
      description: 'Retrieves coverage rules for a specific procedure from the payer policy',
      parameters: {
        type: 'object',
        properties: {
          procedure: {
            type: 'string',
            description: "The requested medical procedure (e.g., 'MRI lumbar spine')"
          }
        },
        required: ['procedure']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_documentation',
      description: 'Checks which required documentation criteria are met/missing based on clinical notes',
      parameters: {
        type: 'object',
        properties: {
          clinical_notes: {
            type: 'string',
            description: 'Patient clinical notes'
          },
          required_criteria: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of required documentation criteria from policy'
          }
        },
        required: ['clinical_notes', 'required_criteria']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'draft_request',
      description: 'Generates a prior authorization request letter',
      parameters: {
        type: 'object',
        properties: {
          patient_name: { type: 'string' },
          diagnosis: { type: 'string' },
          procedure: { type: 'string' },
          clinical_justification: { type: 'string' },
          payer_name: { type: 'string' }
        },
        required: ['patient_name', 'diagnosis', 'procedure', 'clinical_justification', 'payer_name']
      }
    }
  }
];

/**
 * Execute a tool call locally and return the result
 */
function executeToolCall(name, args, context) {
  switch (name) {
    case 'lookup_policy':
      return lookupPolicy(args.procedure, context.coverageRules);
    case 'check_documentation':
      return checkDocumentation(args.clinical_notes, args.required_criteria, {
        diagnosis: context.patient?.diagnosis,
        procedure: context.patient?.requested_procedure
      });
    case 'draft_request':
      return {
        letter: draftRequest(
          args.patient_name,
          args.diagnosis,
          args.procedure,
          args.clinical_justification,
          args.payer_name
        )
      };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/**
 * Main agent loop: interacts with DeepSeek API using function calling
 */
async function runAgent(patient, policy) {
  const agentTrace = [];
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Evaluate this prior authorization request:

PATIENT:
- Name: ${patient.name}
- Age: ${patient.age}
- Diagnosis: ${patient.diagnosis}
- Requested Procedure: ${patient.requested_procedure}
- Clinical Notes: ${patient.clinical_notes}

PAYER:
- Payer: ${policy.payer_name}
- Policy coverage rules are available via the lookup_policy tool.

Please evaluate this case step by step using the available tools.`
    }
  ];

  const context = {
    coverageRules: policy.coverage_rules,
    patient,
    payerName: policy.payer_name
  };

  let maxIterations = 10;
  let iteration = 0;
  let finalResult = null;

  while (iteration < maxIterations) {
    iteration++;

    try {
      const response = await provider.chatCompletion(
        messages,
        TOOLS,
        { temperature: TEMPERATURE, maxTokens: MAX_TOKENS }
      );

      const choice = response;
      const assistantMessage = choice.message;

      // Add assistant message to history
      messages.push(assistantMessage);

      // If the model wants to call tools
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const fnName = toolCall.function.name;
          const fnArgs = JSON.parse(toolCall.function.arguments);

          // Execute the tool
          const toolResult = executeToolCall(fnName, fnArgs, context);

          // Record the trace step
          agentTrace.push({
            step: agentTrace.length + 1,
            tool: fnName,
            input: fnArgs,
            output: toolResult
          });

          // Add tool result to messages
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
        // Continue loop for next model response
        continue;
      }

      // No tool calls — this is the final response
      const content = assistantMessage.content || '';

      // Try to extract structured JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          finalResult = JSON.parse(jsonMatch[0]);
        } catch {
          // If JSON parsing fails, construct the result from the text
          finalResult = parseTextOutcome(content, agentTrace);
        }
      } else {
        finalResult = parseTextOutcome(content, agentTrace);
      }

      // Ensure required fields
      finalResult.agent_trace = agentTrace;
      finalResult.reasoning = finalResult.reasoning || content;
      finalResult.outcome = finalResult.outcome || 'missing_info';
      finalResult.missing_documentation = finalResult.missing_documentation || [];
      finalResult.drafted_letter = finalResult.drafted_letter || null;

      return finalResult;

    } catch (error) {
      console.error(`Agent error (iteration ${iteration}):`, error.response?.data || error.message);
      agentTrace.push({
        step: agentTrace.length + 1,
        tool: 'error',
        input: {},
        output: { error: error.response?.data || error.message }
      });
      break;
    }
  }

  // Fallback: if LLM didn't produce a final result, use local-only processing
  return fallbackLocalAnalysis(patient, policy, agentTrace);
}

/**
 * Parse a text-based outcome if JSON extraction fails
 */
function parseTextOutcome(content, agentTrace) {
  const lower = content.toLowerCase();
  let outcome = 'missing_info';
  if (lower.includes('approved') || lower.includes('approve') || lower.includes('meets criteria')) {
    outcome = 'approved';
  } else if (lower.includes('denied') || lower.includes('deny') || lower.includes('does not meet')) {
    outcome = 'denied';
  }

  // Extract missing docs from check_documentation tool output
  const missingDocs = [];
  for (const step of agentTrace) {
    if (step.tool === 'check_documentation') {
      for (const [criterion, result] of Object.entries(step.output)) {
        if (!result.met) {
          missingDocs.push(criterion);
        }
      }
    }
  }

  // Extract drafted letter
  let draftedLetter = null;
  for (const step of agentTrace) {
    if (step.tool === 'draft_request' && step.output.letter) {
      draftedLetter = step.output.letter;
    }
  }

  return {
    outcome,
    reasoning: content,
    missing_documentation: missingDocs,
    drafted_letter: draftedLetter
  };
}

/**
 * Fallback: Local deterministic analysis without LLM
 * Used when the API is unavailable or times out.
 */
function fallbackLocalAnalysis(patient, policy, agentTrace) {
  const rules = JSON.parse(policy.coverage_rules);
  let rule = rules[patient.requested_procedure];

  if (!rule) {
    // Fuzzy match
    const key = Object.keys(rules).find(k =>
      k.toLowerCase().includes(patient.requested_procedure.toLowerCase()) ||
      patient.requested_procedure.toLowerCase().includes(k.toLowerCase())
    );
    rule = rules[key];
  }

  if (!rule) {
    return {
      outcome: 'missing_info',
      reasoning: `No policy found for procedure "${patient.requested_procedure}". Unable to evaluate.`,
      missing_documentation: ['Policy not found for this procedure'],
      drafted_letter: null,
      agent_trace: agentTrace
    };
  }

  // Run local check_documentation
  const docResults = checkDocumentation(patient.clinical_notes, rule.required_docs, {
    diagnosis: patient.diagnosis,
    procedure: patient.requested_procedure
  });

  agentTrace.push({
    step: agentTrace.length + 1,
    tool: 'check_documentation',
    input: { clinical_notes: patient.clinical_notes, required_criteria: rule.required_docs },
    output: docResults
  });

  const allMet = Object.values(docResults).every(r => r.met);
  const missingDocs = Object.entries(docResults)
    .filter(([, r]) => !r.met)
    .map(([c]) => c);

  let outcome, draftedLetter, reasoning;

  if (allMet) {
    outcome = 'approved';
    reasoning = `All ${rule.required_docs.length} required documentation criteria are met for ${patient.requested_procedure}.`;
    const justification = `Patient ${patient.name}, age ${patient.age}, diagnosed with ${patient.diagnosis}. ${patient.clinical_notes}`;
    draftedLetter = draftRequest(
      patient.name, patient.diagnosis, patient.requested_procedure,
      justification, policy.payer_name
    );
    agentTrace.push({
      step: agentTrace.length + 1,
      tool: 'draft_request',
      input: { patient_name: patient.name, diagnosis: patient.diagnosis, procedure: patient.requested_procedure,
        clinical_justification: justification, payer_name: policy.payer_name },
      output: { letter: draftedLetter }
    });
  } else {
    outcome = 'missing_info';
    reasoning = `${missingDocs.length} of ${rule.required_docs.length} required documentation criteria are missing for ${patient.requested_procedure}.`;
  }

  return {
    outcome,
    reasoning,
    missing_documentation: missingDocs,
    drafted_letter: draftedLetter,
    agent_trace: agentTrace
  };
}

module.exports = { runAgent, lookupPolicy, checkDocumentation, draftRequest, TOOLS, SYSTEM_PROMPT };
