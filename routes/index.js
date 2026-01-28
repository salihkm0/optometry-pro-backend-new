const express = require('express');
const router = express.Router();

// Import all route files
const authRoutes = require('./authRoutes');
const shopRoutes = require('./shopRoutes');
const userRoutes = require('./userRoutes');
const customerRoutes = require('./customerRoutes');
const recordRoutes = require('./recordRoutes');
const printRoutes = require('./printRoutes');

// Define API endpoints
router.use('/auth', authRoutes);
router.use('/shops', shopRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/records', recordRoutes);
router.use('/print', printRoutes);
router.use('/settings', require('./settingsRoutes'));
router.use('/billing', require('./billingRoutes'));

module.exports = router;