const express = require('express');
const router = express.Router();
const { protect, authorize, shopAccess } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validation');
const { createShopValidation, updateShopValidation } = require('../validations/shopValidation');
const {
  createShop,
  getShops,
  getShopById,
  updateShop,
  getShopStats,
  getDashboardStats,
  deactivateShop,
  activateShop
} = require('../controllers/shopController');

// All routes are protected
router.use(protect);

// Admin only routes
router.post(
  '/',
  authorize('super_admin', 'admin'),
  // validate(createShopValidation),
  createShop
);

router.get(
  '/',
  authorize('super_admin', 'admin', 'shop_owner'),
  getShops
);

router.get(
  '/dashboard/stats',
  authorize('super_admin', 'admin'),
  getDashboardStats
);

// Shop-specific routes
router.get(
  '/:id',
  validateObjectId('id'),
  shopAccess(),
  getShopById
);

router.put(
  '/:id',
  validateObjectId('id'),
  // validate(updateShopValidation),
  shopAccess(),
  updateShop
);

router.get(
  '/:id/stats',
  validateObjectId('id'),
  shopAccess(),
  getShopStats
);

// Admin only activation routes
router.put(
  '/:id/deactivate',
  validateObjectId('id'),
  authorize('super_admin', 'admin'),
  deactivateShop
);

router.put(
  '/:id/activate',
  validateObjectId('id'),
  authorize('super_admin', 'admin'),
  activateShop
);

module.exports = router;