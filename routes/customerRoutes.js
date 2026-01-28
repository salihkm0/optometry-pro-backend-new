const express = require('express');
const router = express.Router();
const { protect, shopAccess } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validation');
const { createCustomerValidation, updateCustomerValidation } = require('../validations/customerValidation');
const {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  getCustomerStats,
  getShopCustomers
} = require('../controllers/customerController');

// All routes are protected
router.use(protect);

// Customer management routes
router.post(
  '/',
  validate(createCustomerValidation),
  createCustomer
);

router.get(
  '/',
  getCustomers
);

router.get(
  '/search',
  searchCustomers
);

// Shop-specific customer routes
router.get(
  '/shop/:shopId',
  validateObjectId('shopId'),
  shopAccess(),
  getShopCustomers
);

// Individual customer routes
router.get(
  '/:id',
  validateObjectId('id'),
  getCustomerById
);

router.put(
  '/:id',
  validateObjectId('id'),
  validate(updateCustomerValidation),
  updateCustomer
);

router.delete(
  '/:id',
  validateObjectId('id'),
  deleteCustomer
);

router.get(
  '/:id/stats',
  validateObjectId('id'),
  getCustomerStats
);

module.exports = router;