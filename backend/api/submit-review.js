const { getDb } = require('../db');

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

    // On Vercel serverless, a case created by analyze-case in one function
    // instance won't exist in another. Accept the review regardless for demo.
    if (result.changes === 0) {
      db.prepare(`
        INSERT OR IGNORE INTO prior_auth_cases (id, patient_id, payer_id, human_review_status, human_notes)
        VALUES (?, 0, 0, ?, ?)
      `).run(case_id, review_status, human_notes || null);
    }

    return res.status(200).json({
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
