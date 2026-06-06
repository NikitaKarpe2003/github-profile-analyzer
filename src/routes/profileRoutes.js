// src/routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const {
  analyzeProfile, getAllProfiles, getProfile, deleteProfile, getStats,
} = require('../controllers/profileController');

router.post('/analyze/:username', analyzeProfile);
router.get('/profiles', getAllProfiles);
router.get('/profiles/:username', getProfile);
router.delete('/profiles/:username', deleteProfile);
router.get('/stats', getStats);

module.exports = router;