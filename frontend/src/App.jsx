import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import CaseAnalysis from './pages/CaseAnalysis';
import EvalResults from './pages/EvalResults';

function App() {
  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">Prior Auth</h1>
          <span className="sidebar-subtitle">AI Assistant</span>
        </div>
        <ul className="nav-links">
          <li>
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="nav-icon">🏠</span>
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/analyze" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="nav-icon">🔍</span>
              Case Analysis
            </NavLink>
          </li>
          <li>
            <NavLink to="/eval" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="nav-icon">📊</span>
              Eval Results
            </NavLink>
          </li>
        </ul>
        <div className="sidebar-footer">
          <span className="version">v1.0.0</span>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/analyze" element={<CaseAnalysis />} />
          <Route path="/eval" element={<EvalResults />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
