const express = require('express');
const router = express.Router();
const { protect, shopAccess } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validation');
const {
  createBillingValidation,
  updateBillingValidation,
  updatePaymentValidation,
  cancelBillingValidation,
  searchBillingValidation
} = require('../validations/billingValidation');
const {
  createBill,
  getBills,
  getBillById,
  updateBill,
  deleteBill,
  updatePayment,
  getBillByInvoiceNumber,
  getCustomerBills,
  getBillingStats,
  exportBills
} = require('../controllers/billingController');

const {
  printInvoice,
  generateAndSavePDF,
  downloadPDF,
  previewInvoice,
  bulkGeneratePDF,
  getPrintOptions
} = require('../controllers/pdfController');

// All routes are protected
router.use(protect);

// Create new bill
router.post(
  '/',
  validate(createBillingValidation),
  createBill
);

// Get all bills with filters
router.get(
  '/',
  validate(searchBillingValidation, 'query'),
  getBills
);

// Get bill by ID
router.get(
  '/:id',
  validateObjectId('id'),
  getBillById
);

// Update bill
router.put(
  '/:id',
  validateObjectId('id'),
  validate(updateBillingValidation),
  updateBill
);

// Delete/Cancel bill
router.delete(
  '/:id',
  validateObjectId('id'),
  deleteBill
);

// Update payment for bill
router.put(
  '/:id/payment',
  validateObjectId('id'),
  validate(updatePaymentValidation),
  updatePayment
);

// Get bill by invoice number
router.get(
  '/invoice/:invoiceNumber',
  getBillByInvoiceNumber
);

// Get customer billing history
router.get(
  '/customer/:customerId',
  validateObjectId('customerId'),
  getCustomerBills
);

// Get billing statistics
router.get(
  '/stats',
  getBillingStats
);

// Export bills
router.get(
  '/export',
  exportBills
);

// PDF Generation Routes
router.get(
  '/:id/print',
  validateObjectId('id'),
  printInvoice
);

router.post(
  '/:id/generate-pdf',
  validateObjectId('id'),
  generateAndSavePDF
);

router.get(
  '/:id/download-pdf',
  validateObjectId('id'),
  downloadPDF
);

router.get(
  '/:id/preview',
  validateObjectId('id'),
  previewInvoice
);

router.post(
  '/bulk-generate-pdf',
  bulkGeneratePDF
);

router.get(
  '/print-options',
  getPrintOptions
);

module.exports = router;