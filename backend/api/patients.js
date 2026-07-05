const { getDb } = require('../db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDb();

    // Get all patients with their latest case status
    const patients = db.prepare(`
      SELECT p.*,
        (SELECT pac.agent_outcome FROM prior_auth_cases pac
         WHERE pac.patient_id = p.id ORDER BY pac.created_at DESC LIMIT 1) as latest_outcome,
        (SELECT pac.human_review_status FROM prior_auth_cases pac
         WHERE pac.patient_id = p.id ORDER BY pac.created_at DESC LIMIT 1) as review_status,
        (SELECT pac.id FROM prior_auth_cases pac
         WHERE pac.patient_id = p.id ORDER BY pac.created_at DESC LIMIT 1) as latest_case_id
      FROM patients p
      ORDER BY p.id
    `).all();

    return res.status(200).json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    return res.status(500).json({ error: 'Failed to fetch patients', details: error.message });
  }
};
