const express = require('express');
const router = express.Router();
const { protect, shopAccess } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validation');
const { createRecordValidation, updateRecordValidation } = require('../validations/recordValidation');
const {
  createRecord,
  getRecords,
  getRecordById,
  updateRecord,
  deleteRecord,
  getCustomerRecords,
  getShopRecordsStats,
  exportRecords
} = require('../controllers/recordController');

// All routes are protected
router.use(protect);

// Record management routes
router.post(
  '/',
  // validate(createRecordValidation),
  createRecord
);

router.get(
  '/',
  getRecords
);

router.get(
  '/export',
  exportRecords
);

// Individual record routes
router.get(
  '/:id',
  validateObjectId('id'),
  getRecordById
);

router.put(
  '/:id',
  validateObjectId('id'),
  // validate(updateRecordValidation),
  updateRecord
);

router.delete(
  '/:id',
  validateObjectId('id'),
  deleteRecord
);

// Customer records
router.get(
  '/customer/:customerId',
  validateObjectId('customerId'),
  getCustomerRecords
);

// Shop records statistics
router.get(
  '/shop/:shopId/stats',
  validateObjectId('shopId'),
  shopAccess(),
  getShopRecordsStats
);

module.exports = router;