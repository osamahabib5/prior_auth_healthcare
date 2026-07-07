const { getDb } = require('../backend/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const db = getDb();
    const policies = db.prepare('SELECT id, payer_name, policy_text, coverage_rules, created_at FROM policies').all();
    return res.status(200).json(policies);
  } catch (error) {
    console.error('Error fetching policies:', error);
    return res.status(500).json({ error: 'Failed to fetch policies', details: error.message });
  }
};
