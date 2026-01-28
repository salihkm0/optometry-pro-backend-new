const express = require('express');
const router = express.Router();
const { protect, authorize, shopAccess } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validation');
const { registerValidation, updateProfileValidation } = require('../validations/authValidation');
const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getShopUsers,
  resetUserPassword
} = require('../controllers/userController');

// All routes are protected
router.use(protect);

// User management routes (admin/shop owner)
router.post(
  '/',
  authorize('super_admin', 'admin', 'shop_owner'),
  // validate(registerValidation),
  createUser
);

router.get(
  '/',
  authorize('super_admin', 'admin', 'shop_owner', 'optometrist', 'assistant', 'receptionist'),
  getUsers
);

router.get(
  '/shop/:shopId',
  validateObjectId('shopId'),
  shopAccess(),
  getShopUsers
);

// Individual user routes
router.get(
  '/:id',
  validateObjectId('id'),
  getUserById
);

router.put(
  '/:id',
  validateObjectId('id'),
  // validate(updateProfileValidation),
  updateUser
);

router.delete(
  '/:id',
  validateObjectId('id'),
  authorize('super_admin', 'admin', 'shop_owner'),
  deleteUser
);

router.put(
  '/:id/reset-password',
  validateObjectId('id'),
  authorize('super_admin', 'admin', 'shop_owner'),
  resetUserPassword
);

module.exports = router;