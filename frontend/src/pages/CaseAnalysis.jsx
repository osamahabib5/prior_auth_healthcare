import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_BASE || '/api';

function CaseAnalysis() {
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get('patientId');

  const [patients, setPatients] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || '');
  const [selectedPayerId, setSelectedPayerId] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [expandedTraces, setExpandedTraces] = useState({});

  // Human review state
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState(null);

  useEffect(() => {
    fetchPatients();
    fetchPolicies();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API_BASE}/patients`);
      const data = await res.json();
      setPatients(data);
    } catch (err) {
      setError('Failed to load patients');
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await fetch(`${API_BASE}/policies`);
      const data = await res.json();
      setPolicies(data);
    } catch (err) {
      setError('Failed to load policies');
    }
  };

  const selectedPatient = patients.find(p => p.id === parseInt(selectedPatientId));

  const handleRunAnalysis = async () => {
    if (!selectedPatientId || !selectedPayerId) {
      setError('Please select a patient and payer');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setReviewMessage(null);
    setReviewStatus('');
    setReviewNotes('');

    try {
      const res = await fetch(`${API_BASE}/analyze-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: parseInt(selectedPatientId),
          payer_id: parseInt(selectedPayerId)
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewStatus || !result?.case_id) return;

    setReviewSubmitting(true);
    setReviewMessage(null);

    try {
      const res = await fetch(`${API_BASE}/submit-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: result.case_id,
          review_status: reviewStatus,
          human_notes: reviewNotes
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      setReviewMessage({ type: 'success', text: 'Review submitted successfully!' });
    } catch (err) {
      setReviewMessage({ type: 'error', text: `Failed to submit review: ${err.message}` });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const toggleTrace = (stepIndex) => {
    setExpandedTraces(prev => ({
      ...prev,
      [stepIndex]: !prev[stepIndex]
    }));
  };

  const getOutcomeBadge = (outcome) => {
    const classes = {
      approved: 'badge-approved',
      denied: 'badge-denied',
      missing_info: 'badge-missing'
    };
    const labels = {
      approved: 'Approved ✓',
      denied: 'Denied ✗',
      missing_info: 'Missing Information ⚠'
    };
    return (
      <span className={`badge ${classes[outcome] || 'badge-pending'}`}>
        {labels[outcome] || outcome}
      </span>
    );
  };

  // Expand first trace by default
  useEffect(() => {
    if (result?.agent_trace?.length > 0) {
      setExpandedTraces({ 0: true });
    }
  }, [result]);

  return (
    <div>
      <h1 className="page-title">Case Analysis</h1>
      <p className="page-subtitle">Run the prior authorization agent on a patient case</p>

      {/* Case Selector */}
      <div className="card">
        <div className="case-selector">
          <div className="form-group">
            <label className="form-label">Patient</label>
            <select
              className="form-select"
              value={selectedPatientId}
              onChange={e => { setSelectedPatientId(e.target.value); setResult(null); setError(null); }}
            >
              <option value="">-- Select Patient --</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.requested_procedure}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Payer</label>
            <select
              className="form-select"
              value={selectedPayerId}
              onChange={e => setSelectedPayerId(e.target.value)}
            >
              {policies.map(pol => (
                <option key={pol.id} value={pol.id}>{pol.payer_name}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleRunAnalysis}
            disabled={loading || !selectedPatientId}
          >
            {loading ? 'Analyzing...' : '▶ Run Analysis'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Patient Details (when selected) */}
      {selectedPatient && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Patient Details</h2>
          </div>
          <div className="two-col">
            <div>
              <p><strong>Name:</strong> {selectedPatient.name}</p>
              <p><strong>Age:</strong> {selectedPatient.age}</p>
              <p><strong>Diagnosis:</strong> {selectedPatient.diagnosis}</p>
            </div>
            <div>
              <p><strong>Procedure:</strong> {selectedPatient.requested_procedure}</p>
              <p><strong>Clinical Notes:</strong></p>
              <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginTop: '4px' }}>
                {selectedPatient.clinical_notes}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <div className="spinner" />
          <span className="loading-text">Agent is analyzing the case...</span>
          <span style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>
            This may take 5–30 seconds depending on API latency
          </span>
        </div>
      )}

      {/* Analysis Results */}
      {result && !loading && (
        <>
          {/* Outcome */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Agent Outcome</h2>
              {getOutcomeBadge(result.outcome)}
            </div>
            <div>
              <h4 style={{ marginBottom: '8px', color: 'var(--gray-600)' }}>Reasoning</h4>
              <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', lineHeight: '1.7' }}>
                {result.reasoning}
              </p>
            </div>
          </div>

          {/* Missing Documentation */}
          {result.missing_documentation && result.missing_documentation.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Missing Documentation</h2>
              </div>
              <ul className="missing-docs-list">
                {result.missing_documentation.map((doc, i) => (
                  <li key={i}>{doc}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Drafted Letter */}
          {result.drafted_letter && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Drafted Prior Auth Letter</h2>
              </div>
              <div className="letter-card">{result.drafted_letter}</div>
            </div>
          )}

          {/* Agent Trace */}
          {result.agent_trace && result.agent_trace.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Agent Trace ({result.agent_trace.length} steps)</h2>
              </div>
              <div className="trace-container">
                {result.agent_trace.map((step, i) => (
                  <div key={i} className="trace-step">
                    <div
                      className="trace-step-header"
                      onClick={() => toggleTrace(i)}
                    >
                      <span className="trace-step-number">{step.step}</span>
                      <span className="trace-tool-name">{step.tool}</span>
                      <span className={`trace-chevron ${expandedTraces[i] ? 'open' : ''}`}>
                        ▼
                      </span>
                    </div>
                    {expandedTraces[i] && (
                      <div className="trace-step-body">
                        <div className="trace-section">
                          <div className="trace-section-label">Input</div>
                          <div className="trace-json">
                            {JSON.stringify(step.input, null, 2)}
                          </div>
                        </div>
                        <div className="trace-section">
                          <div className="trace-section-label">Output</div>
                          <div className="trace-json">
                            {JSON.stringify(step.output, null, 2)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Human Review Section */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Human Review</h2>
            </div>
            <div className="review-section">
              <div className="form-group">
                <label className="form-label">Review Decision</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="review"
                      value="approved"
                      checked={reviewStatus === 'approved'}
                      onChange={e => setReviewStatus(e.target.value)}
                    />
                    ✅ Approve Agent Decision
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="review"
                      value="rejected"
                      checked={reviewStatus === 'rejected'}
                      onChange={e => setReviewStatus(e.target.value)}
                    />
                    ❌ Reject Agent Decision
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <textarea
                  className="form-textarea"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about this review decision..."
                />
              </div>
              <button
                className="btn btn-success"
                onClick={handleSubmitReview}
                disabled={!reviewStatus || reviewSubmitting}
              >
                {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
              {reviewMessage && (
                <div className={`alert ${reviewMessage.type === 'success' ? 'alert-success' : 'alert-error'} mt-4`}>
                  {reviewMessage.text}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !loading && !selectedPatient && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-text">Select a patient case above and click "Run Analysis"</div>
            <div style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>
              The AI agent will evaluate the prior authorization request
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CaseAnalysis;
