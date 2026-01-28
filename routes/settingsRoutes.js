const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');
const {
  getShopSettings,
  updateShopSettings,
  getAdminSettings,
  updateAdminSettings
} = require('../controllers/settingsController');

// All routes are protected
router.use(protect);

// Shop settings routes
router.get(
  '/shops/:id/settings',
  validateObjectId('id'),
  getShopSettings
);

router.put(
  '/shops/:id/settings',
  validateObjectId('id'),
  updateShopSettings
);

// Admin settings routes (admin only)
router.get(
  '/admin/settings',
  authorize('super_admin', 'admin'),
  getAdminSettings
);

router.put(
  '/admin/settings',
  authorize('super_admin', 'admin'),
  updateAdminSettings
);

module.exports = router;