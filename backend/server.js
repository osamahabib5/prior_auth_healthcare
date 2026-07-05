require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

// API handlers
const patientsHandler = require('./api/patients');
const policiesHandler = require('./api/policies');
const analyzeCaseHandler = require('./api/analyze-case');
const submitReviewHandler = require('./api/submit-review');
const evalResultsHandler = require('./api/eval-results');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Helper to wrap Vercel-style handlers for Express
function wrapHandler(handler) {
  return (req, res) => {
    handler(req, res);
  };
}

// API Routes
app.get('/api/patients', wrapHandler(patientsHandler));
app.get('/api/policies', wrapHandler(policiesHandler));
app.post('/api/analyze-case', wrapHandler(analyzeCaseHandler));
app.post('/api/submit-review', wrapHandler(submitReviewHandler));
app.get('/api/eval-results', wrapHandler(evalResultsHandler));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'frontend', 'build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Prior Auth API server running on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  GET  http://localhost:${PORT}/api/patients`);
  console.log(`  GET  http://localhost:${PORT}/api/policies`);
  console.log(`  POST http://localhost:${PORT}/api/analyze-case`);
  console.log(`  POST http://localhost:${PORT}/api/submit-review`);
  console.log(`  GET  http://localhost:${PORT}/api/eval-results`);
});

module.exports = app;
