import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_BASE || '/api';

function Home() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/patients`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPatients(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getOutcomeBadge = (outcome, reviewStatus) => {
    if (reviewStatus === 'approved') return <span className="badge badge-review-approved">Reviewed ✓</span>;
    if (reviewStatus === 'rejected') return <span className="badge badge-review-rejected">Reviewed ✗</span>;
    if (outcome === 'approved') return <span className="badge badge-approved">Approved</span>;
    if (outcome === 'denied') return <span className="badge badge-denied">Denied</span>;
    if (outcome === 'missing_info') return <span className="badge badge-missing">Missing Info</span>;
    return <span className="badge badge-pending">Pending</span>;
  };

  const handleAnalyze = (patientId) => {
    navigate(`/analyze?patientId=${patientId}`);
  };

  // Stats
  const totalCases = patients.length;
  const analyzedCases = patients.filter(p => p.latest_outcome).length;
  const reviewedCases = patients.filter(p => p.review_status).length;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span className="loading-text">Loading patients...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="page-title">Dashboard</h1>
        <div className="alert alert-error">Failed to load patients: {error}</div>
        <button className="btn btn-primary" onClick={fetchPatients}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Prior Authorization Case Management</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{totalCases}</div>
          <div className="stat-label">Total Cases</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{analyzedCases}</div>
          <div className="stat-label">Analyzed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{reviewedCases}</div>
          <div className="stat-label">Reviewed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {analyzedCases > 0 ? Math.round((reviewedCases / analyzedCases) * 100) : 0}%
          </div>
          <div className="stat-label">Review Rate</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Patient Cases</h2>
          <button className="btn btn-secondary btn-sm" onClick={fetchPatients}>
            Refresh
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Patient</th>
                <th>Age</th>
                <th>Diagnosis</th>
                <th>Procedure</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.age}</td>
                  <td>{p.diagnosis}</td>
                  <td>{p.requested_procedure}</td>
                  <td>{getOutcomeBadge(p.latest_outcome, p.review_status)}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAnalyze(p.id)}
                    >
                      Analyze
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Home;
