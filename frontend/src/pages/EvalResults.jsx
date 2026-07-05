import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || '/api';

function EvalResults() {
  const [evalData, setEvalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvalResults();
  }, []);

  const fetchEvalResults = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/eval-results`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvalData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 0.8) return 'var(--success)';
    if (accuracy >= 0.6) return 'var(--warning)';
    return 'var(--danger)';
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span className="loading-text">Loading evaluation results...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="page-title">Evaluation Results</h1>
        <div className="alert alert-error">Failed to load eval results: {error}</div>
        <button className="btn btn-primary" onClick={fetchEvalResults}>Retry</button>
      </div>
    );
  }

  if (!evalData || evalData.total_cases === 0) {
    return (
      <div>
        <h1 className="page-title">Evaluation Results</h1>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-text">
              {evalData?.message || 'No evaluation data yet'}
            </div>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', marginTop: '8px' }}>
              Run case analyses from the Case Analysis page first, then seed expected outcomes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const accuracy = evalData.accuracy;
  const accuracyPercent = Math.round(accuracy * 100);
  const failures = evalData.failures || [];
  const breakdown = evalData.breakdown || [];

  return (
    <div>
      <h1 className="page-title">Evaluation Results</h1>
      <p className="page-subtitle">Agent accuracy measured against ground-truth labels</p>

      {/* Accuracy Score */}
      <div className="card">
        <div className="accuracy-display">
          <div className="accuracy-value" style={{ color: getAccuracyColor(accuracy) }}>
            {accuracyPercent}%
          </div>
          <div className="accuracy-label">Accuracy on Test Cases</div>
          <div className="accuracy-detail">
            {evalData.correct} correct out of {evalData.total_cases} cases
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{evalData.total_cases}</div>
          <div className="stat-label">Total Test Cases</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{evalData.correct}</div>
          <div className="stat-label">Correct</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{failures.length}</div>
          <div className="stat-label">Failures</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: getAccuracyColor(accuracy) }}>
            {accuracyPercent}%
          </div>
          <div className="stat-label">Accuracy</div>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Case-by-Case Breakdown</h2>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Patient</th>
                <th>Procedure</th>
                <th>Expected</th>
                <th>Actual</th>
                <th>Correct</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map(row => (
                <tr key={row.case_id}>
                  <td>{row.case_id}</td>
                  <td>{row.patient_name}</td>
                  <td style={{ fontSize: '0.85rem' }}>{row.procedure}</td>
                  <td>
                    <span className={`badge badge-${row.expected === 'approved' ? 'approved' : row.expected === 'denied' ? 'denied' : 'missing'}`}>
                      {row.expected}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${row.actual === 'approved' ? 'approved' : row.actual === 'denied' ? 'denied' : 'missing'}`}>
                      {row.actual}
                    </span>
                  </td>
                  <td>
                    {row.correct ? (
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓</span>
                    ) : (
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failure Analysis */}
      {failures.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Failure Analysis ({failures.length} cases)</h2>
          </div>
          <div>
            {failures.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: '16px',
                  marginBottom: '12px',
                  background: 'var(--danger-light)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid #f5c6cb'
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: '8px' }}>
                  Case #{f.case_id}: {f.patient_name} — {f.procedure}
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)' }}>
                  <strong>Expected:</strong> <span className="badge badge-approved" style={{ marginLeft: '4px' }}>{f.expected}</span>
                  {' → '}
                  <strong>Actual:</strong> <span className="badge badge-missing" style={{ marginLeft: '4px' }}>{f.actual}</span>
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '8px' }}>
                  <strong>Reason:</strong> {f.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No failures */}
      {failures.length === 0 && (
        <div className="card">
          <div className="alert alert-success" style={{ marginBottom: 0 }}>
            🎉 Perfect! All test cases match expected outcomes.
          </div>
        </div>
      )}
    </div>
  );
}

export default EvalResults;
