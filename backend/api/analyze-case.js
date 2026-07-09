const { getDb } = require('../db');
const { runAgent } = require('../deepseek-agent');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { patient_id, payer_id } = req.body;

    if (!patient_id || !payer_id) {
      return res.status(400).json({ error: 'patient_id and payer_id are required' });
    }

    const db = getDb();
    await db.ensureSeeded();

    // Fetch patient
    const patient = await db.get('SELECT * FROM patients WHERE id = ?', [patient_id]);
    if (!patient) {
      return res.status(404).json({ error: `Patient with id ${patient_id} not found` });
    }

    // Fetch policy
    const policy = await db.get('SELECT * FROM policies WHERE id = ?', [payer_id]);
    if (!policy) {
      return res.status(404).json({ error: `Policy with id ${payer_id} not found` });
    }

    // Run the agent
    const result = await runAgent(patient, policy);

    // Store the case in the database
    const caseResult = await db.run(
      `INSERT INTO prior_auth_cases (patient_id, payer_id, agent_outcome, drafted_letter, missing_documentation, agent_trace)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patient_id, payer_id, result.outcome, result.drafted_letter,
       JSON.stringify(result.missing_documentation), JSON.stringify(result.agent_trace)]
    );

    return res.status(200).json({
      case_id: caseResult.lastInsertRowid,
      outcome: result.outcome,
      drafted_letter: result.drafted_letter,
      missing_documentation: result.missing_documentation,
      agent_trace: result.agent_trace,
      reasoning: result.reasoning
    });

  } catch (error) {
    console.error('Error analyzing case:', error);
    return res.status(500).json({ error: 'Failed to analyze case', details: error.message });
  }
};
