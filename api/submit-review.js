const { getDb } = require('../backend/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { case_id, review_status, human_notes } = req.body;
    if (!case_id || !review_status) {
      return res.status(400).json({ error: 'case_id and review_status are required' });
    }
    if (!['approved', 'rejected'].includes(review_status)) {
      return res.status(400).json({ error: 'review_status must be "approved" or "rejected"' });
    }
    const db = getDb();
    const result = db.prepare(`
      UPDATE prior_auth_cases
      SET human_review_status = ?, human_notes = ?
      WHERE id = ?
    `).run(review_status, human_notes || null, case_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: `Case with id ${case_id} not found` });
    }
    return res.status(200).json({
      success: true,
      message: 'Review recorded',
      case_id: parseInt(case_id),
      review_status
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return res.status(500).json({ error: 'Failed to submit review', details: error.message });
  }
};
