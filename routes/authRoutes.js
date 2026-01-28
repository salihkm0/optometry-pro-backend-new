const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation
} = require('../validations/authValidation');
const {
  register,
  login,
  refreshToken,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout
} = require('../controllers/authController');

// Public routes
router.post('/register', validate(registerValidation), register);
router.post('/login', validate(loginValidation), login);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', validate(forgotPasswordValidation), forgotPassword);
router.put('/reset-password/:token', validate(resetPasswordValidation), resetPassword);

// Protected routes
router.use(protect);
router.get('/me', getMe);
router.put('/update-profile', validate(updateProfileValidation), updateProfile);
router.put('/change-password', validate(changePasswordValidation), changePassword);
router.post('/logout', logout);

module.exports = router;