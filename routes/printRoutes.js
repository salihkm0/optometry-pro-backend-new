// routes/print.js
const express = require('express');
const router = express.Router();
const {
  getRecordForPrint,
  getMultipleRecordsForPrint,
  getPrescriptionCard,
  getInvoice,
  exportToPDF
} = require('../controllers/printController');

// NO AUTHENTICATION MIDDLEWARE - Public routes for printing
router.get('/records/:id', getRecordForPrint);
router.get('/records-batch', getMultipleRecordsForPrint);
router.get('/prescription/:id', getPrescriptionCard);
router.get('/invoice/:id', getInvoice);
router.get('/export/pdf/:id', exportToPDF);

module.exports = router;