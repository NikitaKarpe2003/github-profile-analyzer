const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const profileRoutes = require('./routes/profileRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Try again later.' },
});
app.use('/api', limiter);

app.use('/api', profileRoutes);

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/api/docs', (req, res) => {
  res.json({
    name: 'GitHub Profile Analyzer API',
    version: '1.0.0',
    base_url: 'http://localhost:3000/api',
    endpoints: [
      { method: 'POST',   path: '/api/analyze/:username',  description: 'Analyze & store a GitHub user profile' },
      { method: 'GET',    path: '/api/profiles',           description: 'List all stored profiles' },
      { method: 'GET',    path: '/api/profiles/:username', description: 'Get single profile with history' },
      { method: 'DELETE', path: '/api/profiles/:username', description: 'Delete a stored profile' },
      { method: 'GET',    path: '/api/stats',              description: 'Summary stats across all profiles' },
      { method: 'GET',    path: '/api/compare',            description: 'Compare two profiles (?a=user1&b=user2)' },
    ],
  });
});

// ✅ Fixed: removed '*' wildcard (not supported in newer path-to-regexp)
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;