const { getDb } = require('../backend/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const db = getDb();
    await db.ensureSeeded();
    const evalRows = await db.all(`
      SELECT er.id, er.case_id, er.expected_outcome, er.actual_outcome, er.is_correct, er.created_at,
        pac.patient_id, p.name as patient_name, p.requested_procedure as procedure
      FROM eval_results er
      JOIN prior_auth_cases pac ON er.case_id = pac.id
      JOIN patients p ON pac.patient_id = p.id
      ORDER BY er.case_id
    `);

    if (evalRows.length === 0) {
      const cases = await db.all(`
        SELECT pac.id, pac.agent_outcome, pac.patient_id, p.name, p.requested_procedure
        FROM prior_auth_cases pac
        JOIN patients p ON pac.patient_id = p.id
        WHERE pac.agent_outcome IS NOT NULL
      `);
      if (cases.length === 0) {
        return res.status(200).json({
          total_cases: 0, correct: 0, accuracy: 0,
          message: 'No analyzed cases found. Run case analyses first.', failures: []
        });
      }
      return res.status(200).json({
        total_cases: cases.length, correct: 0, accuracy: 0,
        message: 'Eval labels not yet applied.',
        cases: cases.map(c => ({
          case_id: c.id, patient_name: c.name, procedure: c.requested_procedure, actual_outcome: c.agent_outcome
        })), failures: []
      });
    }

    const totalCases = evalRows.length;
    const correct = evalRows.filter(r => r.is_correct === 1).length;
    const accuracy = totalCases > 0 ? correct / totalCases : 0;
    const failures = evalRows.filter(r => r.is_correct === 0).map(r => ({
      case_id: r.case_id, patient_name: r.patient_name, procedure: r.procedure,
      expected: r.expected_outcome, actual: r.actual_outcome,
      reason: 'Agent outcome did not match expected ground truth'
    }));

    return res.status(200).json({
      total_cases: totalCases, correct, accuracy: Math.round(accuracy * 100) / 100,
      failures, breakdown: evalRows.map(r => ({
        case_id: r.case_id, patient_name: r.patient_name, procedure: r.procedure,
        expected: r.expected_outcome, actual: r.actual_outcome, correct: r.is_correct === 1
      }))
    });
  } catch (error) {
    console.error('Error fetching eval results:', error);
    return res.status(500).json({ error: 'Failed to fetch eval results', details: error.message });
  }
};
